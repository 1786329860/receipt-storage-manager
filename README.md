# 票小兜（Receipt Storage Manager）

> 一个面向个人/家庭的电子小票收纳与消费分析应用，支持 Android（WebView 混合应用）与 Web 双端。拍照存票、自动归类、可视化统计，让每一笔消费都清晰可追溯。

---

## 目录

- [项目简介](#项目简介)
- [整体架构](#整体架构)
- [技术栈选型](#技术栈选型)
- [目录结构](#目录结构)
- [核心功能模块](#核心功能模块)
- [后端架构详解](#后端架构详解)
- [API 接口设计](#api-接口设计)
- [数据库结构说明](#数据库结构说明)
- [前端架构详解](#前端架构详解)
- [移动端打包](#移动端打包)
- [部署指南](#部署指南)
- [本地开发](#本地开发)
- [安全与合规](#安全与合规)
- [许可协议](#许可协议)

---

## 项目简介

票小兜是一个以"小票"为中心的消费记录与统计分析工具。用户可以通过拍照或手动录入的方式保存小票，系统自动按商户、日期、支付方式、分类等维度进行归档，并提供月度趋势、每日趋势、分类占比等可视化分析报表，帮助用户清晰掌握自己的消费结构。

**核心价值**

- **拍照存票**：上传小票图片，永久留存，不再丢失
- **多维统计**：按月/日/分类/支付方式多维度可视化
- **快速检索**：支持商户名、订单号、备注全文搜索
- **跨平台同步**：账号体系保证数据云端持久化，多设备可见
- **离线缓存**：本地缓存策略让二次进入页面秒级响应

---

## 整体架构

```
┌────────────────────────────────────────────────────────────┐
│                    客户端（Client）                          │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │  Web 端（Browser）   │    │  Android 端（Capacitor） │  │
│  │  React 18 + Vite     │    │  WebView + 原生壳        │  │
│  └──────────┬───────────┘    └──────────┬───────────────┘  │
│             │                            │                  │
│             └────────────┬───────────────┘                  │
│                          │ HTTPS (JWT Bearer)                │
└──────────────────────────┼─────────────────────────────────┘
                           │
┌──────────────────────────┼─────────────────────────────────┐
│                    服务端（Server）                           │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Express 4 (ESM) + Helmet + CORS + Compression         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │  /auth   │ │ /receipts│ │/categories│ │/analytics│  │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │ │
│  │       │            │            │            │         │ │
│  │       └────────────┴────────────┴────────────┘         │ │
│  │                    │                                    │ │
│  │             JWT Auth Middleware                         │ │
│  │                    │                                    │ │
│  └────────────────────┼───────────────────────────────────┘ │
│                       ▼                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  MySQL 8.0 (utf8mb4)                                    │ │
│  │  users / categories / receipts / receipt_items          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  反向代理：OpenResty (Nginx) → Node.js (PM2 Cluster)        │
└─────────────────────────────────────────────────────────────┘
```

**请求链路**：客户端 → OpenResty (HTTPS 终止 + 静态资源) → Node.js Express (业务 API) → MySQL。

---

## 技术栈选型

### 后端

| 技术 | 版本 | 选型理由 |
|------|------|---------|
| **Node.js** | ≥ 18 | 异步 IO 模型适合高并发 API；前后端同语言降低心智成本 |
| **Express** | 4.21 | 最成熟的 Node Web 框架，中间件生态丰富，学习曲线低 |
| **MySQL 8.0** | 8.x | 关系型数据库保证事务一致性；DECIMAL 类型精确存储金额；utf8mb4 支持完整 emoji |
| **mysql2/promise** | 3.11 | 原生 Promise + Prepared Statements，防 SQL 注入；连接池复用连接 |
| **jsonwebtoken** | 9.0 | 无状态 JWT 适合多端登录；30 天有效期平衡安全与体验 |
| **bcryptjs** | 2.4 | 工业级密码哈希，自适应 cost factor 防彩虹表 |
| **express-validator** | 7.2 | 声明式参数校验，与路由同文件易维护 |
| **helmet** | 7.1 | 一键启用 11 项 HTTP 安全头 |
| **express-rate-limit** | 7.4 | 15 分钟 300 次限流，防暴力破解与爬虫 |
| **multer** | 1.4 | 处理 multipart/form-data 图片上传 |
| **sharp** | 0.33 | 高性能图片处理（原生绑定，比 Jimp 快 10x） |
| **nodemailer** | 6.9 | 注册邮箱验证码发送 |
| **PM2** | 5.x | 生产环境进程守护 + cluster 模式 + 自动重启 |
| **OpenResty** | 1.21 | Nginx + Lua，反向代理 + HTTPS + 静态资源 |

### 前端

| 技术 | 版本 | 选型理由 |
|------|------|---------|
| **React** | 18.3 | 函数组件 + Hooks 心智模型简洁；并发渲染优化体验 |
| **TypeScript** | 5.6 | 静态类型检查减少运行时错误；类型推断提升开发效率 |
| **Vite** | 6.0 | ESBuild 预构建速度极快；HMR 毫秒级热更新 |
| **React Router v6** | 6.28 | HashRouter 兼容 WebView 静态文件协议；嵌套路由简洁 |
| **Zustand** | 5.0 | 极简状态管理（无 Redux 样板代码）；persist 中间件易扩展 |
| **Tailwind CSS** | 3.4 | 原子化 CSS 减少命名负担；JIT 模式打包体积小 |
| **Recharts** | 2.15 | 基于 React 的声明式图表库；满足柱状/折线/饼图需求 |
| **lucide-react** | 0.460 | 轻量 SVG 图标库，Tree-shaking 友好 |
| **Capacitor** | 8.x | 现代 WebView 混合应用方案；原生插件生态丰富 |

### 选型决策说明

**为什么不用 ORM（如 Sequelize/Prisma）？**
本项目 SQL 查询较为简单且高度可控，直接使用 `mysql2/promise` 的 Prepared Statements 更轻量、性能更好、SQL 可读性更强，避免 ORM 的抽象泄漏问题。

**为什么用 HashRouter 而不是 BrowserRouter？**
Android WebView 加载本地静态文件时，BrowserRouter 的 history 模式无法处理深链接刷新，HashRouter 的 `#/path` 形式兼容性更好。

**为什么选 localStorage 而不是 IndexedDB？**
单页缓存数据量 < 50KB，localStorage 同步 API 在 `useState` lazy initializer 中可零延迟返回，实现"重启秒开"；IndexedDB 的异步 API 增加复杂度而收益有限。

---

## 目录结构

```
receipt-storage-manager/
├── client/                      # 前端源码
│   ├── src/
│   │   ├── components/          # 通用组件（BottomNav / ErrorBoundary / ReceiptCard）
│   │   ├── hooks/
│   │   │   └── useAuth.ts       # Zustand 全局认证状态
│   │   ├── lib/
│   │   │   ├── api.ts           # HTTP 请求封装（带时间戳防缓存 + silent 401）
│   │   │   ├── cache.ts         # 统一本地缓存工具库
│   │   │   └── utils.ts         # 工具函数 + DATA_CHANGED_EVENT 事件总线
│   │   ├── pages/               # 7 个业务页面
│   │   │   ├── HomePage.tsx         # 首页（消费概览 + 最近小票）
│   │   │   ├── ReceiptsPage.tsx     # 小票列表（分页 + 筛选 + 搜索）
│   │   │   ├── AddReceiptPage.tsx   # 新增/编辑小票
│   │   │   ├── ReceiptDetailPage.tsx# 小票详情 + 状态切换
│   │   │   ├── AnalyticsPage.tsx    # 统计分析（图表）
│   │   │   ├── LoginPage.tsx        # 登录/注册
│   │   │   └── SettingsPage.tsx     # 个人设置
│   │   ├── types/
│   │   │   └── index.ts         # 全局 TS 类型定义
│   │   ├── App.tsx              # 根组件 + 路由表
│   │   ├── main.tsx             # 应用入口（含 ErrorBoundary）
│   │   └── index.css            # Tailwind 入口 + 全局样式
│   ├── vite.config.ts           # Web 端构建配置
│   ├── vite.config.mobile.ts    # 移动端构建配置（ES2019 + API 注入）
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── server/                      # 后端源码
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT 验证中间件
│   │   │   └── errorHandler.js  # 全局错误处理
│   │   ├── routes/
│   │   │   ├── auth.js          # 认证（登录/注册/验证码）
│   │   │   ├── receipts.js      # 小票 CRUD + 批量操作
│   │   │   ├── categories.js    # 分类 CRUD
│   │   │   ├── analytics.js     # 统计分析
│   │   │   └── upload.js        # 图片上传
│   │   ├── services/
│   │   │   └── email.js         # 邮件服务（验证码）
│   │   ├── db.js                # MySQL 连接池
│   │   └── server.js            # 应用入口
│   ├── init.sql                 # 数据库初始化脚本
│   ├── .env.example             # 环境变量模板
│   └── package.json
│
├── mobile/                      # Capacitor 移动端壳
│   ├── android/                 # Android 原生工程
│   │   ├── app/
│   │   │   ├── src/main/
│   │   │   │   ├── java/com/receipt/manager/MainActivity.java
│   │   │   │   ├── res/         # 图标 / 启动屏 / 字符串 / 样式
│   │   │   │   └── AndroidManifest.xml
│   │   │   └── build.gradle
│   │   ├── gradle/
│   │   ├── build.gradle
│   │   └── settings.gradle
│   ├── capacitor.config.ts      # Capacitor 配置
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 核心功能模块

### 1. 用户认证模块

| 功能 | 说明 |
|------|------|
| 邮箱验证码注册 | 注册前需获取邮箱验证码（6 位，10 分钟有效） |
| 用户名密码登录 | bcrypt 哈希存储，JWT 30 天有效期 |
| 默认分类初始化 | 新用户自动创建 7 个默认分类（餐饮/购物/交通/娱乐/医疗/日用/其他） |
| Token 续期 | 客户端 401 时静默跳转登录页，避免循环刷新 |

### 2. 小票管理模块

| 功能 | 说明 |
|------|------|
| 新增小票 | 商户名、金额、折扣、支付方式、日期时间、订单号、备注、分类、图片 |
| 编辑小票 | 支持部分更新（仅传 status 也能成功），未传字段保留旧值 |
| 删除小票 | 单条删除 / 批量删除 |
| 状态管理 | pending（待核对）/ checked（已核对）/ archived（已归档） |
| 批量状态更新 | 一次性将多条小票标记为已核对/已归档 |
| 多维筛选 | 分类、日期范围、商户/订单号/备注搜索、支付方式、状态 |
| 分页查询 | 默认每页 20 条，按日期倒序 |

### 3. 分类管理模块

| 功能 | 说明 |
|------|------|
| 分类 CRUD | 自定义名称、图标、颜色、排序 |
| 引用保护 | 删除分类时，该分类下的小票自动置为"未分类"，不会删除小票 |
| 统计聚合 | 查询分类列表时返回每个分类的小票数量与总支出 |

### 4. 统计分析模块

| 功能 | 说明 |
|------|------|
| 综合概览 | 总支出、小票数、日均、分类明细、支付方式分布 |
| 月度趋势 | 按月份聚合的柱状图（填充 12 个月空数据） |
| 每日趋势 | 按日期聚合的折线图（支持自定义日期范围） |
| 日期范围筛选 | 支持任意起止日期 |

### 5. 文件上传模块

| 功能 | 说明 |
|------|------|
| 图片上传 | 支持 jpg/jpeg/png/gif/webp/heic，单文件 10MB |
| 文件命名 | UUID 重命名防冲突 |
| 静态服务 | Express 托管 `/uploads` 目录 |

### 6. 本地缓存模块（前端）

| 功能 | 说明 |
|------|------|
| Cache-First 策略 | 进入页面优先读 localStorage 缓存，零延迟渲染 |
| Silent Refresh | 后台静默拉取最新数据，UI 不阻塞 |
| 用户隔离 | 缓存键含 userId，切换账号互不干扰 |
| 事件驱动失效 | 增删改后通过 `DATA_CHANGED_EVENT` 全局事件清缓存 |
| 分桶缓存 | 按筛选条件+分页+日期范围独立缓存 |

---

## 后端架构详解

### 应用入口（[server/src/server.js](server/src/server.js)）

```javascript
// 中间件链
app.use(helmet({...}))            // 安全头
app.use(cors({...}))              // 跨域（允许 WebView 协议）
app.use(compression())            // gzip 压缩
app.use(morgan('short'))          // 访问日志
app.use(express.json({limit:'10mb'}))

// API 限流
app.use('/api/', rateLimit({windowMs: 15*60*1000, max: 300}))

// 路由挂载
app.use('/api/auth', authRoutes)
app.use('/api/receipts', receiptRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/upload', uploadRoutes)

// 静态资源
app.use('/uploads', express.static(...))    // 用户上传图片
app.use(express.static(clientDist))         // 前端构建产物
app.get('*', SPA fallback)                  // React Router 兜底

// 全局错误处理
app.use(errorHandler)
```

### 分层架构

```
┌────────────────────────────────────┐
│  路由层 routes/*.js                 │  参数校验 + 路由分发
├────────────────────────────────────┤
│  中间件层 middleware/*.js           │  JWT 鉴权 + 错误兜底
├────────────────────────────────────┤
│  服务层 services/*.js               │  邮件发送等外部服务
├────────────────────────────────────┤
│  数据访问层 db.js + mysql2/promise  │  连接池 + Prepared Statements
└────────────────────────────────────┘
```

### 关键设计

**1. Prepared Statements 防 SQL 注入**

所有用户输入都通过 `pool.execute(sql, params)` 的参数化查询传入，绝不拼接 SQL 字符串。唯一例外是 `LIMIT/OFFSET`（mysql2 prepared statement 对 LIMIT 兼容性差），通过 `parseInt` 强制转换为整数后拼接，保证安全。

**2. 事务保证一致性**

涉及多表写入的操作（如创建小票 + 插入明细）使用事务：

```javascript
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  await conn.execute('INSERT INTO receipts ...');
  await conn.execute('INSERT INTO receipt_items ...');
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}
```

**3. 部分更新（PATCH 语义）**

`PUT /api/receipts/:id` 支持部分更新：未传字段保留旧值，`null` 视为有效值（允许清空）。状态切换场景只传 `status` 也能成功。

```javascript
const merchant_name = body.merchant_name !== undefined ? body.merchant_name : old.merchant_name;
```

**4. 全局错误处理**

`middleware/errorHandler.js` 统一处理：
- MySQL 错误（`ER_DUP_ENTRY` 等）→ 409
- JWT 错误 → 401
- 参数校验错误 → 400
- 未知错误 → 500 + 日志

### 性能优化

- **连接池**：`connectionLimit: 10`，复用 TCP 连接
- **gzip 压缩**：API 响应体积减少 70%+
- **索引优化**：`receipts` 表对 `user_id`、`category_id`、`receipt_date`、`status`、`payment_method` 建立索引
- **PM2 Cluster**：生产环境按 CPU 核数启动多进程

---

## API 接口设计

所有 API 以 `/api` 为前缀，需携带 `Authorization: Bearer <token>` 头（除 `/api/auth/login` 和 `/api/auth/send-code`、`/api/auth/register`）。

### 认证 `/api/auth`

| Method | Path | 说明 | 鉴权 |
|--------|------|------|------|
| POST | `/api/auth/send-code` | 发送邮箱验证码 | 否 |
| POST | `/api/auth/register` | 注册（需验证码） | 否 |
| POST | `/api/auth/login` | 登录 | 否 |
| GET | `/api/auth/me` | 获取当前用户信息 | 是 |

**请求/响应示例**

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "alice", "password": "secret123" }

HTTP/1.1 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "uuid", "username": "alice", "nickname": "Alice" }
}
```

### 小票 `/api/receipts`

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/receipts` | 列表查询（分页 + 多维筛选） |
| GET | `/api/receipts/:id` | 小票详情（含明细） |
| POST | `/api/receipts` | 新增小票 |
| PUT | `/api/receipts/:id` | 更新小票（支持部分更新） |
| DELETE | `/api/receipts/:id` | 删除小票 |
| POST | `/api/receipts/batch-delete` | 批量删除 |
| POST | `/api/receipts/batch-update` | 批量更新状态 |

**列表查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码（默认 1） |
| limit | number | 每页条数（默认 20） |
| category_id | string | 分类筛选 |
| start_date | date | 起始日期（YYYY-MM-DD） |
| end_date | date | 结束日期 |
| search | string | 商户/订单号/备注模糊搜索 |
| status | string | pending/checked/archived |
| payment_method | string | cash/wechat/alipay/card/other |

**列表响应**

```json
{
  "data": [Receipt, ...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 53,
    "totalPages": 3
  }
}
```

### 分类 `/api/categories`

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/categories` | 列表（含统计） |
| POST | `/api/categories` | 创建 |
| PUT | `/api/categories/:id` | 更新 |
| DELETE | `/api/categories/:id` | 删除（小票置为未分类） |

### 统计 `/api/analytics`

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/analytics/overview` | 综合概览（支持 start_date/end_date） |
| GET | `/api/analytics/monthly-trend` | 月度趋势（支持 year） |
| GET | `/api/analytics/daily-trend` | 每日趋势（支持 start_date/end_date） |

### 上传 `/api/upload`

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/upload` | 上传图片（multipart/form-data，字段名 image） |

**响应**

```json
{ "url": "/uploads/uuid.png", "filename": "uuid.png" }
```

---

## 数据库结构说明

数据库名 `receipt_manager`，字符集 `utf8mb4`，排序规则 `utf8mb4_unicode_ci`。完整建表语句见 [server/init.sql](server/init.sql)。

### ER 关系图

```
┌──────────────┐ 1     N ┌──────────────┐ 1     N ┌────────────────┐
│    users     │─────────│   receipts   │─────────│ receipt_items  │
└──────┬───────┘         └──────┬───────┘         └────────────────┘
       │ 1                      │ N
       │                        │
       │ N                      │
┌──────┴───────┐                │
│  categories  │────────────────┘
└──────────────┘ 1     N
```

### 表结构详解

#### users（用户表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CHAR(36) | PK | UUID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 哈希 |
| nickname | VARCHAR(100) | DEFAULT '' | 昵称 |
| email | VARCHAR(100) | UNIQUE | 邮箱 |
| avatar_url | VARCHAR(500) | DEFAULT '' | 头像 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | |

#### categories（分类表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CHAR(36) | PK | UUID |
| user_id | CHAR(36) | FK→users(id) ON DELETE CASCADE | 所属用户 |
| name | VARCHAR(50) | NOT NULL | 分类名 |
| icon | VARCHAR(50) | DEFAULT 'Tag' | 图标名（lucide） |
| color | VARCHAR(7) | DEFAULT '#6366f1' | 颜色（hex） |
| sort_order | INT | DEFAULT 0 | 排序 |

#### receipts（小票主表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CHAR(36) | PK | UUID |
| user_id | CHAR(36) | FK→users(id) ON DELETE CASCADE | 所属用户 |
| category_id | CHAR(36) | FK→categories(id) ON DELETE SET NULL | 分类（可空） |
| merchant_name | VARCHAR(200) | NOT NULL | 商户名 |
| amount | DECIMAL(12,2) | NOT NULL | 原始金额 |
| discount | DECIMAL(12,2) | DEFAULT 0 | 折扣 |
| actual_amount | DECIMAL(12,2) | NOT NULL | 实付金额（= amount - discount） |
| payment_method | ENUM | DEFAULT 'other' | cash/wechat/alipay/card/other |
| receipt_date | DATE | NOT NULL | 小票日期 |
| receipt_time | TIME | NULL | 小票时间 |
| order_number | VARCHAR(100) | DEFAULT '' | 订单号 |
| notes | TEXT | | 备注 |
| image_url | VARCHAR(500) | DEFAULT '' | 小票图片 |
| status | ENUM | DEFAULT 'pending' | pending/checked/archived |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | |

**索引**：`idx_user_id`、`idx_category_id`、`idx_receipt_date`、`idx_status`、`idx_payment_method`

#### receipt_items（小票明细表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | CHAR(36) | PK | UUID |
| receipt_id | CHAR(36) | FK→receipts(id) ON DELETE CASCADE | 所属小票 |
| name | VARCHAR(200) | NOT NULL | 商品名 |
| quantity | INT | DEFAULT 1 | 数量 |
| price | DECIMAL(12,2) | NOT NULL | 单价 |
| subtotal | DECIMAL(12,2) | NOT NULL | 小计（= quantity × price） |

### 设计要点

1. **金额用 DECIMAL(12,2)**：精确到分，避免浮点误差
2. **UUID 主键**：分布式友好，无自增暴露信息
3. **ON DELETE CASCADE**：删用户级联删分类和小票，删小票级联删明细
4. **ON DELETE SET NULL**：删分类时小票的 category_id 置空，不删小票
5. **ENUM 限制枚举值**：支付方式与状态防脏数据

---

## 前端架构详解

### 状态管理

使用 **Zustand** 管理全局认证状态（[client/src/hooks/useAuth.ts](client/src/hooks/useAuth.ts)）：

```typescript
export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  init: () => { /* 从 localStorage 恢复 */ },
  login: async (username, password) => { /* 调用 API + 存 localStorage */ },
  logout: () => { clearUserCache(); localStorage.clear(); ... },
}));
```

**选型理由**：相比 Redux，Zustand 无样板代码，API 简洁，TypeScript 支持好。

### 路由设计

使用 **HashRouter** 兼容 WebView 静态文件协议：

| Path | 组件 | 鉴权 | 说明 |
|------|------|------|------|
| `/login` | LoginPage | 否 | 登录注册页 |
| `/` | HomePage | 是 | 首页（消费概览） |
| `/receipts` | ReceiptsPage | 是 | 小票列表 |
| `/add` | AddReceiptPage | 是 | 新增/编辑小票 |
| `/receipts/:id` | ReceiptDetailPage | 是 | 小票详情 |
| `/analytics` | AnalyticsPage | 是 | 统计分析 |
| `/settings` | SettingsPage | 是 | 个人设置 |

受保护路由通过 `ProtectedRoute` HOC 包裹，未登录重定向至 `/login`。

### HTTP 请求层

[client/src/lib/api.ts](client/src/lib/api.ts) 封装要点：

1. **统一 baseURL**：Web 端从 `import.meta.env` 读取，移动端从 `__MOBILE_API_BASE__` 编译期注入
2. **自动携带 Token**：从 localStorage 读取 token 注入 `Authorization` 头
3. **GET 请求防缓存**：自动追加 `_t=时间戳` 参数 + `cache: 'no-store'` 头，避免 WebView 缓存
4. **静默 401**：401 时不弹错误提示，避免循环刷新，直接跳转登录页
5. **URL 参数规范化**：使用 `URLSearchParams` 拼接，避免缺少 `?` 导致 404

### 本地缓存策略

[client/src/lib/cache.ts](client/src/lib/cache.ts) 提供统一缓存能力：

**缓存键设计**：`c:v${SCHEMA_VERSION}:${userId}:${scope}:${paramHash}`

- 用户隔离：切换账号互不干扰
- 业务分桶：home / receipts / analytics
- 参数分桶：同页不同筛选条件独立缓存

**核心策略**：Cache-First + Silent Refresh

```
进入页面
   ↓
读取 localStorage（同步，零延迟）
   ↓
有缓存 → 立即渲染 + 后台 silentRefresh + 显示"更新中"指示器
无缓存 → 全屏 loading + 网络请求
   ↓
请求完成 → 更新 state + 写入缓存
```

**失效机制**：
- TTL 30 分钟（receipts 为 0 永不过期）
- `DATA_CHANGED_EVENT` 全局事件主动清理
- 退出登录清空当前用户全部缓存
- Schema 版本升级自动失效

### 跨页面数据同步

[client/src/lib/utils.ts](client/src/lib/utils.ts) 实现基于 `CustomEvent` 的事件总线：

```typescript
export const DATA_CHANGED_EVENT = 'receipts:data-changed';
export function notifyDataChanged(detail?: { type?: 'create'|'update'|'delete' }) {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail }));
}
```

增删改小票后调用 `notifyDataChanged()`，首页/列表/统计页监听该事件并清缓存+静默刷新，保证数据一致性。

---

## 移动端打包

### 构建流程

```bash
# 1. 构建移动端前端产物（ES2019 语法降级 + API 地址注入）
cd client
npm run build:mobile
# 产物：client/dist-mobile/

# 2. 同步到 Android 工程
cd ../mobile
npx cap sync android
# 将 dist-mobile 复制到 android/app/src/main/assets/public/

# 3. 打包 Debug APK
cd android
./gradlew assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

### 关键配置

**[client/vite.config.mobile.ts](client/vite.config.mobile.ts)**

```typescript
define: {
  __MOBILE_API_BASE__: JSON.stringify('https://your-domain.com'),
},
build: {
  target: 'es2019',  // 兼容低版本 WebView
}
```

**[mobile/capacitor.config.ts](mobile/capacitor.config.ts)**

```typescript
{
  appId: 'com.receipt.manager',
  appName: '票小兜',
  webDir: '../client/dist-mobile',
  server: { androidScheme: 'https' },
}
```

### Android 权限

`AndroidManifest.xml` 声明：
- `INTERNET`：网络访问
- `CAMERA`：拍照存票
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`：图片读写

---

## 部署指南

### 前置条件

- 云服务器（推荐 2C4G+，Ubuntu 22.04 / Debian 12）
- 域名 + HTTPS 证书（Let's Encrypt 免费）
- Node.js ≥ 18
- MySQL 8.0
- Nginx / OpenResty
- PM2（`npm install -g pm2`）

### 步骤一：数据库初始化

```bash
mysql -u root -p
```

```sql
CREATE DATABASE receipt_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'receipt_admin'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON receipt_manager.* TO 'receipt_admin'@'localhost';
FLUSH PRIVILEGES;
USE receipt_manager;
SOURCE /path/to/init.sql;
```

### 步骤二：后端部署

```bash
# 1. 上传代码到服务器
git clone <repo-url> /opt/sites/receipt-manager
cd /opt/sites/receipt-manager/server

# 2. 安装依赖
npm install --production

# 3. 配置环境变量
cp .env.example .env
vim .env
# 修改 DB_PASSWORD、JWT_SECRET、CLIENT_URL 等

# 4. 创建上传目录
mkdir -p uploads

# 5. 用 PM2 启动（cluster 模式）
pm2 start src/server.js --name receipt-manager -i max
pm2 save
pm2 startup  # 开机自启
```

**`.env` 配置项**

```ini
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=receipt_admin
DB_PASSWORD=your_strong_password
DB_NAME=receipt_manager
JWT_SECRET=your_random_32_char_string
CLIENT_URL=https://your-domain.com
MAX_UPLOAD_SIZE=10
```

### 步骤三：前端构建

```bash
cd client

# Web 端
npm install
# 修改 .env 中的 VITE_API_BASE 为你的域名
npm run build
# 产物：client/dist/

# 移动端（可选）
npm run build:mobile
# 产物：client/dist-mobile/
```

**前端产物部署方式二选一**：

- **方式 A（推荐）**：将 `client/dist/` 上传到服务器，由 Express 静态托管（已配置在 server.js）
- **方式 B**：将 `client/dist/` 上传到 Nginx 静态目录，Nginx 直接服务前端，仅 `/api` 反代到 Node

### 步骤四：Nginx 反向代理

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # 上传文件大小限制
    client_max_body_size 10m;

    # API 反代到 Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件反代
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
    }

    # 前端静态资源（方式 B 才需要）
    location / {
        root /opt/sites/receipt-manager/client/dist;
        try_files $uri $uri/ /index.html;
    }
}

# HTTP 跳转 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 步骤五：验证部署

```bash
# 1. 健康检查
curl https://your-domain.com/api/auth/me
# 应返回 401（未登录）

# 2. PM2 状态
pm2 status

# 3. 日志查看
pm2 logs receipt-manager --lines 50
```

### 移动端 APK 分发

```bash
# 本地打包
cd client && npm run build:mobile && cd ..
cd mobile && npx cap sync android
cd android && ./gradlew assembleDebug

# 产物路径
# mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

将 APK 上传到任意静态资源服务，提供下载链接即可分发。

---

## 本地开发

### 环境要求

- Node.js ≥ 18
- MySQL 8.0（或通过 Docker 启动）
- Android Studio（仅移动端打包需要）

### 启动后端

```bash
cd server
npm install
cp .env.example .env
# 修改 .env 中的 DB 配置
npm run dev
# 启动在 http://localhost:3000
```

### 启动前端

```bash
cd client
npm install
npm run dev
# 启动在 http://localhost:5173（自动代理到后端）
```

### 数据库初始化

```bash
mysql -u root -p < server/init.sql
```

---

## 安全与合规

### 已实施的安全措施

| 措施 | 实现 |
|------|------|
| 密码哈希 | bcrypt（cost factor 10） |
| SQL 注入防护 | 全部使用 Prepared Statements |
| XSS 防护 | React 默认转义 + Helmet CSP 头 |
| CSRF 防护 | JWT Bearer Token（非 Cookie） |
| 限流防暴破 | 15 分钟 300 次 |
| HTTPS 强制 | Nginx 80 → 443 跳转 |
| 安全头 | Helmet（HSTS / X-Frame-Options 等） |
| 文件上传白名单 | 仅图片格式 + 10MB 限制 |
| 用户数据隔离 | 所有查询带 `WHERE user_id = ?` |

### 敏感信息管理

- `.env` 文件绝不入库（见 `.gitignore`）
- JWT_SECRET 使用 32+ 字符随机串
- 数据库密码使用强密码
- 服务器 SSH 使用密钥登录（禁用密码登录更佳）
- 生产环境建议使用 HTTPS 证书（Let's Encrypt 免费）

---

## 许可协议

本项目为私有项目，未开放开源许可。如需使用请联系作者。
