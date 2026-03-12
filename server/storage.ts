/**
 * MailFlow Storage
 *
 * Two implementations:
 *   - PgStorage  → uses the real PostgreSQL (mailflow schema) on VPS
 *   - MemStorage → in-memory fallback used by the demo/preview build
 *
 * The active instance is exported as `storage`.
 * Set DATABASE_URL in .env to switch to PgStorage automatically.
 */
import {
  type NewsletterSettings, type InsertNewsletterSettings,
  type Funnel, type InsertFunnel,
  type FunnelStep, type InsertFunnelStep,
  type FunnelEnrollment,
  type ExecutionLog,
} from "@shared/schema";
import { randomUUID } from "crypto";

// ── Interface ────────────────────────────────────────────────────────────────

export interface IStorage {
  // Newsletter Settings
  getAllNewsletterSettings(): Promise<NewsletterSettings[]>;
  getNewsletterSettingsByListId(listId: number): Promise<NewsletterSettings | undefined>;
  upsertNewsletterSettings(data: InsertNewsletterSettings): Promise<NewsletterSettings>;
  deleteNewsletterSettings(id: string): Promise<void>;

  // Funnels
  getAllFunnels(): Promise<Funnel[]>;
  getFunnelById(id: string): Promise<Funnel | undefined>;
  createFunnel(data: InsertFunnel): Promise<Funnel>;
  updateFunnel(id: string, data: Partial<InsertFunnel>): Promise<Funnel>;
  deleteFunnel(id: string): Promise<void>;

  // Funnel Steps
  getStepsByFunnelId(funnelId: string): Promise<FunnelStep[]>;
  upsertFunnelSteps(funnelId: string, steps: InsertFunnelStep[]): Promise<FunnelStep[]>;

  // Enrollments
  getEnrollmentsByFunnelId(funnelId: string): Promise<FunnelEnrollment[]>;
  getEnrollmentStats(funnelId: string): Promise<{ active: number; waiting: number; completed: number; errored: number }>;

  // Logs
  getLogsByFunnelId(funnelId: string, limit?: number): Promise<ExecutionLog[]>;
}

// ── PostgreSQL Implementation ─────────────────────────────────────────────────

export class PgStorage implements IStorage {
  private pool: import("pg").Pool;

