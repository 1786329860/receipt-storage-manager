export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatMoney(amount: number | string | null | undefined): string {
  // 后端 MySQL decimal/float 通过 JSON 返回时可能是字符串，统一转数值
  const num = Number(amount);
  if (!isFinite(num)) return '¥0.00';
  return `¥${num.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays === 2) return '前天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

export function getPaymentLabel(method: string): string {
  const map: Record<string, string> = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    card: '银行卡',
    other: '其他',
  };
  return map[method] || method;
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待核对',
    checked: '已核对',
    archived: '已归档',
  };
  return map[status] || status;
}

export function getMonthRange(): { start_date: string; end_date: string } {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { start_date: start, end_date: end };
}

export function getTodayStr(): string {
  // 用本地日期，避免 toISOString 在 UTC+N 时区凌晨返回昨天
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 全局数据变更事件：小票增删改后通知统计页/列表页刷新
export const DATA_CHANGED_EVENT = 'receipts:data-changed';

export function notifyDataChanged(detail?: { type?: 'create' | 'update' | 'delete' }) {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: detail || {} }));
}
