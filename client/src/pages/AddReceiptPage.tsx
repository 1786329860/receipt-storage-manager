import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Camera, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { receiptsApi, categoriesApi, uploadApi, assetUrl } from '@/lib/api';
import { getTodayStr, formatMoney, notifyDataChanged } from '@/lib/utils';
import type { Category, ReceiptItem } from '@/types';
import ImagePreview from '@/components/ImagePreview';

export default function AddReceiptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEdit = !!editId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  // 图片选择菜单（ActionSheet）
  const [showImagePicker, setShowImagePicker] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // 图片预览
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('other');
  const [receiptDate, setReceiptDate] = useState(getTodayStr());
  const [receiptTime, setReceiptTime] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(console.error);
  }, []);

  // 编辑模式：加载已有数据填充表单
  useEffect(() => {
    if (!editId) return;
    receiptsApi.get(editId).then((data) => {
      setMerchantName(data.merchant_name || '');
      setAmount(String(data.amount || ''));
      setDiscount(String(data.discount || ''));
      setPaymentMethod(data.payment_method || 'other');
      setReceiptDate(data.receipt_date || getTodayStr());
      setReceiptTime(data.receipt_time || '');
      setOrderNumber(data.order_number || '');
      setNotes(data.notes || '');
      setCategoryId(data.category_id || '');
      setImageUrl(data.image_url || '');
      if (data.items && data.items.length > 0) {
        setItems(data.items);
        setShowItems(true);
      }
    }).catch((err) => {
      console.error(err);
      alert('加载小票数据失败');
      navigate(-1);
    }).finally(() => setLoadingData(false));
  }, [editId]);

  // ActionSheet 打开时标记 overlay，供 Android 返回键关闭
  useEffect(() => {
    if (!showImagePicker) return;
    (window as any).__hasOverlay = true;
    const onOverlayClose = () => setShowImagePicker(false);
    window.addEventListener('overlay:close', onOverlayClose);
    return () => {
      (window as any).__hasOverlay = false;
      window.removeEventListener('overlay:close', onOverlayClose);
    };
  }, [showImagePicker]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadApi.image(file);
      setImageUrl(data.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0, subtotal: 0 }]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index] as unknown as Record<string, unknown>;
    item[field] = value;
    if (field === 'quantity' || field === 'price') {
      newItems[index].subtotal = newItems[index].quantity * newItems[index].price;
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName.trim()) return alert('请填写商户名称');
    if (!amount || parseFloat(amount) <= 0) return alert('请填写正确金额');

    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        merchant_name: merchantName.trim(),
        amount: parseFloat(amount),
        discount: parseFloat(discount) || 0,
        payment_method: paymentMethod,
        receipt_date: receiptDate,
        receipt_time: receiptTime || null,
        order_number: orderNumber.trim(),
        notes: notes.trim(),
        category_id: categoryId || null,
        image_url: imageUrl,
      };
      if (items.length > 0) {
        data.items = items.filter((i) => i.name.trim());
      }
      if (isEdit && editId) {
        await receiptsApi.update(editId, data);
        notifyDataChanged({ type: 'update' });
      } else {
        await receiptsApi.create(data);
        notifyDataChanged({ type: 'create' });
      }
      navigate('/receipts');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const actualAmount = Math.max(0, parseFloat(amount || '0') - parseFloat(discount || '0'));

  const paymentOptions = [
    { value: 'wechat', label: '微信' },
    { value: 'alipay', label: '支付宝' },
    { value: 'card', label: '银行卡' },
    { value: 'cash', label: '现金' },
    { value: 'other', label: '其他' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="page-header flex items-center gap-3 px-4 pt-12 pb-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">{isEdit ? '编辑小票' : '记一笔'}</h1>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary-500" />
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="px-4 mt-4 space-y-4">
        {/* 金额区域 */}
        <div className="card p-5">
          <label className="text-sm font-medium text-slate-500 mb-2 block">金额</label>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-400">¥</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-3xl font-bold text-slate-900 w-full bg-transparent"
              required
            />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400">优惠</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="input-field py-2 text-sm mt-1"
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">实付</p>
              <p className="text-xl font-bold text-primary-600">{formatMoney(actualAmount)}</p>
            </div>
          </div>
        </div>

        {/* 基本信息 */}
        <div className="card p-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-500 mb-1 block">商户名称 *</label>
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="例如：星巴克、美团外卖"
              className="input-field"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-500 mb-1 block">日期 *</label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-500 mb-1 block">时间</label>
              <input
                type="time"
                value={receiptTime}
                onChange={(e) => setReceiptTime(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-500 mb-1.5 block">支付方式</label>
            <div className="flex flex-wrap gap-2">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    paymentMethod === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 分类选择 */}
        <div className="card p-4">
          <label className="text-sm font-medium text-slate-500 mb-2 block">分类</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(categoryId === cat.id ? '' : cat.id)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  categoryId === cat.id ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                }`}
                style={categoryId === cat.id ? { backgroundColor: cat.color } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 图片上传 */}
        <div className="card p-4">
          <label className="text-sm font-medium text-slate-500 mb-2 block">小票图片</label>
          {imageUrl ? (
            <div className="relative inline-block">
              <img
                src={assetUrl(imageUrl)}
                alt="小票"
                onClick={() => setPreviewImage(assetUrl(imageUrl))}
                className="max-h-40 rounded-xl cursor-zoom-in active:opacity-90 transition-opacity"
              />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center z-10"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowImagePicker(true)}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl w-full hover:border-primary-300 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin text-slate-400" />
              ) : (
                <Camera size={20} className="text-slate-400" />
              )}
              <span className="text-sm text-slate-500">{uploading ? '上传中...' : '拍照或选择图片'}</span>
            </button>
          )}
          {/* 隐藏的拍照 input（capture=environment 直接调起后置摄像头） */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
          />
          {/* 隐藏的相册 input（不带 capture，可选择设备上的图片） */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* 图片选择 ActionSheet */}
        {showImagePicker && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setShowImagePicker(false)}
          >
            <div
              className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-8 animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <h3 className="text-base font-bold text-slate-900 text-center mb-4">选择图片</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowImagePicker(false);
                    // 重置 value 确保相同文件可重复选择
                    if (cameraInputRef.current) cameraInputRef.current.value = '';
                    cameraInputRef.current?.click();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                >
                  <Camera size={22} className="text-primary-600" />
                  <span className="text-sm font-medium text-slate-700">拍照</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImagePicker(false);
                    if (galleryInputRef.current) galleryInputRef.current.value = '';
                    galleryInputRef.current?.click();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                >
                  <ImageIcon size={22} className="text-emerald-600" />
                  <span className="text-sm font-medium text-slate-700">从相册选择</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImagePicker(false)}
                  className="flex items-center justify-center w-full px-4 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors mt-2"
                >
                  <span className="text-sm font-medium text-slate-600">取消</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 商品明细 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-500">商品明细</label>
            <button
              type="button"
              onClick={() => setShowItems(!showItems)}
              className="text-sm text-primary-600 font-medium"
            >
              {showItems ? '收起' : '展开'}
            </button>
          </div>
          {showItems && (
            <div className="space-y-2 animate-slide-up">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(i, 'name', e.target.value)}
                    placeholder="商品名"
                    className="flex-1 bg-transparent text-sm py-1 px-2"
                  />
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 0)}
                    placeholder="数量"
                    className="w-14 bg-white border border-slate-200 rounded-lg text-sm py-1 px-2 text-center"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={item.price || ''}
                    onChange={(e) => updateItem(i, 'price', parseFloat(e.target.value) || 0)}
                    placeholder="单价"
                    className="w-20 bg-white border border-slate-200 rounded-lg text-sm py-1 px-2 text-center"
                  />
                  <button type="button" onClick={() => removeItem(i)} className="text-red-400 p-1">
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-sm text-primary-600 font-medium py-2"
              >
                <Plus size={16} /> 添加商品
              </button>
            </div>
          )}
        </div>

        {/* 其他信息 */}
        <div className="card p-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-500 mb-1 block">订单号</label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="选填"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-500 mb-1 block">备注</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="选填"
              rows={2}
              className="input-field resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3.5 text-base mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" /> 保存中...
            </span>
          ) : '保存'}
        </button>
      </form>
      )}

      {/* 图片预览 */}
      {previewImage && (
        <ImagePreview
          images={[previewImage]}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
