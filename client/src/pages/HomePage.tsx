import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Receipt as ReceiptIcon, Calendar, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { analyticsApi, receiptsApi } from '@/lib/api';
import { formatMoney, getMonthRange, DATA_CHANGED_EVENT } from '@/lib/utils';
import { loadCache, saveCache, clearCache } from '@/lib/cache';
import type { AnalyticsOverview, Receipt } from '@/types';
import ReceiptCard from '@/components/ReceiptCard';

interface HomeCacheData {
  overview: AnalyticsOverview | null;
  recentReceipts: Receipt[];
}

const HOME_TTL = 30 * 60 * 1000; // 30 分钟

export default function HomePage() {
  // 优先读取缓存，避免每次进入都显示骨架屏
  const initialCache = useRef<HomeCacheData | null>(loadCache<HomeCacheData>('home', undefined, HOME_TTL));
  const [overview, setOverview] = useState<AnalyticsOverview | null>(initialCache.current?.overview ?? null);
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>(initialCache.current?.recentReceipts ?? []);
  const [loading, setLoading] = useState(!initialCache.current);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // 监听全局数据变更事件（小票增删改后清空缓存 + 静默刷新）
  useEffect(() => {
    const handleDataChanged = () => {
      clearCache('home');
      silentRefresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        silentRefresh();
      }
    };
    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  async function loadData() {
    try {
      const range = getMonthRange();
      // allSettled: 一个接口失败不影响另一个，避免整页空白
      const [ovRes, rcRes] = await Promise.allSettled([
        analyticsApi.overview(range),
        receiptsApi.list({ limit: '5' }),
      ]);
      // 仅在成功时更新，失败时保留缓存/旧数据
      if (ovRes.status === 'fulfilled') {
        setOverview(ovRes.value);
      }
      if (rcRes.status === 'fulfilled') {
        setRecentReceipts(rcRes.value.data);
      }
      // 两个都成功才缓存，避免缓存半空数据
      if (ovRes.status === 'fulfilled' && rcRes.status === 'fulfilled') {
        saveCache('home', { overview: ovRes.value, recentReceipts: rcRes.value.data });
      }
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
      const range = getMonthRange();
      const [ovRes, rcRes] = await Promise.allSettled([
        analyticsApi.overview(range),
        receiptsApi.list({ limit: '5' }),
      ]);
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value);
      if (rcRes.status === 'fulfilled') setRecentReceipts(rcRes.value.data);
      if (ovRes.status === 'fulfilled' && rcRes.status === 'fulfilled') {
        saveCache('home', { overview: ovRes.value, recentReceipts: rcRes.value.data });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }

  const now = new Date();
  const monthStr = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  if (loading) {
    return (
      <div className="page-container">
        <div className="px-4 pt-14 pb-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
              <div className="h-8 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white px-5 pt-14 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-primary-200 text-sm">{monthStr}</p>
            <h1 className="text-xl font-bold mt-0.5">消费概览</h1>
          </div>
          <div className="flex items-center gap-2">
            {refreshing && (
              <div className="flex items-center gap-1 text-xs text-primary-200">
                <Loader2 size={12} className="animate-spin" />
                <span>更新中</span>
              </div>
            )}
            <Link to="/add" className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center active:bg-white/25">
              <Plus size={22} />
            </Link>
          </div>
        </div>

        {/* Main stat */}
        <div className="text-center">
          <p className="text-primary-200 text-xs mb-1">本月总支出</p>
          <p className="text-4xl font-bold tracking-tight">
            {formatMoney(overview?.totalAmount || 0)}
          </p>
        </div>

        {/* Sub stats */}
        <div className="flex items-center justify-around mt-6">
          <div className="text-center">
            <div className="flex items-center gap-1 text-primary-200 text-xs mb-1">
              <ReceiptIcon size={14} />
              <span>笔数</span>
            </div>
            <p className="text-lg font-bold">{overview?.receiptCount || 0}</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <div className="flex items-center gap-1 text-primary-200 text-xs mb-1">
              <Calendar size={14} />
              <span>日均</span>
            </div>
            <p className="text-lg font-bold">{formatMoney(overview?.dailyAvg || 0)}</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <div className="flex items-center gap-1 text-primary-200 text-xs mb-1">
              <TrendingUp size={14} />
              <span>分类</span>
            </div>
            <p className="text-lg font-bold">{overview?.categories?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-6">
        {/* Top categories */}
        {overview && overview.categories && overview.categories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900">分类排行</h2>
              <Link to="/analytics" className="text-sm text-primary-600 flex items-center gap-0.5">
                详情 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="card p-4 space-y-3">
              {overview.categories.slice(0, 4).map((cat) => {
                const pct = overview.totalAmount > 0 ? (cat.total / overview.totalAmount) * 100 : 0;
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.name ? cat.name[0] : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 truncate">{cat.name}</span>
                        <span className="text-sm font-bold text-slate-900">{formatMoney(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent receipts */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">最近小票</h2>
            <Link to="/receipts" className="text-sm text-primary-600 flex items-center gap-0.5">
              全部 <ChevronRight size={16} />
            </Link>
          </div>

          {recentReceipts.length === 0 ? (
            <div className="card p-8 text-center">
              <ReceiptIcon size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm mb-4">还没有小票记录</p>
              <Link to="/add" className="btn-primary inline-flex items-center gap-1.5">
                <Plus size={18} /> 记一笔
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentReceipts.map((receipt) => (
                <ReceiptCard key={receipt.id} receipt={receipt} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
