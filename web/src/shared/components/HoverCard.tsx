import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface HoverCardProps {
  children: ReactNode;
  content: ReactNode;
}

export function HoverCard({ children, content }: HoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} className="cursor-default">
      {children}
      {visible && createPortal(
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="mb-2 bg-[#1a1a2e] border border-glass-border rounded-lg px-4 py-3 shadow-xl whitespace-nowrap">
            {content}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
