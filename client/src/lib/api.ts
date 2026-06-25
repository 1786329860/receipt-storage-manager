const BASE_URL = typeof __MOBILE_API_BASE__ !== 'undefined' ? __MOBILE_API_BASE__ : '';

declare const __MOBILE_API_BASE__: string;

// 导出 BASE_URL 供图片等资源拼接完整 URL
export { BASE_URL };

// 拼接图片等资源的完整 URL（处理相对路径）
export function assetUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('data:')) return url;
  return `${BASE_URL}${url}`;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // GET 请求加时间戳参数，彻底防止 WebView 缓存导致统计数据不更新
  let url = `${BASE_URL}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET') {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_t=${Date.now()}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store', // 防止 WebView 缓存 GET 请求导致统计数据不更新
  });

  if (res.status === 401) {
    // 清除本地凭证并跳转登录页，避免 reload 循环
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
    // 抛出错误但标记为已知错误，调用方可据此静默处理
    const err = new Error('未登录或登录已过期');
    (err as any).silent = true;
    throw err;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

// 上传文件用 FormData
async function uploadFile(path: string, formData: FormData): Promise<{ url: string }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '上传失败');
  return data;
}

// ===== Auth =====
export const authApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: string; username: string; nickname: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, email: string, code: string, nickname?: string) =>
    request<{ token: string; user: { id: string; username: string; nickname: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, code, nickname }),
    }),
  sendCode: (email: string) =>
    request<{ message: string }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  me: () => request<{ id: string; username: string; nickname: string; avatar_url: string }>('/api/auth/me'),
};

// ===== Receipts =====
export const receiptsApi = {
  list: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ data: import('@/types').Receipt[]; pagination: import('@/types').Pagination }>(`/api/receipts?${qs}`);
  },
  get: (id: string) => request<import('@/types').Receipt & { items: import('@/types').ReceiptItem[] }>(`/api/receipts/${id}`),
  create: (data: Record<string, unknown>) =>
    request<import('@/types').Receipt>('/api/receipts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<import('@/types').Receipt>(`/api/receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/receipts/${id}`, { method: 'DELETE' }),
  batchDelete: (ids: string[]) =>
    request<{ deleted: number }>('/api/receipts/batch-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  batchUpdate: (ids: string[], status: string) =>
    request<{ updated: number }>('/api/receipts/batch-update', { method: 'POST', body: JSON.stringify({ ids, status }) }),
};

// ===== Categories =====
export const categoriesApi = {
  list: () => request<import('@/types').Category[]>('/api/categories'),
  create: (data: { name: string; icon?: string; color?: string }) =>
    request<import('@/types').Category>('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; icon: string; color: string; sort_order: number }>) =>
    request<import('@/types').Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/categories/${id}`, { method: 'DELETE' }),
};

// ===== Analytics =====
export const analyticsApi = {
  overview: async (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    const raw = await request<import('@/types').AnalyticsOverview>(`/api/analytics/overview?${qs}`);
    // 规范化返回数据，防止 categories/paymentMethods 为 undefined 导致渲染崩溃
    return {
      ...raw,
      totalAmount: Number(raw?.totalAmount) || 0,
      receiptCount: Number(raw?.receiptCount) || 0,
      dailyAvg: Number(raw?.dailyAvg) || 0,
      categories: Array.isArray(raw?.categories) ? raw.categories : [],
      paymentMethods: Array.isArray(raw?.paymentMethods) ? raw.paymentMethods : [],
    } as import('@/types').AnalyticsOverview;
  },
  monthlyTrend: (year?: number) => {
    const qs = year ? `?year=${year}` : '';
    return request<import('@/types').MonthlyTrend[]>(`/api/analytics/monthly-trend${qs}`);
  },
  dailyTrend: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<import('@/types').DailyTrend[]>(`/api/analytics/daily-trend?${qs}`);
  },
};

// ===== Upload =====
export const uploadApi = {
  image: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return uploadFile('/api/upload', formData);
  },
};
