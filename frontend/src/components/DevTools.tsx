import { useState, useEffect } from 'react';

/**
 * 🔧 DEV TOOLS - Hiển thị tên component khi hover
 * 
 * Cách dùng:
 * 1. Bọc component với <DevBoundary name="ComponentName">
 * 2. Press "D" key để toggle Dev Mode
 * 3. Hover vào bất kỳ component nào để thấy tên
 * 4. Click để copy đường dẫn file
 */

export function DevTools() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Press "D" to toggle Dev Mode
      if (e.key === 'd' || e.key === 'D') {
        setEnabled((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-black/90 backdrop-blur-xl text-white px-4 py-3 rounded-xl shadow-2xl border border-white/20">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <div className="text-sm font-medium">
          🔧 Dev Mode <span className="text-green-400">ON</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-400">
        Hover vào component để xem tên
      </div>
    </div>
  );
}

interface DevBoundaryProps {
  name: string;
  filePath: string;
  children: React.ReactNode;
}

export function DevBoundary({ name, filePath, children }: DevBoundaryProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setDevModeEnabled((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (!devModeEnabled) return;
    
    e.stopPropagation();
    navigator.clipboard.writeText(filePath);
    
    // Show toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 right-4 z-[9999] bg-green-500 text-white px-4 py-2 rounded-lg shadow-xl';
    toast.textContent = `📋 Copied: ${filePath}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  };

  if (!devModeEnabled) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      style={{
        outline: isHovered ? '2px dashed rgba(0, 255, 0, 0.5)' : 'none',
        outlineOffset: '4px',
        cursor: isHovered ? 'pointer' : 'auto',
      }}
    >
      {isHovered && (
        <div className="absolute -top-8 left-0 z-[9998] bg-black/95 backdrop-blur-xl text-white px-3 py-1.5 rounded-lg shadow-2xl border border-green-500/50 text-xs font-mono whitespace-nowrap">
          📦 {name}
          <div className="text-[10px] text-gray-400 mt-0.5">
            Click để copy path
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * 🎯 Component Inspector - Hiển thị info chi tiết
 */
interface InspectorProps {
  name: string;
  filePath: string;
  props?: Record<string, unknown>;
  children: React.ReactNode;
}

export function Inspector({ name, filePath, props, children }: InspectorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setDevModeEnabled((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!devModeEnabled) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShowDetails(!showDetails);
      }}
      style={{
        outline: isHovered ? '2px solid rgba(59, 130, 246, 0.5)' : 'none',
        outlineOffset: '2px',
        cursor: 'pointer',
      }}
    >
      {isHovered && (
        <div className="absolute -top-10 left-0 z-[9998]  from-blue-600 to-purple-600 text-white px-3 py-2 rounded-xl shadow-2xl text-xs font-mono whitespace-nowrap">
          <div className="font-bold">🎯 {name}</div>
          <div className="text-[10px] text-blue-100 mt-1">
            Click để xem chi tiết
          </div>
        </div>
      )}

      {showDetails && (
        <div className="absolute top-full left-0 mt-2 z-[9999] bg-black/95 backdrop-blur-xl text-white p-4 rounded-xl shadow-2xl border border-blue-500/50 max-w-md">
          <div className="text-sm font-bold text-blue-400 mb-2">
            📦 {name}
          </div>
          
          <div className="text-xs text-gray-400 mb-3 font-mono break-all">
            📁 {filePath}
          </div>

          {props && Object.keys(props).length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-xs font-bold text-purple-400 mb-2">
                Props:
              </div>
              <div className="space-y-1">
                {Object.entries(props).map(([key, value]) => (
                  <div key={key} className="text-xs font-mono">
                    <span className="text-green-400">{key}:</span>{' '}
                    <span className="text-gray-300">
                      {typeof value === 'object' 
                        ? JSON.stringify(value, null, 2).slice(0, 50) + '...'
                        : String(value)}
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
              navigator.clipboard.writeText(filePath);
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
