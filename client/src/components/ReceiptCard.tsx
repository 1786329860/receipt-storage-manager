import { Link } from 'react-router-dom';
import { formatMoney, formatDate, getPaymentLabel } from '@/lib/utils';
import type { Receipt } from '@/types';

interface Props {
  receipt: Receipt;
  showDate?: boolean;
}

export default function ReceiptCard({ receipt, showDate = true }: Props) {
  const statusColors = {
    pending: 'bg-amber-50 text-amber-600',
    checked: 'bg-emerald-50 text-emerald-600',
    archived: 'bg-slate-100 text-slate-500',
  };
  const statusLabels = {
    pending: '待核对',
    checked: '已核对',
    archived: '已归档',
  };

  return (
    <Link
      to={`/receipts/${receipt.id}`}
      className="card p-4 flex items-center gap-3.5 active:bg-slate-50 transition-colors block"
    >
      {/* Category icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ backgroundColor: receipt.category_color || '#6b7280' }}
      >
        {receipt.category_name ? receipt.category_name[0] : '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-slate-900 truncate text-[15px]">{receipt.merchant_name}</h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${statusColors[receipt.status]}`}>
            {statusLabels[receipt.status]}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {receipt.category_name && <span>{receipt.category_name}</span>}
          {receipt.category_name && showDate && <span>·</span>}
          {showDate && <span>{formatDate(receipt.receipt_date)}</span>}
          {receipt.payment_method !== 'other' && (
            <>
              <span>·</span>
              <span>{getPaymentLabel(receipt.payment_method)}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="font-bold text-slate-900 text-[15px]">{formatMoney(receipt.actual_amount)}</p>
        {receipt.discount > 0 && (
          <p className="text-[11px] text-emerald-500">优惠 {formatMoney(receipt.discount)}</p>
        )}
      </div>
    </Link>
  );
}
