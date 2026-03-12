/**
 * Funnel Execution Engine
 *
 * 1. PostgreSQL LISTEN on `new_subscriber` channel
 *    → instantly enrolls new subscribers into matching active funnels
 * 2. Background worker (every 60s)
 *    → processes enrollments whose next_run_at <= NOW()
 *    → executes steps: send_email, wait, add_to_list, remove_from_list, webhook
 */

import { storage } from "./storage";
import { getListmonkClient, sendTransactional } from "./listmonk";
import { log } from "./index";

const WORKER_INTERVAL_MS = 60_000; // 1 minute
let listenerClient: any = null;
let workerTimer: ReturnType<typeof setInterval> | null = null;

// ── PG LISTEN for new subscribers ────────────────────────────────────────────

export async function setupSubscriberListener() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log("No DATABASE_URL — skipping subscriber listener", "funnel-worker");
    return;
  }

  try {
    const { Client } = require("pg");
    listenerClient = new Client({ connectionString: dbUrl });
    await listenerClient.connect();

    // Create trigger function and trigger on public.subscriber_lists if not exists
    await listenerClient.query(`
      CREATE OR REPLACE FUNCTION public.notify_new_subscriber()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify('new_subscriber', json_build_object(
          'subscriber_id', NEW.subscriber_id,
          'list_id', NEW.list_id
        )::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await listenerClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_new_subscriber'
        ) THEN
          CREATE TRIGGER trg_notify_new_subscriber
            AFTER INSERT ON public.subscriber_lists
            FOR EACH ROW EXECUTE FUNCTION public.notify_new_subscriber();
        END IF;
      END $$;
    `);

    await listenerClient.query("LISTEN new_subscriber");

    listenerClient.on("notification", async (msg: any) => {
      if (msg.channel !== "new_subscriber") return;
      try {
        const payload = JSON.parse(msg.payload);
        log(`New subscriber detected: sub=${payload.subscriber_id} list=${payload.list_id}`, "funnel-worker");
        await enrollSubscriber(payload.subscriber_id, payload.list_id);
      } catch (err: any) {
        log(`Error processing subscriber notification: ${err.message}`, "funnel-worker");
      }
    });

    log("Listening for new subscriber events (pg_notify)", "funnel-worker");
  } catch (err: any) {
    log(`Failed to setup subscriber listener: ${err.message}`, "funnel-worker");
  }
}

// ── Enroll subscriber in matching funnels ─────────────────────────────────────

async function enrollSubscriber(subscriberId: number, listId: number) {
  const funnels = await storage.getActiveFunnelsByListId(listId);
  if (funnels.length === 0) return;

  // Fetch subscriber details from ListMonk
  const lm = getListmonkClient();
  let subscriber: any;
  try {
    const res = await lm.get(`/api/subscribers/${subscriberId}`);
    subscriber = res.data?.data;
  } catch (err: any) {
    log(`Could not fetch subscriber ${subscriberId}: ${err.message}`, "funnel-worker");
    return;
  }

  if (!subscriber) return;

  for (const funnel of funnels) {
    // Check entry policy
    if (funnel.entryPolicy === "once") {
      const existing = await storage.getEnrollmentByFunnelAndSubscriber(funnel.id, subscriber.uuid);
      if (existing) {
        log(`Subscriber ${subscriber.email} already enrolled in funnel "${funnel.name}", skipping`, "funnel-worker");
        continue;
      }
    }

    const enrollment = await storage.createEnrollment({
      funnelId: funnel.id,
      subscriberUuid: subscriber.uuid,
      subscriberEmail: subscriber.email,
      nextRunAt: new Date(), // process immediately
    });

    if (enrollment) {
      log(`Enrolled ${subscriber.email} in funnel "${funnel.name}"`, "funnel-worker");
    }
  }
}

// ── Background worker: process ready enrollments ─────────────────────────────

export function startWorker() {
  log("Starting funnel worker (interval: 60s)", "funnel-worker");

  // Run immediately on startup
  processEnrollments().catch(err => {
    log(`Worker error: ${err.message}`, "funnel-worker");
  });

  workerTimer = setInterval(async () => {
    try {
      await processEnrollments();
    } catch (err: any) {
      log(`Worker error: ${err.message}`, "funnel-worker");
    }
  }, WORKER_INTERVAL_MS);
}

