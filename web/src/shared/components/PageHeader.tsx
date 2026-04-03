import { type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PageHeaderProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function PageHeader({ actions, onRefresh, refreshing }: PageHeaderProps) {
  if (!actions && !onRefresh) return null;
  return (
    <div className="flex items-center justify-end mb-6">
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center justify-center w-8 h-8 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
