import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  listLists, listCampaigns, updateCampaign, sendTestEmail,
  listTemplates, getDailySubscriberStats, listSubscribersByList,
  getListmonkClient,
} from "./listmonk";
import { insertNewsletterSettingsSchema, insertFunnelSchema, insertFunnelStepSchema } from "@shared/schema";
import { z } from "zod";

/**
 * Whether we can reach ListMonk.
 * Set LISTMONK_URL in .env — if missing, fall through to demo data.
 */
const LISTMONK_ENABLED = !!process.env.LISTMONK_URL;

// ── Demo data (used when ListMonk is not configured) ─────────────────────────

function getDemoLists() {
  return [
    { id: 1, name: "Tech Weekly",    type: "public",  subscriber_count: 4821, uuid: "list-uuid-1" },
    { id: 2, name: "Growth Digest",  type: "public",  subscriber_count: 3102, uuid: "list-uuid-2" },
    { id: 3, name: "Design Pulse",   type: "private", subscriber_count: 1854, uuid: "list-uuid-3" },
    { id: 4, name: "Founders Brief", type: "public",  subscriber_count:  927, uuid: "list-uuid-4" },
  ];
}

function getDemoCampaigns() {
  const statuses = ["sent", "sent", "sent", "running", "draft", "scheduled"];
  const lists = ["Tech Weekly", "Growth Digest", "Design Pulse", "Founders Brief"];
  return Array.from({ length: 18 }, (_, i) => ({
    id: i + 1,
    name: `Edición #${42 - i} - ${lists[i % 4]}`,
    subject: `Tema especial de esta semana #${42 - i}`,
    list_name: lists[i % 4],
    list_id: (i % 4) + 1,
    status: statuses[i % statuses.length],
    send_at: new Date(Date.now() - i * 86400000 * 7).toISOString(),
    stats: {
      sent:    Math.floor(800  + Math.random() * 3000),
      opened:  Math.floor(200  + Math.random() * 1800),
      clicked: Math.floor(50   + Math.random() * 600),
      bounced: Math.floor(Math.random() * 30),
    },
  }));
}

function getDemoDailyStats() {
  const days = 30;
  const now = Date.now();
  const lists = [
    { id: 1, color: "#3b82f6" },
    { id: 2, color: "#10b981" },
    { id: 3, color: "#8b5cf6" },
    { id: 4, color: "#f59e0b" },
  ];
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now - (days - 1 - i) * 86400000);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const base = isWeekend ? 0.3 : 1;
    const obj: Record<string, unknown> = { date: date.toISOString().split("T")[0] };
    lists.forEach(l => { obj[`list_${l.id}`] = Math.floor(base * (10 + Math.random() * 80)); });
    return obj;
  });
}

function getDemoEmailStats() {
  const days = 30;
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now - (days - 1 - i) * 86400000);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const base = isWeekend ? 0.4 : 1;
    const sent    = Math.floor(base * (200 + Math.random() * 600));
    const opened  = Math.floor(sent * (0.28 + Math.random() * 0.22));
    const clicked = Math.floor(opened * (0.08 + Math.random() * 0.15));
    return { date: date.toISOString().split("T")[0], sent, opened, clicked };
  });
}

// ── Route helpers ─────────────────────────────────────────────────────────────

/** Wrap async route handler so errors go to Express error handler */
function asyncRoute(fn: (...args: any[]) => Promise<void>) {
  return (req: any, res: any, next: any) => fn(req, res, next).catch(next);
}

