import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DB_DIR, "db.json");

const EMPTY_STATE = { monitors: [], checks: [] };

let state = null;
// Serializes writes so concurrent requests can't interleave and corrupt the file.
let writeQueue = Promise.resolve();

async function load() {
  if (state) return state;

  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    state = JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      state = structuredClone(EMPTY_STATE);
      await persist();
    } else {
      throw err;
    }
  }
  return state;
}

function persist() {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), "utf-8")
  );
  return writeQueue;
}

export async function getDb() {
  return load();
}

export async function save() {
  return persist();
}

export default { getDb, save };
