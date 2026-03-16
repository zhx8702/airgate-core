import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string;              // yyyy-MM-dd
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

// 格式化日期为 yyyy-MM-dd
function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 解析 yyyy-MM-dd
function parse(s: string): { y: number; m: number; d: number } | null {
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  return { y: +(parts[0] ?? 0), m: +(parts[1] ?? 1) - 1, d: +(parts[2] ?? 1) };
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function DatePicker({ value, onChange, placeholder = '选择日期', className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 当前面板显示的年/月
  const parsed = parse(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.y ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? now.getMonth());

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // value 变化时同步面板
  useEffect(() => {
    const p = parse(value);
    if (p) {
      setViewYear(p.y);
      setViewMonth(p.m);
    }
  }, [value]);

  // 月份导航
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  // 生成日历网格
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // 调整为周一起始
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];
  // 上月尾部
  for (let i = startOffset - 1; i >= 0; i--) {
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ day: daysInPrevMonth - i, month: pm, year: py, isCurrentMonth: false });
  }
  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true });
  }
  // 下月头部（补齐到 42 格即 6 行）
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ day: d, month: nm, year: ny, isCurrentMonth: false });
  }

  const todayStr = fmt(now.getFullYear(), now.getMonth(), now.getDate());
  const displayValue = value || '';

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* 触发按钮 */}
      <button
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-elevated text-text hover:border-border transition-colors cursor-pointer w-[130px]"
        onClick={() => setOpen(!open)}
      >
        <Calendar className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
        <span className={displayValue ? 'text-text' : 'text-text-tertiary'}>{displayValue || placeholder}</span>
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-[60] rounded-lg border border-glass-border bg-bg-elevated shadow-lg p-3 select-none"
          style={{ width: 280, animation: 'ag-scale-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* 头部导航 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text">
              {viewYear}年{String(viewMonth + 1).padStart(2, '0')}月
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="p-1 rounded hover:bg-bg-hover transition-colors text-text-tertiary hover:text-text cursor-pointer"
                onClick={prevMonth}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-bg-hover transition-colors text-text-tertiary hover:text-text cursor-pointer"
                onClick={nextMonth}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 星期头 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-medium text-text-tertiary py-1">{w}</div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const cellStr = fmt(cell.year, cell.month, cell.day);
              const isSelected = cellStr === value;
              const isToday = cellStr === todayStr;
              return (
                <button
                  key={i}
                  type="button"
                  className={`
                    h-8 text-xs rounded-md transition-all cursor-pointer
                    ${!cell.isCurrentMonth ? 'text-text-tertiary/40' : 'text-text-secondary hover:bg-bg-hover hover:text-text'}
                    ${isSelected ? '!bg-primary !text-white font-semibold' : ''}
                    ${isToday && !isSelected ? 'ring-1 ring-primary/50 font-semibold text-primary' : ''}
                  `}
                  onClick={() => {
                    onChange(cellStr);
                    setOpen(false);
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* 底部快捷操作 */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              className="text-[11px] text-text-tertiary hover:text-text transition-colors cursor-pointer"
              onClick={() => { onChange(''); setOpen(false); }}
            >
              清除
            </button>
            <button
              type="button"
              className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
              onClick={() => { onChange(todayStr); setOpen(false); }}
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
