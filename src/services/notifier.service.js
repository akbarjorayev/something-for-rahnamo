import axios from "axios";

export async function notifyChange(monitor, check) {
  const { summary } = check.diff;
  console.log(
    `[change detected] "${monitor.name}" (${monitor.url}) — ` +
      `+${summary.linesAdded}/-${summary.linesRemoved} lines at ${check.fetchedAt}`
  );

  if (!monitor.webhookUrl) return;

  try {
    await axios.post(
      monitor.webhookUrl,
      {
        monitorId: monitor.id,
        name: monitor.name,
        url: monitor.url,
        changed: true,
        summary,
        fetchedAt: check.fetchedAt,
      },
      { timeout: 10000 }
    );
  } catch (err) {
    console.error(`[notifier] webhook delivery failed for monitor ${monitor.id}: ${err.message}`);
  }
}

export default { notifyChange };
