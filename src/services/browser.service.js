import puppeteer from "puppeteer";

let browserPromise = null;

/**
 * Lazily launches a single shared headless Chromium instance and reuses it
 * across checks (launching per-check would add ~1-2s overhead each time).
 */
export function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

process.on("SIGINT", () => closeBrowser().finally(() => process.exit(0)));
process.on("SIGTERM", () => closeBrowser().finally(() => process.exit(0)));

export default { getBrowser, closeBrowser };
