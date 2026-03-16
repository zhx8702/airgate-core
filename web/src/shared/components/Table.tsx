import { type ReactNode, useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  title: string;
  render?: (row: T) => ReactNode;
  width?: string;
  /** 固定列：left 固定在左侧，right 固定在右侧 */
  fixed?: 'left' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  rowKey?: (row: T) => string | number;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  /** 每页条数切换 */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

/** 计算固定列的 sticky 偏移量 */
function computeStickyOffsets<T>(columns: Column<T>[]) {
  const offsets: (number | undefined)[] = new Array(columns.length);

  // 左侧固定列：累加前面 fixed='left' 列的宽度
  let leftOffset = 0;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    if (col.fixed === 'left') {
      offsets[i] = leftOffset;
      leftOffset += parsePx(col.width, 150);
    }
  }

  // 右侧固定列：从右向左累加
  let rightOffset = 0;
  for (let i = columns.length - 1; i >= 0; i--) {
    const col = columns[i]!;
    if (col.fixed === 'right') {
      offsets[i] = rightOffset;
      rightOffset += parsePx(col.width, 150);
    }
  }

  return offsets;
}

function parsePx(width: string | undefined, fallback: number): number {
  if (!width) return fallback;
  const n = parseInt(width, 10);
  return isNaN(n) ? fallback : n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Table<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  rowKey,
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: TableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFixed = columns.some((c) => c.fixed);
  const stickyOffsets = hasFixed ? computeStickyOffsets(columns) : [];

  // 检测是否可以横向滚动（用于显示阴影）
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !hasFixed) return;
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, [hasFixed, columns.length, data.length]);

  const stickyStyle = (col: Column<T>, idx: number, isHeader?: boolean): React.CSSProperties => {
    if (!col.fixed) return {};
    return {
      position: 'sticky',
      [col.fixed]: stickyOffsets[idx] ?? 0,
      zIndex: isHeader ? 3 : 2,
    };
  };

  // 固定列阴影 class
  const shadowCls = (col: Column<T>) => {
    if (!col.fixed) return '';
    if (col.fixed === 'left' && canScrollLeft) return 'ag-sticky-shadow-right';
    if (col.fixed === 'right' && canScrollRight) return 'ag-sticky-shadow-left';
    return '';
  };

  const showPagination = onPageChange;

  if (loading) {
    return (
      <div className="rounded-lg border border-glass-border bg-bg-elevated overflow-hidden">
        {/* 表头骨架 */}
        <div className="flex gap-4 px-4 py-3 border-b border-border bg-surface">
          {columns.map((col) => (
            <div key={col.key} className="h-4 ag-shimmer rounded w-20" style={{ flex: col.width ? `0 0 ${col.width}` : '1' }} />
          ))}
        </div>
        {/* 行骨架 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-border-subtle">
            {columns.map((col) => (
              <div key={col.key} className="h-4 ag-shimmer rounded w-24" style={{ flex: col.width ? `0 0 ${col.width}` : '1', animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-glass-border bg-bg-elevated">
          <EmptyState />
        </div>
        {showPagination && (
          <PaginationBar
            page={page} pageSize={pageSize} total={total} totalPages={totalPages}
            onPageChange={onPageChange} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-glass-border bg-bg-elevated overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: hasFixed ? 'max-content' : undefined }}>
            <thead>
              <tr className="border-b border-border bg-surface">
                {columns.map((col, idx) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-center text-[10px] font-semibold text-text-tertiary uppercase tracking-widest ${col.fixed ? 'ag-sticky-cell-header' : ''} ${shadowCls(col)}`}
                    style={{ width: col.width, ...stickyStyle(col, idx, true) }}
                  >
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row) : i}
                  className="border-b border-border-subtle last:border-0 transition-colors hover:bg-bg-hover"
                >
                  {columns.map((col, idx) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-center text-text-secondary whitespace-nowrap ${col.fixed ? 'ag-sticky-cell' : ''} ${shadowCls(col)}`}
                      style={stickyStyle(col, idx)}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {showPagination && (
        <PaginationBar
          page={page} pageSize={pageSize} total={total} totalPages={totalPages}
          onPageChange={onPageChange} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

/** 分页栏 */
function PaginationBar({
  page, pageSize, total, totalPages,
  onPageChange, pageSizeOptions, onPageSizeChange,
}: {
  page: number; pageSize: number; total: number; totalPages: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[]; onPageSizeChange?: (size: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-tertiary font-mono">
          共 {total} 条 · 第 {page}/{totalPages} 页
        </span>
        {pageSizeOptions && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 px-1.5 rounded border border-glass-border bg-surface text-xs text-text-secondary cursor-pointer focus:outline-none focus:border-border-focus"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} 条/页</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="flex items-center justify-center w-8 h-8 rounded-sm text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {/* 页码按钮 */}
        {generatePageNumbers(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-text-tertiary text-xs">
              ···
            </span>
          ) : (
            <button
              key={p}
              className={`flex items-center justify-center w-8 h-8 rounded-sm text-xs font-medium transition-all ${
                p === page
                  ? 'bg-primary text-text-inverse shadow-[0_0_12px_var(--ag-primary-glow)]'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-sm text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** 生成分页页码 */
function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
