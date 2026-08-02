# visualping-clone

A Node.js backend that mimics the core of [Visualping](https://visualping.io):
you register a URL, it periodically re-fetches the page, diffs the content
against the last snapshot, keeps a history of checks, and logs (or webhooks)
when something changes.

## How it works

- **Fetching**: `axios` + `cheerio` extract normalized text from a page. For
  JS-rendered single-page apps (React/Vue/etc., where the raw HTML is empty),
  set `renderJs: true` on the monitor to fetch through headless Chromium
  (Puppeteer) instead.
- **Diffing**: `diff` computes a line-level diff between the previous and
  current text snapshot, with an added/removed line summary.
- **Scheduling**: `node-cron` runs a check for each monitor on its own cron
  expression (default every 10 minutes).
- **Storage**: a simple JSON file at `data/db.json` (no external database
  required). Fine for personal/demo use; swap in a real DB for production.
- **Notifications**: changes are always logged to the console; set a
  `webhookUrl` on a monitor to also POST a JSON payload there.

On first run, a monitor is auto-seeded for `https://cinematica.uz/movies/952`
(the target this app was built for) with `renderJs: true`, since that site is
a client-rendered React SPA and returns no content in the raw HTML.

## Setup

```bash
npm install
cp .env.example .env
npm start        # or: npm run dev  (auto-restarts on file changes)
```

Server listens on `http://localhost:3000` by default.

> Puppeteer downloads a bundled Chromium on install. If your npm config
> blocks postinstall scripts, approve it manually (e.g.
> `npm install-scripts approve puppeteer` then `npm rebuild puppeteer`) or
> `renderJs` monitors will fail to launch a browser.

## API

| Method | Path                              | Description                              |
|--------|-----------------------------------|-------------------------------------------|
| GET    | `/health`                         | Health check                              |
| GET    | `/api/monitors`                   | List all monitors                         |
| POST   | `/api/monitors`                   | Create a monitor                          |
| GET    | `/api/monitors/:id`                | Get one monitor                           |
| PATCH  | `/api/monitors/:id`                | Update a monitor (pause, schedule, etc.)  |
| DELETE | `/api/monitors/:id`                | Delete a monitor                          |
| POST   | `/api/monitors/:id/check`          | Trigger an immediate check                |
| GET    | `/api/monitors/:id/checks`         | List check/diff history (newest first)    |
| GET    | `/api/monitors/:id/checks/:checkId`| Get one check's full diff                 |

### Create a monitor

```bash
curl -X POST http://localhost:3000/api/monitors \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cinematica.uz/movies/952",
    "name": "Spider-Man showtimes",
    "renderJs": true,
    "cronSchedule": "*/10 * * * *",
    "selector": null,
    "webhookUrl": null
  }'
```

Fields:
- `url` (required) - absolute URL to monitor.
- `name` - display name (defaults to the URL).
- `selector` - optional CSS selector to scope the diff to one part of the
  page (e.g. `"#showtimes"`), mirroring Visualping's area-select feature.
- `renderJs` - set `true` for JS-rendered pages (adds a headless Chromium
  render step, slower but sees real content).
- `cronSchedule` - standard 5-field cron expression (default from
  `DEFAULT_CRON_SCHEDULE` in `.env`, `*/10 * * * *`).
- `webhookUrl` - optional URL to POST `{ monitorId, name, url, changed, summary, fetchedAt }`
  to whenever a change is detected.

A baseline check runs immediately after creation; the first check is never
reported as "changed" since there's nothing to diff against yet.

## Project structure

```
src/
  server.js                 entrypoint: seed, schedule, listen
  app.js                    express app + middleware
  db.js                     JSON file storage
  seed.js                   seeds the cinematica.uz example monitor
  routes/monitors.routes.js
  controllers/monitors.controller.js
  services/
    fetcher.service.js      raw HTTP fetch + Puppeteer render + text extraction
    browser.service.js      shared headless Chromium instance
    diff.service.js         line diff + change summary
    checker.service.js      orchestrates one check: fetch -> diff -> persist -> notify
    scheduler.service.js    node-cron job management per monitor
    notifier.service.js     console log + webhook delivery
```
