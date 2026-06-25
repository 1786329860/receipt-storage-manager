import { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, PieChart, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { analyticsApi } from '@/lib/api';
import { formatMoney, DATA_CHANGED_EVENT } from '@/lib/utils';
import { loadCache, saveCache, clearCache, hashParams } from '@/lib/cache';
import type { AnalyticsOverview, MonthlyTrend, DailyTrend } from '@/types';

interface AnalyticsCacheData {
  overview: AnalyticsOverview | null;
  monthlyTrend: MonthlyTrend[];
  dailyTrend: DailyTrend[];
}

const ANALYTICS_TTL = 30 * 60 * 1000; // 30 分钟

export default function AnalyticsPage() {
  // 初始化：优先从 localStorage 读取缓存数据，避免每次进入都显示加载动画
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [endDate, setEndDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  const [year] = useState(new Date().getFullYear());

  // 缓存键按日期范围分桶
  const paramHash = hashParams({ start_date: startDate, end_date: endDate, year });
  const initialCache = useRef<AnalyticsCacheData | null>(loadCache<AnalyticsCacheData>('analytics', paramHash, ANALYTICS_TTL));

  const [overview, setOverview] = useState<AnalyticsOverview | null>(initialCache.current?.overview ?? null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>(initialCache.current?.monthlyTrend ?? []);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>(initialCache.current?.dailyTrend ?? []);
  // 仅在无缓存时显示全屏加载；有缓存时保留旧数据，后台静默刷新
  const [loading, setLoading] = useState(!initialCache.current);
  const [refreshing, setRefreshing] = useState(false);

  const firstLoadRef = useRef(true);

  useEffect(() => {
    // 日期变化时强制全屏加载（用户主动切换日期范围）
    if (!firstLoadRef.current) {
      setLoading(true);
    }
    firstLoadRef.current = false;
    loadData();
  }, [startDate, endDate]);

  // 页面重新可见 / 数据变更时静默刷新（保留旧数据，不显示全屏 loading）
  useEffect(() => {
    const handleFocus = () => {
      silentRefresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        silentRefresh();
      }
    };
    const handleDataChanged = () => {
      // 数据变更时清空对应缓存，强制拉取最新数据
      clearCache('analytics', paramHash);
      silentRefresh();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, [startDate, endDate, paramHash]);

  async function loadData() {
    try {
      const [ov, mt, dt] = await Promise.all([
        analyticsApi.overview({ start_date: startDate, end_date: endDate }),
        analyticsApi.monthlyTrend(year),
        analyticsApi.dailyTrend({ start_date: startDate, end_date: endDate }),
      ]);
      setOverview(ov);
      setMonthlyTrend(mt);
      setDailyTrend(dt);
      // 写入本地缓存
      saveCache('analytics', { overview: ov, monthlyTrend: mt, dailyTrend: dt }, paramHash);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 静默刷新：保留旧数据显示，后台拉取新数据
  async function silentRefresh() {
    setRefreshing(true);
    try {
      const [ov, mt, dt] = await Promise.all([
        analyticsApi.overview({ start_date: startDate, end_date: endDate }),
        analyticsApi.monthlyTrend(year),
        analyticsApi.dailyTrend({ start_date: startDate, end_date: endDate }),
      ]);
      setOverview(ov);
      setMonthlyTrend(mt);
      setDailyTrend(dt);
      saveCache('analytics', { overview: ov, monthlyTrend: mt, dailyTrend: dt }, paramHash);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }

  const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  const pieData = overview?.categories?.map((c) => ({
    name: c.name,
    value: c.total,
    color: c.color,
  })) || [];

  const barData = monthlyTrend.map((m) => ({
    name: monthLabels[m.month - 1],
    total: m.total,
  }));

  const lineData = dailyTrend.map((d) => ({
    name: d.date.slice(5),
    total: d.total,
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header px-4 pt-12 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-900">消费统计</h1>
          {refreshing && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 size={12} className="animate-spin" />
              <span>更新中</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field py-2 text-sm flex-1"
          />
          <span className="text-slate-400 text-sm">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field py-2 text-sm flex-1"
          />
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">总支出</p>
            <p className="text-base font-bold text-slate-900">{formatMoney(overview?.totalAmount || 0)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">笔数</p>
            <p className="text-base font-bold text-slate-900">{overview?.receiptCount || 0}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">日均</p>
            <p className="text-base font-bold text-slate-900">{formatMoney(overview?.dailyAvg || 0)}</p>
          </div>
        </div>

        {/* Monthly bar chart */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary-600" />
            <h2 className="font-bold text-slate-900 text-sm">{year}年月度趋势</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => `¥${v}`} />
                <Tooltip formatter={(v: number) => [formatMoney(v), '支出']} />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily trend line chart */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-sm">每日趋势</h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => `¥${v}`} />
                <Tooltip formatter={(v: number) => [formatMoney(v), '支出']} />
                <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category pie chart */}
        {pieData.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={18} className="text-amber-600" />
              <h2 className="font-bold text-slate-900 text-sm">分类占比</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2}>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                  </RPieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {pieData.map((item) => {
                  const totalNum = Number(overview?.totalAmount) || 0;
                  const itemVal = Number(item.value) || 0;
                  const pct = totalNum > 0 ? ((itemVal / totalNum) * 100).toFixed(1) : '0';
                  return (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-slate-600 flex-1 truncate">{item.name}</span>
                      <span className="text-xs font-medium text-slate-900">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Category detail list */}
        {overview && overview.categories && overview.categories.length > 0 && (
          <div className="card p-4">
            <h2 className="font-bold text-slate-900 text-sm mb-3">分类明细</h2>
            <div className="space-y-3">
              {overview.categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: cat.color }}>
                    {cat.name ? cat.name[0] : '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                      <span className="text-sm font-bold text-slate-900">{formatMoney(cat.total)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{cat.count} 笔</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment methods */}
        {overview && overview.paymentMethods && overview.paymentMethods.length > 0 && (
          <div className="card p-4">
            <h2 className="font-bold text-slate-900 text-sm mb-3">支付方式</h2>
            <div className="space-y-2">
              {overview.paymentMethods.map((pm) => {
                const labels: Record<string, string> = { cash: '现金', wechat: '微信', alipay: '支付宝', card: '银行卡', other: '其他' };
                const colors: Record<string, string> = { cash: '#22c55e', wechat: '#07c160', alipay: '#1677ff', card: '#f59e0b', other: '#6b7280' };
                return (
                  <div key={pm.payment_method} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[pm.payment_method] || '#6b7280' }} />
                      <span className="text-sm text-slate-600">{labels[pm.payment_method] || pm.payment_method}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-slate-900">{formatMoney(pm.total)}</span>
                      <span className="text-[11px] text-slate-400 ml-2">{pm.count}笔</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