  constructor(connectionString: string) {
    // Lazy import pg so the build doesn't break when pg isn't installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    this.pool = new Pool({
      connectionString,
      // Always route queries to the mailflow schema
      // (also set in 001_mailflow_schema.sql via SET search_path)
      options: "-c search_path=mailflow,public",
    });
  }

  private async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows as T[];
    } finally {
      client.release();
    }
  }

  // ── Newsletter Settings ──────────────────────────────────────────────────

  async getAllNewsletterSettings(): Promise<NewsletterSettings[]> {
    const rows = await this.query<any>(`
      SELECT id, listmonk_list_id AS "listmonkListId", display_name AS "displayName",
             from_email AS "fromEmail", from_name AS "fromName", reply_to AS "replyTo",
             logo_url AS "logoUrl", brand_color AS "brandColor", description,
             template_header AS "templateHeader", template_footer AS "templateFooter",
             template_css AS "templateCss", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM newsletter_settings
      ORDER BY created_at ASC
    `);
    return rows.map(this._mapNS);
  }

  async getNewsletterSettingsByListId(listId: number): Promise<NewsletterSettings | undefined> {
    const rows = await this.query<any>(`
      SELECT id, listmonk_list_id AS "listmonkListId", display_name AS "displayName",
             from_email AS "fromEmail", from_name AS "fromName", reply_to AS "replyTo",
             logo_url AS "logoUrl", brand_color AS "brandColor", description,
             template_header AS "templateHeader", template_footer AS "templateFooter",
             template_css AS "templateCss", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM newsletter_settings
      WHERE listmonk_list_id = $1
    `, [listId]);
    return rows.length ? this._mapNS(rows[0]) : undefined;
  }

  async upsertNewsletterSettings(data: InsertNewsletterSettings): Promise<NewsletterSettings> {
    const id = randomUUID();
    const rows = await this.query<any>(`
      INSERT INTO newsletter_settings (
        id, listmonk_list_id, display_name, from_email, from_name,
        reply_to, logo_url, brand_color, description,
        template_header, template_footer, template_css
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (listmonk_list_id) DO UPDATE SET
        display_name    = EXCLUDED.display_name,
        from_email      = EXCLUDED.from_email,
        from_name       = EXCLUDED.from_name,
        reply_to        = EXCLUDED.reply_to,
        logo_url        = EXCLUDED.logo_url,
        brand_color     = EXCLUDED.brand_color,
        description     = EXCLUDED.description,
        template_header = EXCLUDED.template_header,
        template_footer = EXCLUDED.template_footer,
        template_css    = EXCLUDED.template_css,
        updated_at      = NOW()
      RETURNING
        id, listmonk_list_id AS "listmonkListId", display_name AS "displayName",
        from_email AS "fromEmail", from_name AS "fromName", reply_to AS "replyTo",
        logo_url AS "logoUrl", brand_color AS "brandColor", description,
        template_header AS "templateHeader", template_footer AS "templateFooter",
        template_css AS "templateCss", created_at AS "createdAt", updated_at AS "updatedAt"
    `, [
      id, data.listmonkListId, data.displayName, data.fromEmail, data.fromName,
      data.replyTo ?? null, data.logoUrl ?? null, data.brandColor ?? null, data.description ?? null,
      data.templateHeader ?? null, data.templateFooter ?? null, data.templateCss ?? null,
    ]);
    return this._mapNS(rows[0]);
  }

  async deleteNewsletterSettings(id: string): Promise<void> {
    await this.query(`DELETE FROM newsletter_settings WHERE id = $1`, [id]);
  }

  private _mapNS(r: any): NewsletterSettings {
    return {
      ...r,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
    };
  }

  // ── Funnels ──────────────────────────────────────────────────────────────

  async getAllFunnels(): Promise<Funnel[]> {
    return this.query<Funnel>(`
      SELECT id, name, description, listmonk_list_id AS "listmonkListId",
             status, entry_policy AS "entryPolicy",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM funnels
      ORDER BY created_at DESC
    `);
  }

  async getFunnelById(id: string): Promise<Funnel | undefined> {
    const rows = await this.query<Funnel>(`
      SELECT id, name, description, listmonk_list_id AS "listmonkListId",
             status, entry_policy AS "entryPolicy",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM funnels WHERE id = $1
    `, [id]);
    return rows[0];
  }

  async createFunnel(data: InsertFunnel): Promise<Funnel> {
    const id = randomUUID();
    const rows = await this.query<Funnel>(`
      INSERT INTO funnels (id, name, description, listmonk_list_id, status, entry_policy)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, name, description, listmonk_list_id AS "listmonkListId",
                status, entry_policy AS "entryPolicy",
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [id, data.name, data.description ?? null, data.listmonkListId, data.status ?? "draft", data.entryPolicy ?? "once"]);
    return rows[0];
  }

  async updateFunnel(id: string, data: Partial<InsertFunnel>): Promise<Funnel> {
    // Build dynamic SET clause
    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (data.name !== undefined)            { fields.push(`name = $${i++}`);              vals.push(data.name); }
    if (data.description !== undefined)     { fields.push(`description = $${i++}`);       vals.push(data.description); }
    if (data.status !== undefined)          { fields.push(`status = $${i++}`);            vals.push(data.status); }
    if (data.entryPolicy !== undefined)     { fields.push(`entry_policy = $${i++}`);      vals.push(data.entryPolicy); }
    if (data.listmonkListId !== undefined)  { fields.push(`listmonk_list_id = $${i++}`);  vals.push(data.listmonkListId); }
    fields.push(`updated_at = NOW()`);
    vals.push(id);
    const rows = await this.query<Funnel>(`
      UPDATE funnels SET ${fields.join(", ")} WHERE id = $${i}
      RETURNING id, name, description, listmonk_list_id AS "listmonkListId",
                status, entry_policy AS "entryPolicy",
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, vals);
    if (!rows[0]) throw new Error("Funnel not found");
    return rows[0];
  }

  async deleteFunnel(id: string): Promise<void> {
    await this.query(`DELETE FROM funnels WHERE id = $1`, [id]);
  }

  // ── Funnel Steps ─────────────────────────────────────────────────────────

  async getStepsByFunnelId(funnelId: string): Promise<FunnelStep[]> {
    return this.query<FunnelStep>(`
      SELECT id, funnel_id AS "funnelId", position,
             step_type AS "stepType", config,
             created_at AS "createdAt"
      FROM funnel_steps
      WHERE funnel_id = $1
      ORDER BY position ASC
    `, [funnelId]);
  }

  async upsertFunnelSteps(funnelId: string, steps: InsertFunnelStep[]): Promise<FunnelStep[]> {
    await this.query(`DELETE FROM funnel_steps WHERE funnel_id = $1`, [funnelId]);
    const created: FunnelStep[] = [];
    for (const s of steps) {
      const id = randomUUID();
      const rows = await this.query<FunnelStep>(`
        INSERT INTO funnel_steps (id, funnel_id, position, step_type, config)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING id, funnel_id AS "funnelId", position,
                  step_type AS "stepType", config,
                  created_at AS "createdAt"
      `, [id, funnelId, s.position, s.stepType, JSON.stringify(s.config ?? {})]);
      created.push(rows[0]);
    }
    return created;
  }

  // ── Enrollments ──────────────────────────────────────────────────────────

  async getEnrollmentsByFunnelId(funnelId: string): Promise<FunnelEnrollment[]> {
    return this.query<FunnelEnrollment>(`
      SELECT id, funnel_id AS "funnelId",
             subscriber_uuid AS "subscriberUuid", subscriber_email AS "subscriberEmail",
             current_step_pos AS "currentStepPos", status,
             next_run_at AS "nextRunAt", enrolled_at AS "enrolledAt", completed_at AS "completedAt"
      FROM funnel_enrollments
      WHERE funnel_id = $1
      ORDER BY enrolled_at DESC
    `, [funnelId]);
  }

  async getEnrollmentStats(funnelId: string): Promise<{ active: number; waiting: number; completed: number; errored: number }> {
    const rows = await this.query<{ status: string; count: string }>(`
      SELECT status, COUNT(*)::int AS count
      FROM funnel_enrollments
      WHERE funnel_id = $1
      GROUP BY status
    `, [funnelId]);
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.status] = Number(r.count); });
    return {
      active:    map["active"]    ?? 0,
      waiting:   map["waiting"]   ?? 0,
      completed: map["completed"] ?? 0,
      errored:   map["errored"]   ?? 0,
    };
  }

  // ── Logs ─────────────────────────────────────────────────────────────────

  async getLogsByFunnelId(funnelId: string, limit = 50): Promise<ExecutionLog[]> {
    return this.query<ExecutionLog>(`
      SELECT id, enrollment_id AS "enrollmentId", funnel_id AS "funnelId",
             step_position AS "stepPosition", step_type AS "stepType",
             outcome, details, executed_at AS "executedAt"
      FROM funnel_execution_logs
      WHERE funnel_id = $1
      ORDER BY executed_at DESC
      LIMIT $2
    `, [funnelId, limit]);
  }
}

