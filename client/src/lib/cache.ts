/**
 * 统一本地缓存工具库
 *
 * 技术选型：localStorage
 * - 数据量小（单条 < 50KB），同步 API 简单高效
 * - WebView 中持久化，关闭应用后仍可读取
 * - IndexedDB 适合 MB 级大数据，本场景 overkill
 *
 * 缓存键设计：c:v1:${userId}:${scope}:${paramHash}
 * - 用户隔离：切换账号不会读到旧用户数据
 * - 页面分桶：home / receipts / analytics / categories
 * - 参数分桶：同页面不同筛选条件各自缓存
 *
 * 失效策略：
 * - TTL 过期（默认 30 分钟，可配置）
 * - DATA_CHANGED_EVENT 事件主动清理
 * - logout 时清空所有用户缓存
 */

const SCHEMA_VERSION = 1;
const DEFAULT_TTL = 30 * 60 * 1000; // 30 分钟

interface CacheEntry<T> {
  v: number; // schema 版本
  ts: number; // 写入时间戳
  data: T;
}

/** 获取当前用户 ID（用于缓存键隔离） */
function getUserId(): string {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?.id || 'anon';
    }
  } catch {
    // 忽略解析失败
  }
  return 'anon';
}

/** 构造带用户隔离的缓存键 */
function buildKey(scope: string, paramHash?: string): string {
  const uid = getUserId();
  return `c:v${SCHEMA_VERSION}:${uid}:${scope}${paramHash ? `:${paramHash}` : ''}`;
}

/**
 * 读取缓存
 * @param scope 业务域（home/receipts/analytics/categories）
 * @param paramHash 可选的参数分桶标识
 * @param ttlMs 过期时间（毫秒），0 表示不过期
 * @returns 命中返回数据，未命中/过期/损坏返回 null
 */
export function loadCache<T>(scope: string, paramHash?: string, ttlMs: number = DEFAULT_TTL): T | null {
  try {
    const key = buildKey(scope, paramHash);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    // schema 版本不匹配 → 视为损坏
    if (entry.v !== SCHEMA_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    // TTL 检查（ttlMs = 0 表示永不过期）
    if (ttlMs > 0 && Date.now() - entry.ts > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    // JSON 解析失败 → 损坏数据，尝试清理
    try {
      localStorage.removeItem(buildKey(scope, paramHash));
    } catch {
      // 忽略
    }
    return null;
  }
}

/**
 * 写入缓存
 * 容错：quota 超限时自动清理当前用户的所有缓存后重试
 */
export function saveCache<T>(scope: string, data: T, paramHash?: string): void {
  try {
    const key = buildKey(scope, paramHash);
    const entry: CacheEntry<T> = { v: SCHEMA_VERSION, ts: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    // quota 超限或其它写入异常 → 清理当前用户旧缓存后重试一次
    try {
      clearUserCache();
      const key = buildKey(scope, paramHash);
      const entry: CacheEntry<T> = { v: SCHEMA_VERSION, ts: Date.now(), data };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // 仍然失败 → 放弃缓存，不影响主流程
      console.warn('[cache] saveCache failed:', err);
    }
  }
}

/** 清除指定 scope 的缓存 */
export function clearCache(scope: string, paramHash?: string): void {
  try {
    localStorage.removeItem(buildKey(scope, paramHash));
  } catch {
    // 忽略
  }
}

/** 清除当前用户的所有缓存（切换账号/退出登录时调用） */
export function clearUserCache(): void {
  const uid = getUserId();
  const prefix = `c:v${SCHEMA_VERSION}:${uid}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // 忽略
    }
  });
}

/**
 * 生成参数哈希（用于同页面不同筛选条件分桶缓存）
 * 输入对象 → 稳定字符串（按 key 排序）
 */
export function hashParams(params: Record<string, string | number | undefined>): string {
  const sortedKeys = Object.keys(params).sort();
  const parts = sortedKeys
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .map((k) => `${k}=${params[k]}`);
  return parts.length > 0 ? parts.join('&') : 'default';
}