async function processEnrollments() {
  const readyEnrollments = await storage.getReadyEnrollments(100);
  if (readyEnrollments.length === 0) return;

  log(`Processing ${readyEnrollments.length} ready enrollments`, "funnel-worker");

  for (const enrollment of readyEnrollments) {
    try {
      await processOneEnrollment(enrollment);
    } catch (err: any) {
      log(`Error processing enrollment ${enrollment.id}: ${err.message}`, "funnel-worker");
      await storage.updateEnrollment(enrollment.id, { status: "errored" });
      await storage.createExecutionLog({
        enrollmentId: enrollment.id,
        funnelId: enrollment.funnelId,
        stepPosition: enrollment.currentStepPos,
        stepType: "unknown",
        outcome: "failure",
        details: { error: err.message },
      });
    }
  }
}

async function processOneEnrollment(enrollment: any) {
  const steps = await storage.getStepsByFunnelId(enrollment.funnelId);
  const currentStep = steps.find(s => s.position === enrollment.currentStepPos);

  if (!currentStep) {
    // No more steps — funnel completed
    await storage.updateEnrollment(enrollment.id, {
      status: "completed",
      completedAt: new Date(),
      nextRunAt: null,
    });
    log(`Enrollment ${enrollment.subscriberEmail} completed funnel`, "funnel-worker");
    return;
  }

  // Execute the current step
  const result = await executeStep(enrollment, currentStep);

  // Log the execution
  await storage.createExecutionLog({
    enrollmentId: enrollment.id,
    funnelId: enrollment.funnelId,
    stepPosition: currentStep.position,
    stepType: currentStep.stepType,
    outcome: result.outcome,
    details: result.details,
  });

  if (result.outcome === "failure") {
    await storage.updateEnrollment(enrollment.id, { status: "errored" });
    return;
  }

  // Move to next step
  const nextStep = steps.find(s => s.position === currentStep.position + 1);

  if (!nextStep) {
    // This was the last step
    await storage.updateEnrollment(enrollment.id, {
      currentStepPos: currentStep.position + 1,
      status: "completed",
      completedAt: new Date(),
      nextRunAt: null,
    });
    log(`${enrollment.subscriberEmail} completed funnel`, "funnel-worker");
  } else if (nextStep.stepType === "wait") {
    // Next step is a wait — calculate when to resume
    const config = nextStep.config as any;
    const durationMs = getWaitDurationMs(config);
    const nextRunAt = new Date(Date.now() + durationMs);

    await storage.updateEnrollment(enrollment.id, {
      currentStepPos: nextStep.position + 1, // skip past the wait step
      status: "waiting",
      nextRunAt,
    });

    // Log the wait step too
    await storage.createExecutionLog({
      enrollmentId: enrollment.id,
      funnelId: enrollment.funnelId,
      stepPosition: nextStep.position,
      stepType: "wait",
      outcome: "scheduled",
      details: { wait_until: nextRunAt.toISOString(), ...config },
    });

    log(`${enrollment.subscriberEmail} waiting until ${nextRunAt.toISOString()}`, "funnel-worker");
  } else {
    // Next step is actionable — run it immediately
    await storage.updateEnrollment(enrollment.id, {
      currentStepPos: nextStep.position,
      status: "active",
      nextRunAt: new Date(),
    });
  }
}

// ── Step executors ───────────────────────────────────────────────────────────

async function executeStep(enrollment: any, step: any): Promise<{ outcome: string; details: any }> {
  const config = step.config as any;

  switch (step.stepType) {
    case "send_email":
      return executeSendEmail(enrollment, config);
    case "add_to_list":
      return executeAddToList(enrollment, config);
    case "remove_from_list":
      return executeRemoveFromList(enrollment, config);
    case "webhook":
      return executeWebhook(enrollment, config);
    case "wait":
      // Wait steps are handled by the enrollment flow, not executed directly
      return { outcome: "success", details: {} };
    default:
      return { outcome: "failure", details: { error: `Unknown step type: ${step.stepType}` } };
  }
}

