import { useState, useEffect, useRef, useCallback, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImagePreviewProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

interface TouchState {
  // 单指拖拽起点
  startX: number;
  startY: number;
  // 双指捏合初始距离
  initialDistance: number;
  initialScale: number;
  // 双指中心点
  centerX: number;
  centerY: number;
  // 平移起点（相对于图片中心）
  startOffsetX: number;
  startOffsetY: number;
  // 是否在拖拽中
  dragging: boolean;
  // 触摸开始时间
  startTime: number;
  // 是否多指
  multiTouch: boolean;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

export default function ImagePreview({ images, initialIndex = 0, onClose }: ImagePreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transition, setTransition] = useState(true);
  const touchRef = useRef<TouchState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 最后一次 tap 时间，用于检测双击
  const lastTapRef = useRef<number>(0);

  // 重置变换状态
  const resetTransform = useCallback(() => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  // 切换到指定索引
  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= images.length) return;
    setTransition(true);
    setCurrentIndex(idx);
    resetTransform();
    setLoading(true);
  }, [images.length, resetTransform]);

  // 关闭
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // 计算两点距离
  const getDistance = (t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 计算两点中点
  const getCenter = (t1: Touch, t2: Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  // 限制偏移范围，防止图片滑出视口
  const clampOffset = (sx: number, sy: number, sc: number) => {
    if (!containerRef.current) return { x: sx, y: sy };
    const rect = containerRef.current.getBoundingClientRect();
    const maxOffsetX = ((sc - 1) * rect.width) / 2;
    const maxOffsetY = ((sc - 1) * rect.height) / 2;
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, sx)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, sy)),
    };
  };

  // touchstart
  const handleTouchStart = (e: React.TouchEvent) => {
    const touches = e.touches;
    setTransition(false); // 拖拽时关闭过渡动画
    const now = Date.now();

    if (touches.length === 1) {
      const t = touches[0];
      // 检测双击（300ms 内两次 tap）
      if (now - lastTapRef.current < 300) {
        // 双击切换缩放
        setTransition(true);
        if (scale > 1.5) {
          setScale(1);
          setOffsetX(0);
          setOffsetY(0);
        } else {
          setScale(DOUBLE_TAP_SCALE);
          // 以点击位置为中心放大
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const cx = t.clientX - rect.left - rect.width / 2;
            const cy = t.clientY - rect.top - rect.height / 2;
            const newScale = DOUBLE_TAP_SCALE;
            const clamped = clampOffset(-cx * (newScale - 1), -cy * (newScale - 1), newScale);
            setOffsetX(clamped.x);
            setOffsetY(clamped.y);
          }
        }
        lastTapRef.current = 0; // 重置，避免三击误判
        return;
      }
      lastTapRef.current = now;

      touchRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        initialDistance: 0,
        initialScale: scale,
        centerX: 0,
        centerY: 0,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        dragging: true,
        startTime: now,
        multiTouch: false,
      };
    } else if (touches.length === 2) {
      // 双指捏合开始
      const dist = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      touchRef.current = {
        startX: center.x,
        startY: center.y,
        initialDistance: dist,
        initialScale: scale,
        centerX: center.x,
        centerY: center.y,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        dragging: false,
        startTime: now,
        multiTouch: true,
      };
    }
  };

  // touchmove
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const touches = e.touches;

    if (touches.length === 1 && touchRef.current.dragging && !touchRef.current.multiTouch) {
      // 单指拖拽
      const t = touches[0];
      const dx = t.clientX - touchRef.current.startX;
      const dy = t.clientY - touchRef.current.startY;

      if (scale > 1) {
        // 放大状态下平移
        const clamped = clampOffset(
          touchRef.current.startOffsetX + dx,
          touchRef.current.startOffsetY + dy,
          scale
        );
        setOffsetX(clamped.x);
        setOffsetY(clamped.y);
      } else {
        // scale=1 时左右滑动切换图片（仅水平）
        // 直接更新 offset 用于视觉反馈，松手时判断
        setOffsetX(dx);
        setOffsetY(0);
      }
    } else if (touches.length === 2 && touchRef.current.multiTouch) {
      // 双指捏合缩放
      e.preventDefault(); // 阻止页面缩放
      const dist = getDistance(touches[0], touches[1]);
      const ratio = dist / touchRef.current.initialDistance;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchRef.current.initialScale * ratio));
      setScale(newScale);
      // 缩放回 1 时重置偏移
      if (newScale <= 1) {
        setOffsetX(0);
        setOffsetY(0);
      }
    }
  };

  // touchend
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    setTransition(true);

    const wasMultiTouch = touchRef.current.multiTouch;
    const elapsed = Date.now() - touchRef.current.startTime;
    const startOffsetX = touchRef.current.startOffsetX;

    if (!wasMultiTouch && scale <= 1) {
      // scale=1 时判断左右滑动切换
      if (Math.abs(offsetX) > 80 && elapsed < 500) {
        if (offsetX > 0) {
          // 右滑 → 上一张
          if (currentIndex > 0) {
            goTo(currentIndex - 1);
          } else {
            setOffsetX(0); // 第一张，回弹
          }
        } else {
          // 左滑 → 下一张
          if (currentIndex < images.length - 1) {
            goTo(currentIndex + 1);
          } else {
            setOffsetX(0); // 最后一张，回弹
          }
        }
      } else {
        // 未达到滑动阈值，回弹
        setOffsetX(0);
      }
    } else if (!wasMultiTouch && scale > 1) {
      // 放大状态松手，确保偏移在范围内（clampOffset 已在 move 时处理）
    }

    // 如果还有剩余触点，更新状态
    if (e.touches.length === 1) {
      // 从双指变单指，更新单指起点
      const t = e.touches[0];
      touchRef.current = {
        ...touchRef.current,
        startX: t.clientX,
        startY: t.clientY,
        startOffsetX: offsetX,
        startOffsetY: offsetY,
        multiTouch: false,
        dragging: true,
      };
    } else if (e.touches.length === 0) {
      touchRef.current = null;
    }
  };

  // 鼠标点击关闭（非拖拽）
  const handleBackdropClick = (e: MouseEvent) => {
    // 仅在背景上点击关闭，图片上的点击不关闭
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // 鼠标双击缩放（桌面端兼容）
  const handleDoubleClick = (e: MouseEvent) => {
    setTransition(true);
    if (scale > 1.5) {
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
    } else {
      const newScale = DOUBLE_TAP_SCALE;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const clamped = clampOffset(-cx * (newScale - 1), -cy * (newScale - 1), newScale);
        setScale(newScale);
        setOffsetX(clamped.x);
        setOffsetY(clamped.y);
      } else {
        setScale(newScale);
      }
    }
  };

  // 阻止背景滚动 + 标记全局 overlay 状态（供 Android 返回键监听）
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    (window as any).__hasOverlay = true;
    // 监听返回键关闭事件
    const onOverlayClose = () => onClose();
    window.addEventListener('overlay:close', onOverlayClose);
    return () => {
      document.body.style.overflow = '';
      (window as any).__hasOverlay = false;
      window.removeEventListener('overlay:close', onOverlayClose);
    };
  }, [onClose]);

  // Esc 键关闭（桌面端）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowLeft' && currentIndex > 0) goTo(currentIndex - 1);
      else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) goTo(currentIndex + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, images.length, handleClose, goTo]);

  const currentImage = images[currentIndex];

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none"
      onClick={handleBackdropClick}
      style={{ touchAction: 'none' }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 active:bg-black/60 transition-colors"
        aria-label="关闭"
      >
        <X size={22} />
      </button>

      {/* 图片计数 */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* 加载指示器 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 size={32} className="animate-spin text-white/60" />
        </div>
      )}

      {/* 左箭头（多图时） */}
      {images.length > 1 && currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(currentIndex - 1); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 active:bg-black/60 transition-colors"
          aria-label="上一张"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* 右箭头（多图时） */}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(currentIndex + 1); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 active:bg-black/60 transition-colors"
          aria-label="下一张"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* 图片 */}
      <img
        src={currentImage}
        alt="预览"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // 单击关闭（区分双击：双击会先触发一次 click）
          // 用延迟检测，如果 300ms 内有第二次 click 则取消
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            lastTapRef.current = 0;
            return;
          }
          lastTapRef.current = now;
          setTimeout(() => {
            if (lastTapRef.current && Date.now() - lastTapRef.current >= 280) {
              handleClose();
            }
          }, 300);
        }}
        draggable={false}
        className="max-w-full max-h-full object-contain pointer-events-auto"
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transition: transition ? 'transform 0.3s ease' : 'none',
          willChange: 'transform',
        }}
      />
    </div>,
    document.body
  );
}
