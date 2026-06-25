import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { testConnection } from './db.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import receiptRoutes from './routes/receipts.js';
import categoryRoutes from './routes/categories.js';
import analyticsRoutes from './routes/analytics.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ===== 中间件 =====
app.set('trust proxy', 1); // Trust first proxy (Nginx)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      const allowed = [
        process.env.CLIENT_URL,
        'https://localhost',
        'http://localhost',
        'capacitor://localhost',
        'ionic://localhost',
      ];
      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for flexibility
      }
    },
    credentials: true,
  })
);
app.use(compression());
app.use(morgan('short'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 限流
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: '请求过于频繁，请稍后再试' },
  })
);

// ===== API 路由 =====
app.use('/api/auth', authRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);

// ===== 静态文件（上传的图片）=====
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ===== 前端静态文件（生产环境）=====
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  // 只拦截非 API 请求
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// ===== 错误处理 =====
app.use(errorHandler);

// ===== 启动 =====
async function start() {
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('[启动失败] 请检查 MySQL 连接配置');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`[小票管家] 服务已启动 → http://localhost:${PORT}`);
  });
}

start();
