import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { body, validationResult } from 'express-validator';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendVerificationCode, verifyCode } from '../services/email.js';

const router = Router();

// 默认分类模板
const DEFAULT_CATEGORIES = [
  { name: '餐饮', icon: 'UtensilsCrossed', color: '#f97316' },
  { name: '购物', icon: 'ShoppingBag', color: '#ec4899' },
  { name: '交通', icon: 'Car', color: '#3b82f6' },
  { name: '娱乐', icon: 'Gamepad2', color: '#8b5cf6' },
  { name: '医疗', icon: 'HeartPulse', color: '#ef4444' },
  { name: '日用', icon: 'Home', color: '#14b8a6' },
  { name: '其他', icon: 'MoreHorizontal', color: '#6b7280' },
];

// ===== 发送邮箱验证码 =====
router.post(
  '/send-code',
  [body('email').isEmail().withMessage('请输入有效的邮箱地址')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { email } = req.body;

      // 检查邮箱是否已被注册
      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ error: '该邮箱已被注册' });
      }

      await sendVerificationCode(email);
      res.json({ message: '验证码已发送' });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      next(err);
    }
  }
);

// ===== 注册（需要邮箱验证码）=====
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 2, max: 50 }).withMessage('用户名需 2-50 个字符'),
    body('password').isLength({ min: 6 }).withMessage('密码至少 6 位'),
    body('email').isEmail().withMessage('请输入有效的邮箱地址'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('请输入 6 位验证码'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { username, password, email, code, nickname } = req.body;

      // 验证邮箱验证码
      if (!verifyCode(email, code)) {
        return res.status(400).json({ error: '验证码错误或已过期' });
      }

      const id = uuid();
      const passwordHash = await bcrypt.hash(password, 10);

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // 创建用户
        await conn.execute(
          'INSERT INTO users (id, username, password_hash, nickname, email) VALUES (?, ?, ?, ?, ?)',
          [id, username, passwordHash, nickname || username, email]
        );

        // 插入默认分类
        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
          const cat = DEFAULT_CATEGORIES[i];
          await conn.execute(
            'INSERT INTO categories (id, user_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [uuid(), id, cat.name, cat.icon, cat.color, i]
          );
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      res.json({
        token,
        user: { id, username, nickname: nickname || username },
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: '用户名或邮箱已存在' });
      }
      next(err);
    }
  }
);

// ===== 登录 =====
router.post(
  '/login',
  [body('username').trim().notEmpty(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const { username, password } = req.body;

      const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
      if (rows.length === 0) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      res.json({
        token,
        user: { id: user.id, username: user.username, nickname: user.nickname },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ===== 获取当前用户信息 =====
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, nickname, email, avatar_url, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: '用户不存在' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
