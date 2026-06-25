import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { receiptsApi, assetUrl } from '@/lib/api';
import { formatMoney, formatDate, getPaymentLabel, getStatusLabel, notifyDataChanged } from '@/lib/utils';
import type { Receipt, ReceiptItem } from '@/types';

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<(Receipt & { items: ReceiptItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      receiptsApi.get(id).then(setReceipt).catch(() => navigate('/receipts'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('确定要删除这条小票吗？')) return;
    setDeleting(true);
    try {
      await receiptsApi.delete(id!);
      notifyDataChanged({ type: 'delete' });
      navigate('/receipts');
    } catch {
      alert('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await receiptsApi.update(id!, { status });
      setReceipt((prev) => prev ? { ...prev, status: status as Receipt['status'] } : null);
      notifyDataChanged({ type: 'update' });
    } catch {
      alert('更新失败');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!receipt) return null;

  const statusColors = {
    pending: 'bg-amber-50 text-amber-600 border-amber-200',
    checked: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    archived: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="page-header flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">小票详情</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/add?edit=${id}`)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-primary-600">
            <Edit3 size={18} />
          </button>
          <button onClick={handleDelete} disabled={deleting} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-500">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Amount card */}
        <div className="card p-5 text-center">
          <p className="text-sm text-slate-500 mb-1">实付金额</p>
          <p className="text-3xl font-bold text-primary-600">{formatMoney(receipt.actual_amount)}</p>
          {receipt.discount > 0 && (
            <p className="text-sm text-emerald-500 mt-1">优惠 {formatMoney(receipt.discount)}</p>
          )}
        </div>

        {/* Info card */}
        <div className="card p-4 space-y-3">
          <InfoRow label="商户" value={receipt.merchant_name} />
          <InfoRow label="日期" value={formatDate(receipt.receipt_date) + (receipt.receipt_time ? ` ${receipt.receipt_time.slice(0, 5)}` : '')} />
          <InfoRow label="支付方式" value={getPaymentLabel(receipt.payment_method)} />
          {receipt.category_name && <InfoRow label="分类" value={receipt.category_name} />}
          {receipt.order_number && <InfoRow label="订单号" value={receipt.order_number} />}
          {receipt.notes && <InfoRow label="备注" value={receipt.notes} />}

          {/* Status */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-sm text-slate-500">状态</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColors[receipt.status]}`}>
                {getStatusLabel(receipt.status)}
              </span>
              <select
                value={receipt.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs bg-slate-100 rounded-lg px-2 py-1 border-none"
              >
                <option value="pending">待核对</option>
                <option value="checked">已核对</option>
                <option value="archived">已归档</option>
              </select>
            </div>
          </div>
        </div>

        {/* Image */}
        {receipt.image_url && (
          <div className="card p-4">
            <p className="text-sm font-medium text-slate-500 mb-2">小票图片</p>
            <img src={assetUrl(receipt.image_url)} alt="小票" className="rounded-xl max-h-60 w-full object-contain bg-slate-50" />
          </div>
        )}

        {/* Items */}
        {receipt.items && receipt.items.length > 0 && (
          <div className="card p-4">
            <p className="text-sm font-medium text-slate-500 mb-3">商品明细</p>
            <div className="space-y-2">
              {receipt.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-700 flex-1">{item.name}</span>
                  <span className="text-xs text-slate-400 mx-2">x{item.quantity}</span>
                  <span className="text-sm font-medium text-slate-900">{formatMoney(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-sm font-medium text-slate-700">合计</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatMoney(receipt.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-900 text-right break-all">{value}</span>
    </div>
  );
}
