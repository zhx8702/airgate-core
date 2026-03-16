import { get, post, put, del, patch } from './client';
import type {
  AccountResp, CreateAccountReq, UpdateAccountReq,
  CredentialSchemaResp, ModelInfo, PageReq, PagedData,
} from '../types';

export const accountsApi = {
  list: (params: PageReq & { platform?: string; status?: string; group_id?: number; proxy_id?: number }) =>
    get<PagedData<AccountResp>>('/api/v1/admin/accounts', params),
  create: (data: CreateAccountReq) => post<AccountResp>('/api/v1/admin/accounts', data),
  update: (id: number, data: UpdateAccountReq) => put<void>(`/api/v1/admin/accounts/${id}`, data),
  delete: (id: number) => del<void>(`/api/v1/admin/accounts/${id}`),
  // 切换调度状态（active ↔ disabled）
  toggleScheduling: (id: number) => patch<{ id: number; status: string }>(`/api/v1/admin/accounts/${id}/toggle`),
  // 获取账号所属平台的模型列表
  models: (id: number) => get<ModelInfo[]>(`/api/v1/admin/accounts/${id}/models`),
  // 测试连接 URL（SSE 流式，前端用 fetch 消费）
  testUrl: (id: number) => `/api/v1/admin/accounts/${id}/test`,
  // 获取指定平台账号的用量窗口（插件提供，格式因平台而异）
  usage: (platform: string) =>
    get<{ accounts: Record<string, any> }>('/api/v1/admin/accounts/usage', { platform }),
  credentialsSchema: (platform: string) =>
    get<CredentialSchemaResp>(`/api/v1/admin/accounts/credentials-schema/${platform}`),
  // 手动刷新账号额度（调用插件 QueryQuota）
  refreshQuota: (id: number) =>
    post<{ plan_type?: string; email?: string; subscription_active_until?: string }>(`/api/v1/admin/accounts/${id}/refresh-quota`),
  // 获取账号使用统计
  stats: (id: number) =>
    get<{ account_id: number; platform: string; today: AccountStats; last_7d: AccountStats; last_30d: AccountStats }>(`/api/v1/admin/accounts/${id}/stats`),
};

export interface AccountStats {
  count: number;
  input_tokens: number;
  output_tokens: number;
  total_cost: number;
}
