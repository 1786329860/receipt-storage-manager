-- ============================================
-- 小票收纳小管家 - MySQL 数据库初始化脚本
-- ============================================
-- 使用方法（在 MySQL 中执行）：
-- 1. CREATE DATABASE receipt_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 2. CREATE USER 'receipt_admin'@'localhost' IDENTIFIED BY '你的密码';
-- 3. GRANT ALL PRIVILEGES ON receipt_manager.* TO 'receipt_admin'@'localhost';
-- 4. FLUSH PRIVILEGES;
-- 5. USE receipt_manager;
-- 6. 执行下面的建表语句

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `nickname` VARCHAR(100) DEFAULT '',
  `email` VARCHAR(100) DEFAULT '',
  `avatar_url` VARCHAR(500) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分类表
CREATE TABLE IF NOT EXISTS `categories` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `icon` VARCHAR(50) DEFAULT 'Tag',
  `color` VARCHAR(7) DEFAULT '#6366f1',
  `sort_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_categories_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 小票主表
CREATE TABLE IF NOT EXISTS `receipts` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) DEFAULT NULL,
  `merchant_name` VARCHAR(200) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `discount` DECIMAL(12,2) DEFAULT 0.00,
  `actual_amount` DECIMAL(12,2) NOT NULL,
  `payment_method` ENUM('cash','wechat','alipay','card','other') DEFAULT 'other',
  `receipt_date` DATE NOT NULL,
  `receipt_time` TIME DEFAULT NULL,
  `order_number` VARCHAR(100) DEFAULT '',
  `notes` TEXT,
  `image_url` VARCHAR(500) DEFAULT '',
  `status` ENUM('pending','checked','archived') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_receipt_date` (`receipt_date`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_method` (`payment_method`),
  CONSTRAINT `fk_receipts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_receipts_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 小票明细表
CREATE TABLE IF NOT EXISTS `receipt_items` (
  `id` CHAR(36) NOT NULL,
  `receipt_id` CHAR(36) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `quantity` INT DEFAULT 1,
  `price` DECIMAL(12,2) NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_receipt_id` (`receipt_id`),
  CONSTRAINT `fk_items_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认分类模板（用户注册时触发）
-- 注意：默认分类由后端代码在用户注册时自动插入

SET FOREIGN_KEY_CHECKS = 1;
