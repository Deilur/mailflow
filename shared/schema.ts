import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Newsletter Settings (per list brand config) ──────────────────
export const newsletterSettings = pgTable("newsletter_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listmonkListId: integer("listmonk_list_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  replyTo: text("reply_to"),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").default("#3b82f6"),
  description: text("description"),
  // Base template: header HTML, footer HTML, custom CSS
  templateHeader: text("template_header"),
  templateFooter: text("template_footer"),
  templateCss: text("template_css"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewsletterSettingsSchema = createInsertSchema(newsletterSettings).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertNewsletterSettings = z.infer<typeof insertNewsletterSettingsSchema>;
export type NewsletterSettings = typeof newsletterSettings.$inferSelect;

// ── Funnels ──────────────────────────────────────────────────────
export const funnels = pgTable("funnels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  listmonkListId: integer("listmonk_list_id").notNull(),
  status: text("status").notNull().default("draft"),
  entryPolicy: text("entry_policy").notNull().default("once"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFunnelSchema = createInsertSchema(funnels).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertFunnel = z.infer<typeof insertFunnelSchema>;
export type Funnel = typeof funnels.$inferSelect;

// ── Funnel Steps ─────────────────────────────────────────────────
export const funnelSteps = pgTable("funnel_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  funnelId: varchar("funnel_id").notNull(),
  position: integer("position").notNull().default(0),
  stepType: text("step_type").notNull(),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFunnelStepSchema = createInsertSchema(funnelSteps).omit({
  id: true, createdAt: true,
});
export type InsertFunnelStep = z.infer<typeof insertFunnelStepSchema>;
export type FunnelStep = typeof funnelSteps.$inferSelect;

// ── Funnel Enrollments ───────────────────────────────────────────
export const funnelEnrollments = pgTable("funnel_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  funnelId: varchar("funnel_id").notNull(),
  subscriberUuid: text("subscriber_uuid").notNull(),
  subscriberEmail: text("subscriber_email").notNull(),
  currentStepPos: integer("current_step_pos").notNull().default(0),
  status: text("status").notNull().default("active"),
  nextRunAt: timestamp("next_run_at"),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type FunnelEnrollment = typeof funnelEnrollments.$inferSelect;

// ── Execution Logs ───────────────────────────────────────────────
export const executionLogs = pgTable("execution_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: varchar("enrollment_id").notNull(),
  funnelId: varchar("funnel_id").notNull(),
  stepPosition: integer("step_position").notNull(),
  stepType: text("step_type").notNull(),
  outcome: text("outcome").notNull(),
  details: jsonb("details").notNull().default({}),
  executedAt: timestamp("executed_at").defaultNow(),
});

export type ExecutionLog = typeof executionLogs.$inferSelect;