async function executeSendEmail(enrollment: any, config: any): Promise<{ outcome: string; details: any }> {
  try {
    // Look up the from_email from newsletter settings for this funnel's list
    let from_email: string | undefined;
    const funnel = await storage.getFunnelById(enrollment.funnelId);
    if (funnel?.listmonkListId) {
      const settings = await storage.getNewsletterSettingsByListId(funnel.listmonkListId);
      if (settings?.fromEmail) {
        from_email = settings.fromEmail;
      }
    }

    await sendTransactional({
      subscriber_email: enrollment.subscriberEmail,
      template_id: config.template_id,
      from_email,
      data: config.data ?? {},
    });
    log(`Sent email to ${enrollment.subscriberEmail} (template: ${config.template_id})`, "funnel-worker");
    return { outcome: "success", details: { template_id: config.template_id } };
  } catch (err: any) {
    log(`Failed to send email to ${enrollment.subscriberEmail}: ${err.message}`, "funnel-worker");
    return { outcome: "failure", details: { error: err.message, template_id: config.template_id } };
  }
}

async function executeAddToList(enrollment: any, config: any): Promise<{ outcome: string; details: any }> {
  try {
    const lm = getListmonkClient();
    // Find subscriber by email
    const res = await lm.get(`/api/subscribers`, { params: { query: `subscribers.email = '${enrollment.subscriberEmail}'`, per_page: 1 } });
    const sub = res.data?.data?.results?.[0];
    if (!sub) return { outcome: "failure", details: { error: "Subscriber not found in ListMonk" } };

    await lm.put(`/api/subscribers/lists`, {
      ids: [sub.id],
      action: "add",
      target_list_ids: [config.list_id],
      status: "confirmed",
    });
    log(`Added ${enrollment.subscriberEmail} to list ${config.list_id}`, "funnel-worker");
    return { outcome: "success", details: { list_id: config.list_id } };
  } catch (err: any) {
    return { outcome: "failure", details: { error: err.message } };
  }
}

async function executeRemoveFromList(enrollment: any, config: any): Promise<{ outcome: string; details: any }> {
  try {
    const lm = getListmonkClient();
    const res = await lm.get(`/api/subscribers`, { params: { query: `subscribers.email = '${enrollment.subscriberEmail}'`, per_page: 1 } });
    const sub = res.data?.data?.results?.[0];
    if (!sub) return { outcome: "failure", details: { error: "Subscriber not found in ListMonk" } };

    await lm.put(`/api/subscribers/lists`, {
      ids: [sub.id],
      action: "remove",
      target_list_ids: [config.list_id],
    });
    log(`Removed ${enrollment.subscriberEmail} from list ${config.list_id}`, "funnel-worker");
    return { outcome: "success", details: { list_id: config.list_id } };
  } catch (err: any) {
    return { outcome: "failure", details: { error: err.message } };
  }
}

async function executeWebhook(enrollment: any, config: any): Promise<{ outcome: string; details: any }> {
  try {
    const res = await fetch(config.url, {
      method: config.method ?? "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriber_email: enrollment.subscriberEmail,
        subscriber_uuid: enrollment.subscriberUuid,
        funnel_id: enrollment.funnelId,
        step_position: enrollment.currentStepPos,
        ...config.payload,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    log(`Webhook sent for ${enrollment.subscriberEmail} to ${config.url}`, "funnel-worker");
    return { outcome: "success", details: { url: config.url, status: res.status } };
  } catch (err: any) {
    return { outcome: "failure", details: { error: err.message, url: config.url } };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWaitDurationMs(config: any): number {
  const duration = Number(config.duration) || 1;
  switch (config.unit) {
    case "minutes": return duration * 60_000;
    case "hours":   return duration * 3_600_000;
    case "days":    return duration * 86_400_000;
    case "weeks":   return duration * 604_800_000;
    default:        return duration * 86_400_000; // default to days
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function stopWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  if (listenerClient) {
    listenerClient.end().catch(() => {});
    listenerClient = null;
  }
}
