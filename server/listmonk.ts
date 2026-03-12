/**
 * ListMonk HTTP client
 * Wraps every ListMonk REST call.  All requests use Basic Auth.
 */
import axios, { type AxiosInstance } from "axios";

let _client: AxiosInstance | null = null;

export function getListmonkClient(): AxiosInstance {
  if (_client) return _client;

  const baseURL = process.env.LISTMONK_URL ?? "http://localhost:9000";
  const username = process.env.LISTMONK_USERNAME ?? "admin";
  const password = process.env.LISTMONK_PASSWORD ?? "";

  _client = axios.create({
    baseURL,
    auth: { username, password },
    timeout: 10_000,
    headers: { "Content-Type": "application/json" },
  });

  // Log errors in dev
  if (process.env.NODE_ENV !== "production") {
    _client.interceptors.response.use(
      r => r,
      err => {
        console.error("[listmonk]", err.response?.status, err.config?.url, err.message);
        return Promise.reject(err);
      }
    );
  }

  return _client;
}

// ── Typed responses ──────────────────────────────────────────────────────────

export interface ListmonkList {
  id: number;
  uuid: string;
  name: string;
  type: "public" | "private" | "optin";
  optin: string;
  tags: string[];
  description: string;
  subscriber_count: number;
  created_at: string;
  updated_at: string;
}

export interface ListmonkCampaign {
  id: number;
  uuid: string;
  name: string;
  subject: string;
  status: "draft" | "running" | "scheduled" | "paused" | "cancelled" | "finished";
  type: "regular" | "optin";
  tags: string[];
  lists: { id: number; name: string }[];
  from_email: string;
  send_at: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
  views: number;
  clicks: number;
  bounces: number;
  sent: number;
  template_id: number;
  body: string;
  content_type: string;
}

export interface ListmonkTemplate {
  id: number;
  name: string;
  type: string;
  subject: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListmonkSubscriber {
  id: number;
  uuid: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

export async function listLists(): Promise<ListmonkList[]> {
  const lm = getListmonkClient();
  const res = await lm.get<{ data: { results: ListmonkList[]; total: number } }>("/api/lists?page=1&per_page=100");
  return res.data.data.results ?? [];
}

export async function listCampaigns(page = 1, perPage = 50): Promise<{ results: ListmonkCampaign[]; total: number }> {
  const lm = getListmonkClient();
  const res = await lm.get<{ data: { results: ListmonkCampaign[]; total: number } }>(
    `/api/campaigns?page=${page}&per_page=${perPage}&order_by=created_at&order=DESC`
  );
  return res.data.data;
}

export async function getCampaign(id: number): Promise<ListmonkCampaign> {
  const lm = getListmonkClient();
  const res = await lm.get<{ data: ListmonkCampaign }>(`/api/campaigns/${id}`);
  return res.data.data;
}

export async function updateCampaign(id: number, body: Record<string, unknown>): Promise<ListmonkCampaign> {
  const lm = getListmonkClient();
  const res = await lm.put<{ data: ListmonkCampaign }>(`/api/campaigns/${id}`, body);
  return res.data.data;
}

export async function sendTestEmail(id: number, emails: string[]): Promise<void> {
  const lm = getListmonkClient();
  await lm.post(`/api/campaigns/${id}/test`, { subscribers: emails });
}

export async function listTemplates(): Promise<ListmonkTemplate[]> {
  const lm = getListmonkClient();
  const res = await lm.get<{ data: { results: ListmonkTemplate[] } }>("/api/templates");
  return res.data.data.results ?? [];
}

export async function listSubscribersByList(listId: number, page = 1, perPage = 100): Promise<{ results: ListmonkSubscriber[]; total: number }> {
  const lm = getListmonkClient();
  const res = await lm.get<{ data: { results: ListmonkSubscriber[]; total: number } }>(
    `/api/subscribers?list_id=${listId}&page=${page}&per_page=${perPage}&order_by=created_at&order=DESC`
  );
  return res.data.data;
}

export async function sendTransactional(params: {
  subscriber_email: string;
  template_id: number;
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<void> {
  const lm = getListmonkClient();
  await lm.post("/api/tx", params);
}

/**
 * Derive simple daily subscriber stats from ListMonk subscribers.
 * ListMonk doesn't have a dedicated "new subs per day" API endpoint,
 * so we fetch the most recent subscribers and group by created_at date.
 */
export async function getDailySubscriberStats(listId: number, days = 30): Promise<Record<string, number>> {
  const { results } = await listSubscribersByList(listId, 1, 500);
  const cutoff = Date.now() - days * 86_400_000;
  const byDate: Record<string, number> = {};

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().split("T")[0];
    byDate[d] = 0;
  }

  for (const sub of results) {
    const ts = new Date(sub.created_at).getTime();
    if (ts < cutoff) continue;
    const d = new Date(sub.created_at).toISOString().split("T")[0];
    if (d in byDate) byDate[d]++;
  }

  return byDate;
}
