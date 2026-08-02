import crypto from "node:crypto";
import { getDb, save } from "../db.js";
import { fetchSnapshot } from "./fetcher.service.js";
import { computeDiff } from "./diff.service.js";
import { notifyChange } from "./notifier.service.js";

const MAX_CHECKS_PER_MONITOR = 100;

/**
 * Runs a single check for a monitor: fetches the page, diffs it against the
 * last snapshot, persists the result, and fires notifications on change.
 * Returns the stored check record.
 */
export async function runCheck(monitorId) {
  const db = await getDb();
  const monitor = db.monitors.find((m) => m.id === monitorId);
  if (!monitor) throw new Error(`Monitor ${monitorId} not found`);

  const baseCheck = {
    id: crypto.randomUUID(),
    monitorId: monitor.id,
    fetchedAt: new Date().toISOString(),
  };

  let snapshot;
  try {
    snapshot = await fetchSnapshot(monitor.url, {
      selector: monitor.selector,
      renderJs: monitor.renderJs,
    });
  } catch (err) {
    const failedCheck = { ...baseCheck, ok: false, error: err.message };
    await recordCheck(db, monitor, failedCheck);
    return failedCheck;
  }

  const previousText = monitor.lastText ?? "";
  const diff = computeDiff(previousText, snapshot.text);
  const isFirstCheck = monitor.lastHash == null;

  const check = {
    ...baseCheck,
    ok: true,
    hash: snapshot.hash,
    changed: !isFirstCheck && diff.changed,
    diff: isFirstCheck ? { parts: [], summary: { linesAdded: 0, linesRemoved: 0 } } : diff,
  };

  monitor.lastHash = snapshot.hash;
  monitor.lastText = snapshot.text;
  monitor.lastCheckedAt = check.fetchedAt;

  await recordCheck(db, monitor, check);

  if (check.changed) {
    await notifyChange(monitor, check);
  }

  return check;
}

async function recordCheck(db, monitor, check) {
  db.checks.push(check);

  const monitorChecks = db.checks.filter((c) => c.monitorId === monitor.id);
  if (monitorChecks.length > MAX_CHECKS_PER_MONITOR) {
    const idsToDrop = new Set(
      monitorChecks
        .sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt))
        .slice(0, monitorChecks.length - MAX_CHECKS_PER_MONITOR)
        .map((c) => c.id)
    );
    db.checks = db.checks.filter((c) => !idsToDrop.has(c.id));
  }

  await save();
}

export default { runCheck };
