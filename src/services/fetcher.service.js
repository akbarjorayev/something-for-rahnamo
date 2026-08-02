import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "node:crypto";
import { getBrowser } from "./browser.service.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 VisualpingCloneBot/1.0";

const RENDER_TIMEOUT_MS = 30000;

/**
 * Fetches a URL and extracts normalized text content, optionally scoped to a
 * CSS selector (mirrors Visualping's "select an area of the page" feature).
 * Set `renderJs` for pages that render their content client-side (SPAs) -
 * plain HTTP fetching only sees the initial, often-empty, server HTML.
 */
export async function fetchSnapshot(url, { selector, renderJs } = {}) {
  const html = renderJs ? await fetchRenderedHtml(url) : await fetchRawHtml(url);

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const scope = selector ? $(selector) : $("body");
  if (selector && scope.length === 0) {
    throw new Error(`Selector "${selector}" matched no elements on ${url}`);
  }

  const text = normalizeText(scope.text());
  const hash = crypto.createHash("sha256").update(text).digest("hex");

  return { text, hash, fetchedAt: new Date().toISOString() };
}

async function fetchRawHtml(url) {
  const response = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return response.data;
}

async function fetchRenderedHtml(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: "networkidle2", timeout: RENDER_TIMEOUT_MS });
    return await page.content();
  } finally {
    await page.close();
  }
}

function normalizeText(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/[ \t]+/g, " ");
}

export default { fetchSnapshot };
