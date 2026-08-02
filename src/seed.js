import crypto from "node:crypto";
import { getDb, save } from "./db.js";
import { runCheck } from "./services/checker.service.js";

const DEFAULT_CRON_SCHEDULE = process.env.DEFAULT_CRON_SCHEDULE || "*/10 * * * *";

/**
 * Seeds a monitor for the example target the app was requested for, so the
 * server is immediately useful on first run. No-ops if any monitor already
 * exists.
 */
export async function seedDefaultMonitor() {
  const db = await getDb();
  if (db.monitors.length > 0) return;

  const monitor = {
    id: crypto.randomUUID(),
    name: "Cinematica - movie 952",
    url: "https://cinematica.uz/movies/952",
    selector: null,
    cronSchedule: DEFAULT_CRON_SCHEDULE,
    webhookUrl: null,
    // cinematica.uz is a client-side React SPA - the raw HTML is empty, so
    // rendering with headless Chromium is required to see real content.
    renderJs: true,
    paused: false,
    createdAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastHash: null,
    lastText: null,
  };

  db.monitors.push(monitor);
  await save();
  console.log(`[seed] created default monitor for ${monitor.url}`);

  runCheck(monitor.id).catch((err) =>
    console.error(`[seed] initial check failed: ${err.message}`)
  );
}

export default seedDefaultMonitor;
