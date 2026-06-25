import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronRight, Shield, Palette, FolderOpen, Plus, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { categoriesApi } from '@/lib/api';
import type { Category } from '@/types';
import { useEffect } from 'react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCatManage, setShowCatManage] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(console.error);
  }, []);

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      navigate('/login');
    }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setLoading(true);
    try {
      const cat = await categoriesApi.create({ name: newCatName.trim(), color: newCatColor });
      setCategories([...categories, cat]);
      setNewCatName('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败');
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`确定删除分类"${name}"吗？该分类下的小票将变为无分类。`)) return;
    try {
      await categoriesApi.delete(id);
      setCategories(categories.filter((c) => c.id !== id));
    } catch {
      alert('删除失败');
    }
  };

  const presetColors = ['#6366f1', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#8b5cf6', '#ef4444', '#22c55e'];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white px-5 pt-14 pb-8 rounded-b-3xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{user?.nickname || user?.username}</h1>
            <p className="text-primary-200 text-sm">@{user?.username}</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-3">
        {/* Category management */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowCatManage(!showCatManage)}
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-slate-50"
          >
            <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
              <FolderOpen size={18} className="text-primary-600" />
            </div>
            <span className="flex-1 font-medium text-slate-900">分类管理</span>
            <ChevronRight size={18} className={`text-slate-400 transition-transform ${showCatManage ? 'rotate-90' : ''}`} />
          </button>

          {showCatManage && (
            <div className="px-4 pb-4 border-t border-slate-100 pt-3 animate-slide-up">
              {/* Existing categories */}
              <div className="space-y-2 mb-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 py-1.5">
                    <div className="w-6 h-6 rounded-lg" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm text-slate-700">{cat.name}</span>
                    <span className="text-xs text-slate-400">{cat.receipt_count || 0}笔</span>
                    <button
                      onClick={() => deleteCategory(cat.id, cat.name)}
                      className="text-red-400 p-1 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="新分类名称"
                  className="input-field py-2 text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">颜色：</span>
                  <div className="flex gap-1.5">
                    {presetColors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={addCategory}
                  disabled={loading || !newCatName.trim()}
                  className="btn-primary w-full py-2 text-sm flex items-center justify-center gap-1"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  添加分类
                </button>
              </div>
            </div>
          )}
        </div>

        {/* About */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-emerald-600" />
            </div>
            <span className="flex-1 font-medium text-slate-900">版本</span>
            <span className="text-sm text-slate-400">v2.0.0</span>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="card flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-red-50"
        >
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
            <LogOut size={18} className="text-red-500" />
          </div>
          <span className="flex-1 font-medium text-red-500">退出登录</span>
        </button>
      </div>
    </div>
  );
}
