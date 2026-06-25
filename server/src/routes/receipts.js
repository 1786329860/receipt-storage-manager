import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { body, query, validationResult } from 'express-validator';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 获取小票列表（支持分页、搜索、筛选）
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category_id,
      start_date,
      end_date,
      search,
      status,
      payment_method,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['r.user_id = ?'];
    const params = [req.userId];

    if (category_id) {
      conditions.push('r.category_id = ?');
      params.push(category_id);
    }
    if (start_date) {
      conditions.push('r.receipt_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('r.receipt_date <= ?');
      params.push(end_date);
    }
    if (search) {
      conditions.push('(r.merchant_name LIKE ? OR r.order_number LIKE ? OR r.notes LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (payment_method) {
      conditions.push('r.payment_method = ?');
      params.push(payment_method);
    }

    const where = conditions.join(' AND ');

    // 查总数
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM receipts r WHERE ${where}`, params);
    const total = countRows[0].total;

    // 查列表 (用 query 避免 prepared statement 的 LIMIT 兼容问题)
    const lim = parseInt(limit);
    const off = offset;
    const [rows] = await pool.query(
      `SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM receipts r
       LEFT JOIN categories c ON r.category_id = c.id
       WHERE ${where}
       ORDER BY r.receipt_date DESC, r.created_at DESC
       LIMIT ${lim} OFFSET ${off}`,
      params
    );

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 获取单个小票详情
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM receipts r
       LEFT JOIN categories c ON r.category_id = c.id
       WHERE r.id = ? AND r.user_id = ?`,
      [req.params.id, req.userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: '小票不存在' });

    // 获取明细
    const [items] = await pool.execute(
      'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id',
      [req.params.id]
    );

    res.json({ ...rows[0], items });
  } catch (err) {
    next(err);
  }
});

// 创建小票
router.post(
  '/',
  [
    body('merchant_name').trim().notEmpty().withMessage('商户名称不能为空'),
    body('amount').isFloat({ min: 0 }).withMessage('金额必须大于0'),
    body('receipt_date').isDate().withMessage('日期格式不正确'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const {
        merchant_name,
        amount,
        discount = 0,
        payment_method = 'other',
        receipt_date,
        receipt_time,
        order_number,
        notes,
        category_id,
        image_url,
        items,
      } = req.body;

      const id = uuid();
      const actual_amount = Math.max(0, parseFloat(amount) - parseFloat(discount || 0));

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.execute(
          `INSERT INTO receipts (id, user_id, category_id, merchant_name, amount, discount, actual_amount, payment_method, receipt_date, receipt_time, order_number, notes, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, req.userId, category_id || null, merchant_name, amount, discount, actual_amount, payment_method, receipt_date, receipt_time || null, order_number || '', notes || '', image_url || '']
        );

        // 插入明细
        if (items && Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            const itemId = uuid();
            const subtotal = parseFloat(item.quantity || 1) * parseFloat(item.price);
            await conn.execute(
              'INSERT INTO receipt_items (id, receipt_id, name, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [itemId, id, item.name, item.quantity || 1, item.price, subtotal]
            );
          }
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      const [created] = await pool.execute('SELECT * FROM receipts WHERE id = ?', [id]);
      res.status(201).json(created[0]);
    } catch (err) {
      next(err);
    }
  }
);

// 更新小票（支持部分更新，状态切换等场景只传 status 也能成功）
router.put(
  '/:id',
  async (req, res, next) => {
    try {
      // 检查归属
      const [existing] = await pool.execute('SELECT * FROM receipts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
      if (existing.length === 0) return res.status(404).json({ error: '小票不存在' });

      const old = existing[0];
      const body = req.body || {};
      // 显式处理：未传字段用旧值，null 也视为有效值（允许清空）
      const merchant_name = body.merchant_name !== undefined ? body.merchant_name : old.merchant_name;
      const amount = body.amount !== undefined ? body.amount : old.amount;
      const discount = body.discount !== undefined ? body.discount : old.discount;
      const payment_method = body.payment_method !== undefined ? body.payment_method : old.payment_method;
      const receipt_date = body.receipt_date !== undefined ? body.receipt_date : old.receipt_date;
      const receipt_time = body.receipt_time !== undefined ? body.receipt_time : old.receipt_time;
      const order_number = body.order_number !== undefined ? body.order_number : old.order_number;
      const notes = body.notes !== undefined ? body.notes : old.notes;
      const category_id = body.category_id !== undefined ? body.category_id : old.category_id;
      const image_url = body.image_url !== undefined ? body.image_url : old.image_url;
      const status = body.status !== undefined ? body.status : old.status;
      const items = body.items;

      // 部分更新时校验：如果传了 merchant_name 则不能为空
      if ('merchant_name' in body && (!merchant_name || !String(merchant_name).trim())) {
        return res.status(400).json({ error: '商户名称不能为空' });
      }

      const actual_amount = Math.max(0, parseFloat(amount) - parseFloat(discount || 0));

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.execute(
          `UPDATE receipts SET merchant_name=?, amount=?, discount=?, actual_amount=?, payment_method=?, receipt_date=?, receipt_time=?, order_number=?, notes=?, category_id=?, image_url=?, status=?
           WHERE id=?`,
          [
            merchant_name,
            amount,
            discount === null ? 0 : discount,
            actual_amount,
            payment_method || 'other',
            receipt_date,
            receipt_time === undefined ? null : receipt_time,
            order_number || '',
            notes || '',
            category_id === undefined ? null : category_id,
            image_url || '',
            status,
            req.params.id
          ]
        );

        // 更新明细（先删后插，仅当显式传 items 时）
        if (items && Array.isArray(items)) {
          await conn.execute('DELETE FROM receipt_items WHERE receipt_id = ?', [req.params.id]);
          for (const item of items) {
            const itemId = uuid();
            const subtotal = parseFloat(item.quantity || 1) * parseFloat(item.price);
            await conn.execute(
              'INSERT INTO receipt_items (id, receipt_id, name, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [itemId, req.params.id, item.name, item.quantity || 1, item.price, subtotal]
            );
          }
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      const [updated] = await pool.execute('SELECT * FROM receipts WHERE id = ?', [req.params.id]);
      res.json(updated[0]);
    } catch (err) {
      next(err);
    }
  }
);

// 删除小票
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM receipts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '小票不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

// 批量删除
router.post('/batch-delete', [body('ids').isArray({ min: 1 })], async (req, res, next) => {
  try {
    const { ids } = req.body;
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `DELETE FROM receipts WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, req.userId]
    );
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    next(err);
  }
});

// 批量状态更新
router.post('/batch-update', [body('ids').isArray({ min: 1 }), body('status').notEmpty()], async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `UPDATE receipts SET status = ? WHERE id IN (${placeholders}) AND user_id = ?`,
      [status, ...ids, req.userId]
    );
    res.json({ updated: result.affectedRows });
  } catch (err) {
    next(err);
  }
});

export default router;
