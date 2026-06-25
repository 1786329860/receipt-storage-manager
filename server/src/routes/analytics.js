import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 综合统计概览
router.get('/overview', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const userId = req.userId;

    // 默认当月
    const now = new Date();
    const sd = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const ed = end_date || now.toISOString().slice(0, 10);

    // 总支出
    const [totalRows] = await pool.execute(
      'SELECT COALESCE(SUM(actual_amount), 0) as total FROM receipts WHERE user_id = ? AND receipt_date BETWEEN ? AND ?',
      [userId, sd, ed]
    );

    // 小票数量
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM receipts WHERE user_id = ? AND receipt_date BETWEEN ? AND ?',
      [userId, sd, ed]
    );

    // 分类支出
    const [categoryRows] = await pool.execute(
      `SELECT c.id, c.name, c.icon, c.color, COALESCE(SUM(r.actual_amount), 0) as total, COUNT(r.id) as count
       FROM categories c
       LEFT JOIN receipts r ON c.id = r.category_id AND r.user_id = ? AND r.receipt_date BETWEEN ? AND ?
       WHERE c.user_id = ?
       GROUP BY c.id
       HAVING total > 0
       ORDER BY total DESC`,
      [userId, sd, ed, userId]
    );

    // 支付方式统计
    const [paymentRows] = await pool.execute(
      `SELECT payment_method, COALESCE(SUM(actual_amount), 0) as total, COUNT(*) as count
       FROM receipts
       WHERE user_id = ? AND receipt_date BETWEEN ? AND ?
       GROUP BY payment_method
       ORDER BY total DESC`,
      [userId, sd, ed]
    );

    // 日均消费
    const start = new Date(sd);
    const end = new Date(ed);
    const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
    const dailyAvg = totalRows[0].total / days;

    res.json({
      totalAmount: parseFloat(totalRows[0].total),
      receiptCount: countRows[0].count,
      dailyAvg: Math.round(dailyAvg * 100) / 100,
      categories: categoryRows.map((r) => ({ ...r, total: parseFloat(r.total) })),
      paymentMethods: paymentRows.map((r) => ({ ...r, total: parseFloat(r.total) })),
      startDate: sd,
      endDate: ed,
    });
  } catch (err) {
    next(err);
  }
});

// 月度趋势
router.get('/monthly-trend', async (req, res, next) => {
  try {
    const { year } = req.query;
    const y = year || new Date().getFullYear();
    const userId = req.userId;

    const [rows] = await pool.execute(
      `SELECT MONTH(receipt_date) as month, COALESCE(SUM(actual_amount), 0) as total, COUNT(*) as count
       FROM receipts
       WHERE user_id = ? AND YEAR(receipt_date) = ?
       GROUP BY MONTH(receipt_date)
       ORDER BY month`,
      [userId, y]
    );

    // 填充空月份
    const result = [];
    for (let m = 1; m <= 12; m++) {
      const found = rows.find((r) => r.month === m);
      result.push({
        month: m,
        total: found ? parseFloat(found.total) : 0,
        count: found ? found.count : 0,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 每日趋势
router.get('/daily-trend', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const userId = req.userId;

    const now = new Date();
    const sd = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const ed = end_date || now.toISOString().slice(0, 10);

    const [rows] = await pool.execute(
      `SELECT DATE(receipt_date) as date, COALESCE(SUM(actual_amount), 0) as total, COUNT(*) as count
       FROM receipts
       WHERE user_id = ? AND receipt_date BETWEEN ? AND ?
       GROUP BY DATE(receipt_date)
       ORDER BY date`,
      [userId, sd, ed]
    );

    res.json(rows.map((r) => ({ ...r, total: parseFloat(r.total), date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date })));
  } catch (err) {
    next(err);
  }
});

export default router;
