import crypto from "node:crypto";
import cron from "node-cron";
import { getDb, save } from "../db.js";
import { runCheck } from "../services/checker.service.js";
import { scheduleMonitor, unscheduleMonitor } from "../services/scheduler.service.js";

const DEFAULT_CRON_SCHEDULE = process.env.DEFAULT_CRON_SCHEDULE || "*/10 * * * *";

function toPublicMonitor(monitor) {
  const { lastText, ...rest } = monitor;
  return rest;
}

export async function listMonitors(req, res) {
  const db = await getDb();
  res.json(db.monitors.map(toPublicMonitor));
}

export async function getMonitor(req, res) {
  const db = await getDb();
  const monitor = db.monitors.find((m) => m.id === req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  res.json(toPublicMonitor(monitor));
}

export async function createMonitor(req, res) {
  const { url, name, selector, cronSchedule, webhookUrl, renderJs } = req.body ?? {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "url must be a valid absolute URL" });
  }

  const schedule = cronSchedule || DEFAULT_CRON_SCHEDULE;
  if (!cron.validate(schedule)) {
    return res.status(400).json({ error: `Invalid cron expression: ${schedule}` });
  }

  const db = await getDb();
  const monitor = {
    id: crypto.randomUUID(),
    name: name || url,
    url,
    selector: selector || null,
    cronSchedule: schedule,
    webhookUrl: webhookUrl || null,
    renderJs: Boolean(renderJs),
    paused: false,
    createdAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastHash: null,
    lastText: null,
  };

  db.monitors.push(monitor);
  await save();
  scheduleMonitor(monitor);

  res.status(201).json(toPublicMonitor(monitor));

  // Run an initial check immediately so the monitor has a baseline snapshot.
  runCheck(monitor.id).catch((err) =>
    console.error(`[monitors] initial check failed for ${monitor.id}: ${err.message}`)
  );
}

export async function updateMonitor(req, res) {
  const db = await getDb();
  const monitor = db.monitors.find((m) => m.id === req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });

  const { name, selector, cronSchedule, webhookUrl, renderJs, paused } = req.body ?? {};

  if (cronSchedule !== undefined) {
    if (!cron.validate(cronSchedule)) {
      return res.status(400).json({ error: `Invalid cron expression: ${cronSchedule}` });
    }
    monitor.cronSchedule = cronSchedule;
  }
  if (name !== undefined) monitor.name = name;
  if (selector !== undefined) monitor.selector = selector || null;
  if (webhookUrl !== undefined) monitor.webhookUrl = webhookUrl || null;
  if (renderJs !== undefined) monitor.renderJs = Boolean(renderJs);
  if (paused !== undefined) monitor.paused = Boolean(paused);

  await save();

  if (monitor.paused) {
    unscheduleMonitor(monitor.id);
  } else {
    scheduleMonitor(monitor);
  }

  res.json(toPublicMonitor(monitor));
}

export async function deleteMonitor(req, res) {
  const db = await getDb();
  const index = db.monitors.findIndex((m) => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Monitor not found" });

  const [monitor] = db.monitors.splice(index, 1);
  db.checks = db.checks.filter((c) => c.monitorId !== monitor.id);
  await save();
  unscheduleMonitor(monitor.id);

  res.status(204).send();
}

export async function triggerCheck(req, res) {
  const db = await getDb();
  const monitor = db.monitors.find((m) => m.id === req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });

  try {
    const check = await runCheck(monitor.id);
    res.json(check);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

export async function listChecks(req, res) {
  const db = await getDb();
  const monitor = db.monitors.find((m) => m.id === req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });

  const checks = db.checks
    .filter((c) => c.monitorId === monitor.id)
    .sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));

  res.json(checks);
}

export async function getCheck(req, res) {
  const db = await getDb();
  const check = db.checks.find(
    (c) => c.monitorId === req.params.id && c.id === req.params.checkId
  );
  if (!check) return res.status(404).json({ error: "Check not found" });
  res.json(check);
}

export default {
  listMonitors,
  getMonitor,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  triggerCheck,
  listChecks,
  getCheck,
};