export async function registerRoutes(httpServer: Server, app: Express) {

  // ── LISTMONK PROXY ────────────────────────────────────────────────────────

  // Lists (= Newsletters)
  app.get("/api/listmonk/lists", asyncRoute(async (_req, res) => {
    if (!LISTMONK_ENABLED) {
      return res.json({ data: getDemoLists() });
    }
    const lists = await listLists();
    // Shape: same fields the frontend expects
    res.json({ data: lists.map(l => ({
      id: l.id,
      uuid: l.uuid,
      name: l.name,
      type: l.type,
      subscriber_count: l.subscriber_count,
    }))});
  }));

  // Templates (for funnel builder)
  app.get("/api/listmonk/templates", asyncRoute(async (_req, res) => {
    if (!LISTMONK_ENABLED) {
      return res.json({ data: [
        { id: 1, name: "Bienvenida v2",      subject: "¡Bienvenido!" },
        { id: 2, name: "Recursos semana",    subject: "Los mejores recursos" },
        { id: 3, name: "Re-engagement",      subject: "Te echamos de menos" },
        { id: 4, name: "Oferta especial",    subject: "Una oferta para ti" },
        { id: 5, name: "Newsletter semanal", subject: "Esta semana en {{list_name}}" },
      ]});
    }
    const templates = await listTemplates();
    res.json({ data: templates.map(t => ({ id: t.id, name: t.name, subject: t.subject })) });
  }));

  // Campaigns
  app.get("/api/listmonk/campaigns", asyncRoute(async (req, res) => {
    if (!LISTMONK_ENABLED) {
      return res.json({ data: getDemoCampaigns() });
    }
    const page = Number(req.query.page ?? 1);
    const { results, total } = await listCampaigns(page, 50);

    // Normalize to the shape the frontend expects
    const data = results.map(c => ({
      id:         c.id,
      name:       c.name,
      subject:    c.subject,
      status:     c.status,
      list_name:  c.lists?.[0]?.name ?? "—",
      list_id:    c.lists?.[0]?.id ?? null,
      send_at:    c.send_at ?? c.started_at ?? c.created_at,
      stats: {
        sent:    c.sent    ?? 0,
        opened:  c.views   ?? 0,
        clicked: c.clicks  ?? 0,
        bounced: c.bounces ?? 0,
      },
    }));

    res.json({ data, total });
  }));

  // Send test email
  app.post("/api/listmonk/campaigns/:id/test", asyncRoute(async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    if (!LISTMONK_ENABLED) {
      await new Promise(r => setTimeout(r, 600));
      return res.json({ ok: true, message: `Correo de prueba enviado a ${email} (modo demo)` });
    }

    await sendTestEmail(Number(req.params.id), [email]);
    res.json({ ok: true, message: `Correo de prueba enviado a ${email}` });
  }));

  // Update campaign
  app.patch("/api/listmonk/campaigns/:id", asyncRoute(async (req, res) => {
    if (!LISTMONK_ENABLED) {
      await new Promise(r => setTimeout(r, 300));
      return res.json({ ok: true, campaign: { id: req.params.id, ...req.body } });
    }
    const campaign = await updateCampaign(Number(req.params.id), req.body);
    res.json({ ok: true, campaign });
  }));

  // ── STATS ─────────────────────────────────────────────────────────────────

  // Daily subscriber counts per list (last 30 days)
  app.get("/api/stats/daily-subscribers", asyncRoute(async (_req, res) => {
    if (!LISTMONK_ENABLED) {
      return res.json({ data: getDemoDailyStats() });
    }

    // Fetch subscriber data for all lists in parallel
    const lists = await listLists();
    const results = await Promise.all(
      lists.map(l => getDailySubscriberStats(l.id, 30))
    );

    // Merge into [{date, list_1: N, list_2: N, ...}]
    const days = 30;
    const merged: Record<string, Record<string, unknown>> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().split("T")[0];
      merged[d] = { date: d };
    }
    lists.forEach((l, idx) => {
      Object.entries(results[idx]).forEach(([date, count]) => {
        if (merged[date]) merged[date][`list_${l.id}`] = count;
      });
    });

    res.json({ data: Object.values(merged) });
  }));

  // Email activity (sent / opened / clicked)
  app.get("/api/stats/email-activity", asyncRoute(async (_req, res) => {
    if (!LISTMONK_ENABLED) {
      return res.json({ data: getDemoEmailStats() });
    }

    // Aggregate from campaigns with send dates in last 30 days
    const { results } = await listCampaigns(1, 200);
    const cutoff = Date.now() - 30 * 86_400_000;
    const byDate: Record<string, { sent: number; opened: number; clicked: number }> = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().split("T")[0];
      byDate[d] = { sent: 0, opened: 0, clicked: 0 };
    }

    for (const c of results) {
      const ts = new Date(c.send_at ?? c.started_at ?? c.created_at).getTime();
      if (ts < cutoff) continue;
      const d = new Date(ts).toISOString().split("T")[0];
      if (!byDate[d]) continue;
      byDate[d].sent    += c.sent    ?? 0;
      byDate[d].opened  += c.views   ?? 0;
      byDate[d].clicked += c.clicks  ?? 0;
    }

    res.json({ data: Object.entries(byDate).map(([date, v]) => ({ date, ...v })) });
  }));

  // KPI cards
  app.get("/api/stats/kpis", asyncRoute(async (_req, res) => {
    if (!LISTMONK_ENABLED) {
      return res.json({ data: {
        total_subscribers:        10704,
        subscribers_last_7d:      342,
        subscribers_last_7d_delta: 12.4,
        emails_sent_30d:          48320,
        avg_open_rate:            38.2,
        avg_click_rate:            6.8,
        active_funnels:            1,
        pending_in_funnels:        47,
      }});
    }

    const [lists, { results: campaigns }] = await Promise.all([
      listLists(),
      listCampaigns(1, 200),
    ]);

    const totalSubs = lists.reduce((a, l) => a + (l.subscriber_count ?? 0), 0);

    // Last-7-day subscriber delta (rough: sum new subs across all lists)
    let subs7d = 0;
    try {
      const perList = await Promise.all(lists.map(l => getDailySubscriberStats(l.id, 7)));
      perList.forEach(map => { Object.values(map).forEach(n => { subs7d += n; }); });
    } catch { /* non-critical */ }

    // 30d email stats
    const cutoff30 = Date.now() - 30 * 86_400_000;
    let sent30 = 0; let totalOpen = 0; let totalClick = 0; let statCount = 0;
    for (const c of campaigns) {
      const ts = new Date(c.send_at ?? c.started_at ?? c.created_at).getTime();
      if (ts < cutoff30) continue;
      sent30 += c.sent ?? 0;
      if (c.sent && c.sent > 0) {
        totalOpen  += (c.views   ?? 0) / c.sent;
        totalClick += (c.clicks  ?? 0) / c.sent;
        statCount++;
      }
    }

    const activeFunnels = (await storage.getAllFunnels()).filter(f => f.status === "active").length;

    res.json({ data: {
      total_subscribers:         totalSubs,
      subscribers_last_7d:       subs7d,
      subscribers_last_7d_delta: null, // requires historical data
      emails_sent_30d:           sent30,
      avg_open_rate:             statCount ? Math.round((totalOpen / statCount) * 1000) / 10 : 0,
      avg_click_rate:            statCount ? Math.round((totalClick / statCount) * 1000) / 10 : 0,
      active_funnels:            activeFunnels,
      pending_in_funnels:        0,
    }});
  }));

  // ── NEWSLETTER SETTINGS ───────────────────────────────────────────────────

  app.get("/api/newsletter-settings", asyncRoute(async (_req, res) => {
    const settings = await storage.getAllNewsletterSettings();
    res.json({ data: settings });
  }));

  app.get("/api/newsletter-settings/:listId", asyncRoute(async (req, res) => {
    const settings = await storage.getNewsletterSettingsByListId(Number(req.params.listId));
    if (!settings) return res.status(404).json({ error: "No encontrado" });
    res.json({ data: settings });
  }));

  app.put("/api/newsletter-settings", asyncRoute(async (req, res) => {
    const data = insertNewsletterSettingsSchema.parse(req.body);
    const result = await storage.upsertNewsletterSettings(data);
    res.json({ data: result });
  }));

  // ── FUNNELS ───────────────────────────────────────────────────────────────

  app.get("/api/funnels", asyncRoute(async (_req, res) => {
    const funnels = await storage.getAllFunnels();
    const enriched = await Promise.all(funnels.map(async f => {
      const [stats, steps] = await Promise.all([
        storage.getEnrollmentStats(f.id),
        storage.getStepsByFunnelId(f.id),
      ]);
      return { ...f, stats, stepCount: steps.length };
    }));
    res.json({ data: enriched });
  }));

  app.get("/api/funnels/:id", asyncRoute(async (req, res) => {
    const funnel = await storage.getFunnelById(req.params.id);
    if (!funnel) return res.status(404).json({ error: "No encontrado" });
    const [steps, stats, logs] = await Promise.all([
      storage.getStepsByFunnelId(funnel.id),
      storage.getEnrollmentStats(funnel.id),
      storage.getLogsByFunnelId(funnel.id, 20),
    ]);
    res.json({ data: { ...funnel, steps, stats, logs } });
  }));

  app.post("/api/funnels", asyncRoute(async (req, res) => {
    const data = insertFunnelSchema.parse(req.body);
    const funnel = await storage.createFunnel(data);
    if (req.body.steps?.length) {
      const steps = z.array(insertFunnelStepSchema).parse(
        req.body.steps.map((s: any) => ({ ...s, funnelId: funnel.id }))
      );
      await storage.upsertFunnelSteps(funnel.id, steps);
    }
    res.status(201).json({ data: funnel });
  }));

  app.patch("/api/funnels/:id", asyncRoute(async (req, res) => {
    const updated = await storage.updateFunnel(req.params.id, req.body);
    if (req.body.steps) {
      const steps = req.body.steps.map((s: any) => ({ ...s, funnelId: req.params.id }));
      await storage.upsertFunnelSteps(req.params.id, steps);
    }
    res.json({ data: updated });
  }));

  app.delete("/api/funnels/:id", asyncRoute(async (req, res) => {
    await storage.deleteFunnel(req.params.id);
    res.json({ ok: true });
  }));

  app.get("/api/funnels/:id/enrollments", asyncRoute(async (req, res) => {
    const enrollments = await storage.getEnrollmentsByFunnelId(req.params.id);
    res.json({ data: enrollments });
  }));

  app.get("/api/funnels/:id/logs", asyncRoute(async (req, res) => {
    const logs = await storage.getLogsByFunnelId(req.params.id, 50);
    res.json({ data: logs });
  }));

  // ── SUBSCRIBERS ──────────────────────────────────────────────────────────

  // List / search subscribers
  app.get("/api/subscribers", asyncRoute(async (req, res) => {
    const page    = Number(req.query.page ?? 1);
    const perPage = Number(req.query.per_page ?? 25);
    const query   = req.query.query as string | undefined;
    const listId  = req.query.list_id as string | undefined;

    if (!LISTMONK_ENABLED) {
      // Demo data
      const demo = Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        uuid: `uuid-${i}`,
        email: `usuario${i + 1}@ejemplo.com`,
        name: `Usuario Demo ${i + 1}`,
        status: ["enabled", "enabled", "enabled", "disabled", "blocklisted"][i % 5],
        lists: [{ id: 1, name: "Tech Weekly" }],
        subscriptions: [{ id: 1, name: "Tech Weekly", subscription_status: "confirmed", subscription_type: "single", subscription_created_at: new Date().toISOString(), subscription_updated_at: new Date().toISOString() }],
        bounces: [],
        activity: { campaigns: 0, views: 0, clicks: 0, views_list: [] },
        created_at: new Date(Date.now() - i * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const filtered = query
        ? demo.filter(s => s.email.includes(query) || s.name.toLowerCase().includes(query.toLowerCase()))
        : demo;
      const paginated = filtered.slice((page - 1) * perPage, page * perPage);
      return res.json({ data: { results: paginated, total: filtered.length } });
    }

    const lm = getListmonkClient();
    const params: Record<string, any> = { page, per_page: perPage, order_by: "created_at", order: "DESC" };
    if (query) {
      // ListMonk expects SQL-like expressions for subscriber search
      const escaped = query.replace(/'/g, "''");
      params.query = `(subscribers.email ILIKE '%${escaped}%' OR subscribers.name ILIKE '%${escaped}%')`;
    }
    if (listId) params.list_id = listId;
    const r = await lm.get("/api/subscribers", { params });
    res.json({ data: r.data?.data });
  }));

  // Get single subscriber with full detail
  app.get("/api/subscribers/:id", asyncRoute(async (req, res) => {
    if (!LISTMONK_ENABLED) return res.json({ data: null });
    const lm = getListmonkClient();
    const r = await lm.get(`/api/subscribers/${req.params.id}`);
    res.json({ data: r.data?.data });
  }));

  // Update subscriber
  app.put("/api/subscribers/:id", asyncRoute(async (req, res) => {
    if (!LISTMONK_ENABLED) {
      return res.json({ data: { id: req.params.id, ...req.body } });
    }
    const lm = getListmonkClient();
    const r = await lm.put(`/api/subscribers/${req.params.id}`, req.body);
    res.json({ data: r.data?.data });
  }));

  // ── CREATE CAMPAIGN ──────────────────────────────────────────────────────

  app.post("/api/listmonk/campaigns", asyncRoute(async (req, res) => {
    if (!LISTMONK_ENABLED) {
      // Demo: return fake created campaign
      const fake = {
        id: Math.floor(Math.random() * 9000 + 1000),
        name: req.body.name,
        subject: req.body.subject,
        status: req.body.status ?? "draft",
        lists: (req.body.lists ?? []).map((id: number) => ({ id, name: "Demo List" })),
        created_at: new Date().toISOString(),
      };
      return res.status(201).json({ data: fake });
    }
    const lm = getListmonkClient();
    const r = await lm.post("/api/campaigns", req.body);
    res.status(201).json({ data: r.data?.data });
  }));

  // ── CREATE LIST ───────────────────────────────────────────────────────────

  app.post("/api/listmonk/lists", asyncRoute(async (req, res) => {
    if (!LISTMONK_ENABLED) {
      const fake = {
        id: Math.floor(Math.random() * 9000 + 100),
        uuid: `list-uuid-new-${Date.now()}`,
        name: req.body.name,
        type: req.body.type ?? "public",
        subscriber_count: 0,
        created_at: new Date().toISOString(),
      };
      return res.status(201).json({ data: fake });
    }
    const lm = getListmonkClient();
    const r = await lm.post("/api/lists", req.body);
    res.status(201).json({ data: r.data?.data });
  }));

  // ── SUPER SUBSCRIBERS ────────────────────────────────────────────────────

  app.get("/api/stats/super-subscribers", asyncRoute(async (req, res) => {
    const listIds = (req.query.lists as string ?? "").split(",").map(Number).filter(Boolean);

    if (!LISTMONK_ENABLED || listIds.length < 2) {
      return res.json({ data: { subscribers: [], counts: [] } });
    }

    // Query ListMonk's DB directly for subscribers in multiple selected lists
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return res.json({ data: { subscribers: [], counts: [] } });

    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: dbUrl });

    try {
      // Get subscribers that are in 2+ of the selected lists
      const result = await pool.query(`
        SELECT s.id, s.email, s.name, s.status,
               array_agg(sl.list_id ORDER BY sl.list_id) AS list_ids,
               COUNT(DISTINCT sl.list_id)::int AS list_count
        FROM public.subscribers s
        JOIN public.subscriber_lists sl ON s.id = sl.subscriber_id
        WHERE sl.list_id = ANY($1)
          AND sl.status != 'unsubscribed'
        GROUP BY s.id, s.email, s.name, s.status
        HAVING COUNT(DISTINCT sl.list_id) >= 2
        ORDER BY COUNT(DISTINCT sl.list_id) DESC, s.email ASC
        LIMIT 500
      `, [listIds]);

      // Get count breakdown: how many subs share exactly 2, 3, 4... lists
      const countResult = await pool.query(`
        SELECT shared_count, COUNT(*)::int AS subscriber_count
        FROM (
          SELECT s.id, COUNT(DISTINCT sl.list_id)::int AS shared_count
          FROM public.subscribers s
          JOIN public.subscriber_lists sl ON s.id = sl.subscriber_id
          WHERE sl.list_id = ANY($1)
            AND sl.status != 'unsubscribed'
          GROUP BY s.id
          HAVING COUNT(DISTINCT sl.list_id) >= 2
        ) sub
        GROUP BY shared_count
        ORDER BY shared_count DESC
      `, [listIds]);

      res.json({
        data: {
          subscribers: result.rows,
          counts: countResult.rows,
          total: countResult.rows.reduce((a: number, r: any) => a + r.subscriber_count, 0),
        }
      });
    } finally {
      await pool.end();
    }
  }));

  // Global Express error handler (catches asyncRoute errors)
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status ?? err.statusCode ?? 500;
    const message = err.message ?? "Internal server error";
    console.error("[mailflow error]", status, message);
    res.status(status).json({ error: message });
  });

  return httpServer;
}
