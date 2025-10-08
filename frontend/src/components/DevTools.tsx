// src/components/DevTools.tsx
import { useEffect, useState } from 'react';

/** Phát hiện môi trường build (Next/Vite/Webpack đều ổn) */
const IS_DEV =
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
  // @ts-ignore - Vite
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV);

/** true nếu đang focus input/textarea/contenteditable */
function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    el.isContentEditable === true
  );
}

/** Hook chung: toggle dev-mode bằng Ctrl+D (có hỗ trợ Cmd+D trên mac) */
function useDevHotkey() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!IS_DEV) return; // prod: không gắn listener
    const onKey = (e: KeyboardEvent) => {
      // Yêu cầu Ctrl+D (hoặc Cmd+D trên mac)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        if (isTypingTarget(e.target)) return; // đang gõ trong input -> bỏ qua
        e.preventDefault(); // cố gắng chặn bookmark
        setEnabled((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, []);

  return enabled && IS_DEV;
}

/* =========================================================================
 *  DevTools overlay
 * ========================================================================= */
export function DevTools() {
  const enabled = useDevHotkey();
  if (!enabled) return null; // prod hoặc đang OFF

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-black/90 backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-2xl border border-white/20">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <div className="text-sm font-medium">
          🔧 Dev Mode <span className="text-green-400">ON</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-400">
        Hover vào component để xem tên · Toggle bằng <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>D</kbd>
      </div>
    </div>
  );
}

/* =========================================================================
 *  DevBoundary: vẽ viền và tooltip tên component (dev only)
 * ========================================================================= */
interface DevBoundaryProps {
  name: string;
  filePath: string;
  children: React.ReactNode;
}

export function DevBoundary({ name, filePath, children }: DevBoundaryProps) {
  const enabled = useDevHotkey();
  const [hover, setHover] = useState(false);

  // Prod hoặc đang OFF -> trả về children nguyên bản, không tạo listener/inline style
  if (!enabled) return <>{children}</>;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(filePath).catch(() => {});
    // quick toast nhỏ tự chế để khỏi kéo thêm lib
    const toast = document.createElement('div');
    toast.className =
      'fixed top-20 right-4 z-[9999] bg-green-600 text-white px-3 py-1.5 rounded-md shadow';
    toast.textContent = `📋 Copied: ${filePath}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      style={{
        outline: hover ? '2px dashed rgba(34,197,94,.6)' : 'none',
        outlineOffset: '4px',
        cursor: hover ? 'pointer' : 'auto',
      }}
    >
      {hover && (
        <div className="absolute -top-8 left-0 z-[9998] bg-black/95 backdrop-blur-xl text-white px-3 py-1.5 rounded-lg shadow-2xl border border-emerald-400/50 text-xs font-mono whitespace-nowrap">
          📦 {name}
          <div className="mt-0.5 text-[10px] text-gray-400">Click để copy path</div>
        </div>
      )}
      {children}
    </div>
  );
}

/* =========================================================================
 *  Inspector: panel chi tiết props (dev only)
 * ========================================================================= */
interface InspectorProps {
  name: string;
  filePath: string;
  props?: Record<string, unknown>;
  children: React.ReactNode;
}

export function Inspector({ name, filePath, props, children }: InspectorProps) {
  const enabled = useDevHotkey();
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);

  if (!enabled) return <>{children}</>;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
      style={{
        outline: hover ? '2px solid rgba(59,130,246,.5)' : 'none',
        outlineOffset: '2px',
        cursor: 'pointer',
      }}
    >
      {hover && (
        <div className="absolute -top-10 left-0 z-[9998] bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-2 rounded-xl shadow-2xl text-xs font-mono whitespace-nowrap">
          <div className="font-bold">🎯 {name}</div>
          <div className="mt-1 text-[10px] text-blue-100">Click để xem chi tiết</div>
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-2 z-[9999] bg-black/95 backdrop-blur-xl text-white p-4 rounded-xl shadow-2xl border border-blue-500/50 max-w-md">
          <div className="mb-2 text-sm font-bold text-blue-400">📦 {name}</div>
          <div className="mb-3 font-mono text-xs text-gray-400 break-all">📁 {filePath}</div>

          {props && Object.keys(props).length > 0 && (
            <div className="pt-3 mt-3 border-t border-white/10">
              <div className="mb-2 text-xs font-bold text-purple-400">Props:</div>
              <div className="space-y-1">
                {Object.entries(props).map(([k, v]) => (
                  <div key={k} className="font-mono text-xs">
                    <span className="text-green-400">{k}:</span>{' '}
                    <span className="text-gray-300">
                      {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="mt-3 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(filePath).catch(() => {});
              alert('✅ Đã copy path: ' + filePath);
            }}
          >
            📋 Copy File Path
          </button>
        </div>
      )}

      {children}
    </div>
  );
}
