import "dotenv/config";
import { createApp } from "./app.js";
import { getDb } from "./db.js";
import { scheduleAll } from "./services/scheduler.service.js";
import { seedDefaultMonitor } from "./seed.js";

const PORT = process.env.PORT || 3000;

async function main() {
  await seedDefaultMonitor();

  const db = await getDb();
  scheduleAll(db.monitors);

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Visualping-clone backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
