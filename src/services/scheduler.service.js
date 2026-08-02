import cron from "node-cron";
import { runCheck } from "./checker.service.js";

// monitorId -> ScheduledTask
const tasks = new Map();

export function scheduleMonitor(monitor) {
  unscheduleMonitor(monitor.id);

  if (monitor.paused) return;
  if (!cron.validate(monitor.cronSchedule)) {
    throw new Error(`Invalid cron expression: ${monitor.cronSchedule}`);
  }

  const task = cron.schedule(monitor.cronSchedule, () => {
    runCheck(monitor.id).catch((err) =>
      console.error(`[scheduler] check failed for monitor ${monitor.id}: ${err.message}`)
    );
  });

  tasks.set(monitor.id, task);
}

export function unscheduleMonitor(monitorId) {
  const existing = tasks.get(monitorId);
  if (existing) {
    existing.stop();
    tasks.delete(monitorId);
  }
}

export function scheduleAll(monitors) {
  for (const monitor of monitors) {
    if (!monitor.paused) {
      try {
        scheduleMonitor(monitor);
      } catch (err) {
        console.error(`[scheduler] failed to schedule monitor ${monitor.id}: ${err.message}`);
      }
    }
  }
}

export default { scheduleMonitor, unscheduleMonitor, scheduleAll };
