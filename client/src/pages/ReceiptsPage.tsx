import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, X, Loader2 } from 'lucide-react';
import { receiptsApi, categoriesApi } from '@/lib/api';
import { formatDate, DATA_CHANGED_EVENT } from '@/lib/utils';
import { loadCache, saveCache, clearCache, hashParams } from '@/lib/cache';
import type { Receipt, Category, Pagination } from '@/types';
import ReceiptCard from '@/components/ReceiptCard';

interface ReceiptsCacheData {
  receipts: Receipt[];
  pagination: Pagination | null;
}

const RECEIPTS_TTL = 0; // 不过期，由 DATA_CHANGED_EVENT 主动清理

export default function ReceiptsPage() {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // 缓存键按筛选条件 + 分页分桶
  const paramHash = hashParams({ page, search, category_id: selectedCategory, start_date: startDate, end_date: endDate });
  // lazy initializer：首次渲染直接从缓存读取，避免 render 中 setState
  const [initialCache] = useState(() => loadCache<ReceiptsCacheData>('receipts', paramHash, RECEIPTS_TTL));
  const [receipts, setReceipts] = useState<Receipt[]>(() => initialCache?.receipts ?? []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(() => initialCache?.pagination ?? null);
  // 仅在无缓存时显示 loading；有缓存时保留旧数据 + 静默刷新
  const [loading, setLoading] = useState(!initialCache);
  const [refreshing, setRefreshing] = useState(false);

  const loadReceipts = useCallback(async () => {
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (selectedCategory) params.category_id = selectedCategory;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const data = await receiptsApi.list(params);
      setReceipts(data.data);
      setPagination(data.pagination);
      saveCache('receipts', { receipts: data.data, pagination: data.pagination }, paramHash);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, startDate, endDate, paramHash]);

  // 静默刷新：保留旧数据显示
  const silentRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search) params.search = search;
      if (selectedCategory) params.category_id = selectedCategory;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const data = await receiptsApi.list(params);
      setReceipts(data.data);
      setPagination(data.pagination);
      saveCache('receipts', { receipts: data.data, pagination: data.pagination }, paramHash);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, [page, search, selectedCategory, startDate, endDate, paramHash]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // 监听全局数据变更事件（清空所有 receipts 缓存 + 静默刷新当前页）
  useEffect(() => {
    const handleDataChanged = () => {
      // 数据变更时清空所有 receipts 缓存分桶（增删改可能影响任意筛选条件的结果）
      clearCache('receipts');
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
  }, [silentRefresh]);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(console.error);
  }, []);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters = search || selectedCategory || startDate || endDate;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header px-4 pt-12 pb-3">
        <h1 className="text-xl font-bold text-slate-900 mb-3">我的小票</h1>

        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜索商户、单号..."
              className="input-field pl-10 py-2.5 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
              showFilters || hasFilters ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <Filter size={18} />
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-3 card p-4 space-y-3 animate-slide-up">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">分类</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(selectedCategory === cat.id ? '' : cat.id); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? 'text-white'
                        : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                    }`}
                    style={selectedCategory === cat.id ? { backgroundColor: cat.color } : {}}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="input-field py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="input-field py-2 text-sm"
                />
              </div>
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-primary-600 font-medium flex items-center gap-1">
                <X size={14} /> 清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* Receipt list */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary-500" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 text-sm">
              {hasFilters ? '没有找到匹配的小票' : '还没有小票记录'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {receipts.map((r) => (
                <ReceiptCard key={r.id} receipt={r} />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-sm text-slate-500">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