// ── In-Memory Fallback (demo / preview) ──────────────────────────────────────

export class MemStorage implements IStorage {
  private newsletterSettings: Map<string, NewsletterSettings> = new Map();
  private funnels: Map<string, Funnel> = new Map();
  private funnelSteps: Map<string, FunnelStep> = new Map();
  private enrollments: Map<string, FunnelEnrollment> = new Map();
  private logs: Map<string, ExecutionLog> = new Map();

  constructor() { this._seedDemoData(); }

  private _seedDemoData() {
    const nls: NewsletterSettings[] = [
      { id: "ns-1", listmonkListId: 1, displayName: "Tech Weekly", fromEmail: "tech@acme.com", fromName: "Tech Weekly", replyTo: "hello@acme.com", logoUrl: null, brandColor: "#3b82f6", description: "The best of tech, curated weekly.", templateHeader: null, templateFooter: null, templateCss: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "ns-2", listmonkListId: 2, displayName: "Growth Digest", fromEmail: "growth@acme.com", fromName: "Growth Digest", replyTo: "hello@acme.com", logoUrl: null, brandColor: "#10b981", description: "Marketing and growth tactics for founders.", templateHeader: null, templateFooter: null, templateCss: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "ns-3", listmonkListId: 3, displayName: "Design Pulse", fromEmail: "design@acme.com", fromName: "Design Pulse", replyTo: null, logoUrl: null, brandColor: "#8b5cf6", description: "Curated UI/UX inspiration.", templateHeader: null, templateFooter: null, templateCss: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "ns-4", listmonkListId: 4, displayName: "Founders Brief", fromEmail: "brief@acme.com", fromName: "Founders Brief", replyTo: null, logoUrl: null, brandColor: "#f59e0b", description: "Weekly roundup for startup founders.", templateHeader: null, templateFooter: null, templateCss: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    nls.forEach(n => this.newsletterSettings.set(n.id, n));

    const f1: Funnel = { id: "f-1", name: "Bienvenida Tech Weekly", description: "Secuencia de onboarding para nuevos suscriptores", listmonkListId: 1, status: "active", entryPolicy: "once", createdAt: new Date(), updatedAt: new Date() };
    const f2: Funnel = { id: "f-2", name: "Re-engagement Growth", description: "Reactiva suscriptores inactivos", listmonkListId: 2, status: "paused", entryPolicy: "once_per_period", createdAt: new Date(), updatedAt: new Date() };
    this.funnels.set(f1.id, f1);
    this.funnels.set(f2.id, f2);

    const steps: FunnelStep[] = [
      { id: "s-1", funnelId: "f-1", position: 0, stepType: "send_email", config: { template_id: 1, subject: "¡Bienvenido a Tech Weekly!" }, createdAt: new Date() },
      { id: "s-2", funnelId: "f-1", position: 1, stepType: "wait", config: { duration: 2, unit: "days" }, createdAt: new Date() },
      { id: "s-3", funnelId: "f-1", position: 2, stepType: "send_email", config: { template_id: 2, subject: "Los mejores recursos" }, createdAt: new Date() },
    ];
    steps.forEach(s => this.funnelSteps.set(s.id, s));

    const statuses = ["active", "waiting", "completed", "completed", "completed", "errored"];
    for (let i = 0; i < 24; i++) {
      const e: FunnelEnrollment = { id: `e-${i}`, funnelId: "f-1", subscriberUuid: `uuid-${i}`, subscriberEmail: `user${i}@example.com`, currentStepPos: i % 3, status: statuses[i % statuses.length], nextRunAt: i % 3 === 0 ? new Date(Date.now() + 86400000) : null, enrolledAt: new Date(Date.now() - i * 3600000 * 12), completedAt: null };
      this.enrollments.set(e.id, e);
    }
    for (let i = 0; i < 30; i++) {
      const outcomes = ["success", "success", "success", "scheduled", "failure"];
      const l: ExecutionLog = { id: `log-${i}`, enrollmentId: `e-${i % 24}`, funnelId: "f-1", stepPosition: i % 3, stepType: i % 2 === 0 ? "send_email" : "wait", outcome: outcomes[i % 5], details: { template_id: 1 }, executedAt: new Date(Date.now() - i * 1800000) };
      this.logs.set(l.id, l);
    }
  }

  async getAllNewsletterSettings() { return Array.from(this.newsletterSettings.values()); }
  async getNewsletterSettingsByListId(listId: number) { return Array.from(this.newsletterSettings.values()).find(n => n.listmonkListId === listId); }
  async upsertNewsletterSettings(data: InsertNewsletterSettings): Promise<NewsletterSettings> {
    const existing = await this.getNewsletterSettingsByListId(data.listmonkListId);
    const id = existing?.id ?? randomUUID();
    const record: NewsletterSettings = {
      id,
      listmonkListId: data.listmonkListId,
      displayName: data.displayName,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      description: data.description ?? null,
      replyTo: data.replyTo ?? null,
      logoUrl: data.logoUrl ?? null,
      brandColor: data.brandColor ?? "#3b82f6",
      templateHeader: data.templateHeader ?? null,
      templateFooter: data.templateFooter ?? null,
      templateCss: data.templateCss ?? null,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.newsletterSettings.set(id, record);
    return record;
  }
  async deleteNewsletterSettings(id: string) { this.newsletterSettings.delete(id); }
  async getAllFunnels() { return Array.from(this.funnels.values()); }
  async getFunnelById(id: string) { return this.funnels.get(id); }
  async createFunnel(data: InsertFunnel): Promise<Funnel> {
    const id = randomUUID();
    const f: Funnel = {
      id,
      name: data.name,
      description: data.description ?? null,
      listmonkListId: data.listmonkListId,
      status: data.status ?? "draft",
      entryPolicy: data.entryPolicy ?? "once",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.funnels.set(id, f);
    return f;
  }
  async updateFunnel(id: string, data: Partial<InsertFunnel>): Promise<Funnel> {
    const existing = this.funnels.get(id);
    if (!existing) throw new Error("Funnel not found");
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.funnels.set(id, updated);
    return updated;
  }
  async deleteFunnel(id: string) { this.funnels.delete(id); }
  async getStepsByFunnelId(funnelId: string): Promise<FunnelStep[]> {
    return Array.from(this.funnelSteps.values()).filter(s => s.funnelId === funnelId).sort((a, b) => a.position - b.position);
  }
  async upsertFunnelSteps(funnelId: string, steps: InsertFunnelStep[]): Promise<FunnelStep[]> {
    Array.from(this.funnelSteps.values()).filter(s => s.funnelId === funnelId).forEach(s => this.funnelSteps.delete(s.id));
    const created: FunnelStep[] = steps.map(s => ({
      id: randomUUID(),
      funnelId: s.funnelId,
      position: s.position ?? 0,
      stepType: s.stepType,
      config: s.config ?? {},
      createdAt: new Date(),
    }));
    created.forEach(s => this.funnelSteps.set(s.id, s));
    return created;
  }
  async getEnrollmentsByFunnelId(funnelId: string): Promise<FunnelEnrollment[]> {
    return Array.from(this.enrollments.values()).filter(e => e.funnelId === funnelId).sort((a, b) => (b.enrolledAt?.getTime() ?? 0) - (a.enrolledAt?.getTime() ?? 0));
  }
  async getEnrollmentStats(funnelId: string) {
    const all = await this.getEnrollmentsByFunnelId(funnelId);
    return { active: all.filter(e => e.status === "active").length, waiting: all.filter(e => e.status === "waiting").length, completed: all.filter(e => e.status === "completed").length, errored: all.filter(e => e.status === "errored").length };
  }
  async getLogsByFunnelId(funnelId: string, limit = 50): Promise<ExecutionLog[]> {
    return Array.from(this.logs.values()).filter(l => l.funnelId === funnelId).sort((a, b) => (b.executedAt?.getTime() ?? 0) - (a.executedAt?.getTime() ?? 0)).slice(0, limit);
  }
}

// ── Export singleton ──────────────────────────────────────────────────────────

function createStorage(): IStorage {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log("[mailflow] Using PostgreSQL storage (mailflow schema)");
    return new PgStorage(dbUrl);
  }
  console.log("[mailflow] DATABASE_URL not set — using in-memory storage (demo mode)");
  return new MemStorage();
}

export const storage = createStorage();
