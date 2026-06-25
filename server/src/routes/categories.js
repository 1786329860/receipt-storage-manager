import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { body } from 'express-validator';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 获取所有分类
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, COUNT(r.id) as receipt_count, COALESCE(SUM(r.actual_amount), 0) as total_spent
       FROM categories c
       LEFT JOIN receipts r ON c.id = r.category_id AND r.user_id = c.user_id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.created_at ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// 创建分类
router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('分类名不能为空')],
  async (req, res, next) => {
    try {
      const { name, icon = 'Tag', color = '#6366f1' } = req.body;
      const id = uuid();

      // 获取最大 sort_order
      const [maxRows] = await pool.execute('SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM categories WHERE user_id = ?', [req.userId]);
      const sortOrder = maxRows[0].next_order;

      await pool.execute(
        'INSERT INTO categories (id, user_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [id, req.userId, name, icon, color, sortOrder]
      );

      const [created] = await pool.execute('SELECT * FROM categories WHERE id = ?', [id]);
      res.status(201).json(created[0]);
    } catch (err) {
      next(err);
    }
  }
);

// 更新分类
router.put('/:id', async (req, res, next) => {
  try {
    const { name, icon, color, sort_order } = req.body;
    const [result] = await pool.execute(
      'UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon), color = COALESCE(?, color), sort_order = COALESCE(?, sort_order) WHERE id = ? AND user_id = ?',
      [name || null, icon || null, color || null, sort_order ?? null, req.params.id, req.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: '分类不存在' });
    const [updated] = await pool.execute('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

// 删除分类
router.delete('/:id', async (req, res, next) => {
  try {
    // 先将该分类下的小票设为无分类
    await pool.execute('UPDATE receipts SET category_id = NULL WHERE category_id = ? AND user_id = ?', [req.params.id, req.userId]);
    const [result] = await pool.execute('DELETE FROM categories WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '分类不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

export default router;
