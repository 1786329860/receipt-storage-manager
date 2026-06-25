export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar_url?: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  category_id: string | null;
  merchant_name: string;
  amount: number;
  discount: number;
  actual_amount: number;
  payment_method: 'cash' | 'wechat' | 'alipay' | 'card' | 'other';
  receipt_date: string;
  receipt_time: string | null;
  order_number: string;
  notes: string;
  image_url: string;
  status: 'pending' | 'checked' | 'archived';
  created_at: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  receipt_count?: number;
  total_spent?: number;
}

export interface AnalyticsOverview {
  totalAmount: number;
  receiptCount: number;
  dailyAvg: number;
  categories: {
    id: string;
    name: string;
    icon: string;
    color: string;
    total: number;
    count: number;
  }[];
  paymentMethods: {
    payment_method: string;
    total: number;
    count: number;
  }[];
  startDate: string;
  endDate: string;
}

export interface MonthlyTrend {
  month: number;
  total: number;
  count: number;
}

export interface DailyTrend {
  date: string;
  total: number;
  count: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const PAYMENT_METHODS: Record<string, { label: string; color: string }> = {
  cash: { label: '现金', color: '#22c55e' },
  wechat: { label: '微信', color: '#07c160' },
  alipay: { label: '支付宝', color: '#1677ff' },
  card: { label: '银行卡', color: '#f59e0b' },
  other: { label: '其他', color: '#6b7280' },
};
