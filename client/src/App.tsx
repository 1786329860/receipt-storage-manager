import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import ReceiptsPage from '@/pages/ReceiptsPage';
import AddReceiptPage from '@/pages/AddReceiptPage';
import ReceiptDetailPage from '@/pages/ReceiptDetailPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import SettingsPage from '@/pages/SettingsPage';
import BottomNav from '@/components/BottomNav';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">加载中...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { init, loading } = useAuth();

  useEffect(() => {
    init();
  }, []);

  // 注册 Android 物理返回键监听
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | null = null;
    CapacitorApp.addListener('backButton', () => {
      // 1. 有弹窗（图片预览/ActionSheet）打开时，先关闭弹窗
      if ((window as any).__hasOverlay) {
        window.dispatchEvent(new CustomEvent('overlay:close'));
        return;
      }

      // 2. 获取当前 hash 路径
      const hash = window.location.hash.replace(/^#/, '') || '/';

      // 一级页面（底部导航栏页面 + 登录页），退出应用
      const primaryRoutes = ['/', '/receipts', '/analytics', '/settings', '/login'];
      const isPrimary = primaryRoutes.some(r => hash === r || hash.startsWith(r + '?'));

      if (isPrimary) {
        CapacitorApp.exitApp();
      } else {
        // 二级页面，返回上一页
        if (window.history.length > 1) {
          window.history.back();
        } else {
          // 无历史记录，回到首页
          window.location.hash = '#/';
        }
      }
    }).then(h => { listenerHandle = h; });

    return () => {
      listenerHandle?.remove();
    };
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/receipts"
          element={
            <ProtectedRoute>
              <ReceiptsPage />
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add"
          element={
            <ProtectedRoute>
              <AddReceiptPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/receipts/:id"
          element={
            <ProtectedRoute>
              <ReceiptDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
              <BottomNav />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
