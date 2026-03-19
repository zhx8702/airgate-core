import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Key, Monitor, Activity, Users,
  Coins, Database, Zap, Clock, ShieldCheck, Wallet,
} from 'lucide-react';
import { Card, StatCard } from '../shared/components/Card';
import { PageHeader } from '../shared/components/PageHeader';
import { Table, type Column } from '../shared/components/Table';
import { dashboardApi } from '../shared/api/dashboard';
import { usageApi } from '../shared/api/usage';
import { apikeysApi } from '../shared/api/apikeys';
import { subscriptionsApi } from '../shared/api/subscriptions';
import { useAuth } from '../app/providers/AuthProvider';
import type {
  DashboardStatsResp,
  DashboardTrendResp,
  DashboardTrendReq,
  UsageLogResp,
  APIKeyResp,
  SubscriptionResp,
} from '../shared/types';

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

const USER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7',
];

type RangePreset = 'today' | '7d' | '30d' | '90d';
type Granularity = 'hour' | 'day';

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
}

function fmtCost(n: number | undefined | null): string {
  if (n == null) return '$0.00';
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <AdminDashboardContent />;
  }

  return <UserOverviewContent />;
}

function UserOverviewContent() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: usageStats } = useQuery({
    queryKey: ['user-overview', 'usage-stats'],
    queryFn: () => usageApi.userStats({}),
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['user-overview', 'usage-list'],
    queryFn: () => usageApi.list({ page: 1, page_size: 5 }),
  });

  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ['user-overview', 'keys'],
    queryFn: () => apikeysApi.list({ page: 1, page_size: 5 }),
  });

  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['user-overview', 'subscriptions'],
    queryFn: () => subscriptionsApi.active(),
  });

  const enabledKeys = (keysData?.list ?? []).filter((key) => key.status === 'active').length;

  const usageColumns: Column<UsageLogResp>[] = [
    {
      key: 'created_at',
      title: t('usage.time'),
      render: (row) => new Date(row.created_at).toLocaleString('zh-CN'),
    },
    { key: 'model', title: t('usage.model') },
    {
      key: 'tokens',
      title: t('usage.total_tokens'),
      render: (row) => fmtNum(row.input_tokens + row.output_tokens + row.cache_tokens),
    },
    {
      key: 'actual_cost',
      title: t('usage.actual_cost'),
      render: (row) => `$${row.actual_cost.toFixed(6)}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('user_overview.title')}
        description={t('user_overview.description')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title={t('user_overview.balance')}
          value={`$${(user?.balance ?? 0).toFixed(2)}`}
          icon={<Wallet className="w-5 h-5" />}
          accentColor="var(--ag-primary)"
        />
        <StatCard
          title={t('user_overview.max_concurrency')}
          value={user?.max_concurrency ?? 0}
          icon={<Zap className="w-5 h-5" />}
          accentColor="var(--ag-info)"
        />
        <StatCard
          title={t('user_overview.totp_status')}
          value={user?.totp_enabled ? t('user_overview.totp_enabled') : t('user_overview.totp_disabled')}
          icon={<ShieldCheck className="w-5 h-5" />}
          accentColor="var(--ag-success)"
        />
        <StatCard
          title={t('user_overview.active_subscriptions')}
          value={subscriptions?.length ?? 0}
          icon={<Database className="w-5 h-5" />}
          accentColor="var(--ag-warning)"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title={t('usage.total_requests')}
          value={(usageStats?.total_requests ?? 0).toLocaleString()}
          icon={<Activity className="w-5 h-5" />}
          accentColor="var(--ag-primary)"
        />
        <StatCard
          title={t('usage.total_tokens')}
          value={fmtNum(usageStats?.total_tokens ?? 0)}
          icon={<HashIcon />}
          accentColor="var(--ag-info)"
        />
        <StatCard
          title={t('usage.total_cost')}
          value={`$${(usageStats?.total_cost ?? 0).toFixed(4)}`}
          icon={<Coins className="w-5 h-5" />}
          accentColor="var(--ag-warning)"
        />
        <StatCard
          title={t('user_overview.my_keys')}
          value={keysData?.total ?? 0}
          icon={<Key className="w-5 h-5" />}
          change={t('user_overview.enabled_keys', { count: enabledKeys })}
          changeType="up"
          accentColor="var(--ag-success)"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card title={t('user_overview.active_subscriptions')} className="xl:col-span-1">
          {subscriptionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-14 ag-shimmer rounded-lg" />
              ))}
            </div>
          ) : subscriptions && subscriptions.length > 0 ? (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <SubscriptionItem key={sub.id} sub={sub} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-tertiary">{t('user_overview.subscriptions_empty')}</div>
          )}
        </Card>

        <Card title={t('user_overview.my_keys')} className="xl:col-span-2">
          {keysLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-14 ag-shimmer rounded-lg" />
              ))}
            </div>
          ) : keysData?.list?.length ? (
            <div className="space-y-3">
              {keysData.list.map((key) => (
                <KeyItem key={key.id} item={key} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-text-tertiary">{t('user_overview.keys_empty')}</div>
          )}
        </Card>
      </div>

      <Card title={t('user_overview.recent_usage')}>
        {usageData?.list?.length ? (
          <Table
            columns={usageColumns}
            data={usageData.list}
            loading={usageLoading}
            rowKey={(row) => row.id}
            autoHeight
          />
        ) : usageLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-12 ag-shimmer rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="text-sm text-text-tertiary">{t('user_overview.recent_usage_empty')}</div>
        )}
      </Card>
    </div>
  );
}

function SubscriptionItem({ sub }: { sub: SubscriptionResp }) {
  return (
    <div className="rounded-lg border border-glass-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-text">{sub.group_name}</div>
          <div className="text-xs text-text-tertiary">
            到期：{new Date(sub.expires_at).toLocaleDateString('zh-CN')}
          </div>
        </div>
        <div className="text-xs font-medium text-success">{sub.status}</div>
      </div>
    </div>
  );
}

function KeyItem({ item }: { item: APIKeyResp }) {
  return (
    <div className="rounded-lg border border-glass-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-text">{item.name}</div>
          <div className="text-xs text-text-tertiary font-mono">{item.key_prefix}</div>
        </div>
        <div className={`text-xs font-medium ${item.status === 'active' ? 'text-success' : 'text-text-tertiary'}`}>
          {item.status}
        </div>
      </div>
    </div>
  );
}

function HashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function AdminDashboardContent() {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangePreset>('today');
  const [granularity, setGranularity] = useState<Granularity>('day');

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats(),
  });

  const trendParams: DashboardTrendReq = useMemo(() => ({
    range,
    granularity: range === 'today' ? 'hour' : granularity,
  }), [range, granularity]);

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ['dashboard', 'trend', trendParams],
    queryFn: () => dashboardApi.trend(trendParams),
  });

  return (
    <div>
      {statsError && (
        <div className="rounded-md bg-danger-subtle border border-danger border-opacity-20 px-4 py-3 text-sm text-danger mb-4">
          {t('dashboard.load_failed', { error: statsError instanceof Error ? statsError.message : '' })}
        </div>
      )}

      {statsLoading ? <StatsSkeleton /> : stats ? <StatsCards stats={stats} /> : null}

      <div className="flex items-center justify-between mt-6 mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">{t('dashboard.time_range')}</span>
          {(['today', '7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer ${
                range === r
                  ? 'bg-primary-subtle text-primary shadow-[0_0_8px_var(--ag-primary-glow)]'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text border border-border-subtle'
              }`}
              onClick={() => setRange(r)}
            >
              {t(`dashboard.range_${r}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">{t('dashboard.granularity')}</span>
          <select
            className="text-xs rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-text-secondary"
            value={range === 'today' ? 'hour' : granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            disabled={range === 'today'}
          >
            <option value="day">{t('dashboard.granularity_day')}</option>
            <option value="hour">{t('dashboard.granularity_hour')}</option>
          </select>
        </div>
      </div>

      {trendLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-lg border border-glass-border bg-bg-elevated p-5 h-96 ag-shimmer" />
          <div className="rounded-lg border border-glass-border bg-bg-elevated p-5 h-96 ag-shimmer" />
        </div>
      ) : trend ? (
        <TrendCharts trend={trend} />
      ) : null}
    </div>
  );
}

function TrendCharts({ trend }: { trend: DashboardTrendResp }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ModelDistributionCard trend={trend} />
        <TokenTrendCard trend={trend} />
      </div>
      <TopUsersCard trend={trend} />
    </>
  );
}

function StatsCards({ stats }: { stats: DashboardStatsResp }) {
  const { t } = useTranslation();

  const cards = [
    {
      title: t('dashboard.api_keys'),
      value: stats.total_api_keys,
      sub: t('dashboard.api_keys_enabled', { count: stats.enabled_api_keys }),
      icon: <Key className="w-5 h-5" />,
      color: 'var(--ag-primary)',
    },
    {
      title: t('dashboard.accounts'),
      value: stats.total_accounts,
      sub: t('dashboard.accounts_status', { enabled: stats.enabled_accounts, errors: stats.error_accounts }),
      subHighlight: stats.error_accounts > 0,
      icon: <Monitor className="w-5 h-5" />,
      color: 'var(--ag-info)',
    },
    {
      title: t('dashboard.today_requests'),
      value: fmtNum(stats.today_requests),
      sub: t('dashboard.alltime_requests', { count: fmtNum(stats.alltime_requests) } as Record<string, string>),
      icon: <Activity className="w-5 h-5" />,
      color: 'var(--ag-success)',
    },
    {
      title: t('dashboard.users'),
      value: t('dashboard.new_users', { count: stats.new_users_today }),
      sub: t('dashboard.total_count', { count: stats.total_users }),
      icon: <Users className="w-5 h-5" />,
      color: 'var(--ag-warning)',
    },
    {
      title: t('dashboard.today_tokens'),
      value: fmtNum(stats.today_tokens),
      sub: `${fmtCost(stats.today_cost)} / ${fmtCost(stats.today_cost)}`,
      icon: <Coins className="w-5 h-5" />,
      color: 'var(--ag-primary)',
    },
    {
      title: t('dashboard.total_tokens'),
      value: fmtNum(stats.alltime_tokens),
      sub: `${fmtCost(stats.alltime_cost)} / ${fmtCost(stats.alltime_cost)}`,
      icon: <Database className="w-5 h-5" />,
      color: 'var(--ag-info)',
    },
    {
      title: t('dashboard.performance'),
      value: `${Math.round(stats.rpm ?? 0)}`,
      valueSuffix: t('dashboard.rpm'),
      sub: `${fmtNum(stats.tpm ?? 0)} ${t('dashboard.tpm')}`,
      icon: <Zap className="w-5 h-5" />,
      color: 'var(--ag-success)',
    },
    {
      title: t('dashboard.avg_response'),
      value: `${((stats.avg_duration_ms ?? 0) / 1000).toFixed(2)}s`,
      sub: t('dashboard.active_users', { count: stats.active_users }),
      icon: <Clock className="w-5 h-5" />,
      color: 'var(--ag-warning)',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className="group relative overflow-hidden rounded-lg border border-glass-border bg-bg-elevated p-5 transition-all duration-200 hover:border-border hover:shadow-md"
          style={{ animation: `ag-slide-up 0.4s ease-out ${i * 50}ms both` }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px opacity-40 group-hover:opacity-80 transition-opacity"
            style={{ background: `linear-gradient(90deg, transparent, ${card.color}, transparent)` }}
          />
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-tertiary">{card.title}</p>
              <p className="text-2xl font-bold tracking-tight font-mono">
                {card.value}
                {card.valueSuffix && (
                  <span className="text-sm font-medium text-text-secondary ml-1.5">{card.valueSuffix}</span>
                )}
              </p>
              <p className={`text-xs ${card.subHighlight ? 'text-danger' : 'text-text-tertiary'}`}>
                {card.sub}
              </p>
            </div>
            <div
              className="flex items-center justify-center w-10 h-10 rounded-md"
              style={{ background: `color-mix(in srgb, ${card.color} 12%, transparent)`, color: card.color }}
            >
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-glass-border bg-bg-elevated p-5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="space-y-3">
            <div className="h-3 w-16 ag-shimmer rounded" />
            <div className="h-7 w-20 ag-shimmer rounded" />
            <div className="h-3 w-28 ag-shimmer rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ModelDistributionCard({ trend }: { trend: DashboardTrendResp }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'model' | 'user'>('model');

  const models = trend.model_distribution ?? [];
  const users = trend.user_ranking ?? [];

  const pieData = useMemo(() =>
    models.map((m) => ({ name: m.model, value: m.requests })),
    [models],
  );

  return (
    <Card title={t('dashboard.model_distribution')} extra={
      <div className="flex gap-1">
        <button
          className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all cursor-pointer ${
            tab === 'model'
              ? 'bg-primary-subtle text-primary'
              : 'text-text-tertiary hover:text-text'
          }`}
          onClick={() => setTab('model')}
        >
          {t('dashboard.model_distribution')}
        </button>
        <button
          className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all cursor-pointer ${
            tab === 'user'
              ? 'bg-primary-subtle text-primary'
              : 'text-text-tertiary hover:text-text'
          }`}
          onClick={() => setTab('user')}
        >
          {t('dashboard.user_ranking')}
        </button>
      </div>
    }>
      {tab === 'model' ? (
        <div className="flex gap-4">
          <div className="w-48 h-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    background: 'var(--ag-bg-elevated)',
                    border: '1px solid var(--ag-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-2 pr-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.model')}</th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.requests')}</th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.tokens')}</th>
                  <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.actual')}</th>
                  <th className="text-right py-2 pl-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.standard')}</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m, i) => (
                  <tr key={m.model} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover transition-colors">
                    <td className="py-2 pr-3 text-text font-medium flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate max-w-[180px]">{m.model}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-text-secondary font-mono">{m.requests.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-text-secondary font-mono">{fmtNum(m.tokens)}</td>
                    <td className="py-2 px-3 text-right font-mono text-warning">{fmtCost(m.actual_cost)}</td>
                    <td className="py-2 pl-3 text-right text-text-secondary font-mono">{fmtCost(m.standard_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2 pr-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.email')}</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.requests')}</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.tokens')}</th>
                <th className="text-right py-2 px-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.actual')}</th>
                <th className="text-right py-2 pl-3 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{t('dashboard.standard')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover transition-colors">
                  <td className="py-2 pr-3 text-text font-medium truncate max-w-[200px]">{u.email}</td>
                  <td className="py-2 px-3 text-right text-text-secondary font-mono">{u.requests.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-text-secondary font-mono">{fmtNum(u.tokens)}</td>
                  <td className="py-2 px-3 text-right font-mono text-warning">{fmtCost(u.actual_cost)}</td>
                  <td className="py-2 pl-3 text-right text-text-secondary font-mono">{fmtCost(u.standard_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TokenTrendCard({ trend }: { trend: DashboardTrendResp }) {
  const { t } = useTranslation();

  const chartData = useMemo(() =>
    (trend.token_trend ?? []).map((d) => ({
      time: fmtTime(d.time),
      input: d.input_tokens,
      output: d.output_tokens,
      cacheCreation: d.cache_creation,
      cacheRead: d.cache_read,
    })),
    [trend.token_trend],
  );

  if (chartData.length === 0) {
    return (
      <Card title={t('dashboard.token_trend')}>
        <div className="flex items-center justify-center h-48 text-text-tertiary text-sm">
          No data
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('dashboard.token_trend')}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ag-border-subtle)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'var(--ag-text-tertiary)' }}
            axisLine={{ stroke: 'var(--ag-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--ag-text-tertiary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => fmtNum(v)}
          />
          <RechartsTooltip
            contentStyle={{
              background: 'var(--ag-bg-elevated)',
              border: '1px solid var(--ag-border)',
              borderRadius: 8,
              fontSize: 12,
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'var(--ag-text)', fontWeight: 600, marginBottom: 4 }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                input: t('dashboard.input'),
                output: t('dashboard.output'),
                cacheCreation: t('dashboard.cache_creation'),
                cacheRead: t('dashboard.cache_read'),
              };
              return [fmtNum(Number(value)), labels[String(name)] || String(name)];
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'var(--ag-text-tertiary)' }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                input: t('dashboard.input'),
                output: t('dashboard.output'),
                cacheCreation: t('dashboard.cache_creation'),
                cacheRead: t('dashboard.cache_read'),
              };
              return labels[value] || value;
            }}
          />
          <Line type="monotone" dataKey="input" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="output" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cacheCreation" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cacheRead" stroke="#8b5cf6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

function TopUsersCard({ trend }: { trend: DashboardTrendResp }) {
  const { t } = useTranslation();
  const topUsers = trend.top_users ?? [];

  const chartData = useMemo(() => {
    if (topUsers.length === 0) return [];

    const timeSet = new Set<string>();
    topUsers.forEach((u) => u.trend.forEach((p) => timeSet.add(p.time)));
    const times = Array.from(timeSet).sort();

    return times.map((time) => {
      const row: Record<string, string | number> = { time: fmtTime(time) };
      topUsers.forEach((u) => {
        const point = u.trend.find((p) => p.time === time);
        row[u.email] = point?.tokens ?? 0;
      });
      return row;
    });
  }, [topUsers]);

  if (topUsers.length === 0) return null;

  return (
    <Card title={t('dashboard.top_users')}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ag-border-subtle)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'var(--ag-text-tertiary)' }}
            axisLine={{ stroke: 'var(--ag-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--ag-text-tertiary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => fmtNum(v)}
          />
          <RechartsTooltip
            contentStyle={{
              background: 'var(--ag-bg-elevated)',
              border: '1px solid var(--ag-border)',
              borderRadius: 8,
              fontSize: 12,
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'var(--ag-text)', fontWeight: 600, marginBottom: 4 }}
            formatter={(value) => [fmtNum(Number(value)), '']}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'var(--ag-text-tertiary)' }}
          />
          {topUsers.map((u, i) => (
            <Line
              key={u.user_id}
              type="monotone"
              dataKey={u.email}
              stroke={USER_COLORS[i % USER_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

function fmtTime(timeStr: string): string {
  if (timeStr.includes(' ')) {
    return timeStr.split(' ')[1] ?? timeStr;
  }
  const parts = timeStr.split('-');
  return `${parts[1] ?? ''}/${parts[2] ?? ''}`;
}
