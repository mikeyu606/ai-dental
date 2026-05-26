/**
 * One-time (or periodic) login bootstrap for Delta Dental MFA.
 *
 * 1. Opens a local Chromium window to deltadentalins.com
 * 2. You log in to Provider Tools and complete MFA manually
 * 3. Press Enter in the terminal to persist cookies to .delta-dental/
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { config } from "dotenv";
import { chromium } from "playwright-core";

import {
  DEFAULT_PATIENT_SEARCH_URL,
  DEFAULT_PROVIDER_TOOLS_APP_URL,
} from "../lib/playwright/payers/delta-dental/config";

config({ path: ".env.local" });

const providerToolsUrl =
  process.env.DELTA_DENTAL_NATIONAL_SEARCH_URL?.trim() ||
  DEFAULT_PATIENT_SEARCH_URL;
const providerToolsHome =
  process.env.DELTA_DENTAL_PROVIDER_TOOLS_URL?.trim() ||
  DEFAULT_PROVIDER_TOOLS_APP_URL;
const storageStatePath =
  process.env.DELTA_DENTAL_STORAGE_STATE?.trim() ||
  path.join(".delta-dental", "storage-state.json");

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function main(): Promise<void> {
  console.log("Opening Chromium for Delta Dental Provider Tools v2.");
  console.log(`Open: ${providerToolsUrl}`);
  console.log(`(Dashboard: ${providerToolsHome})`);
  console.log(
    "1. Log in via CIAM if prompted (same flow as your dental office)",
  );
  console.log("2. Land on provider-tools/v2 dashboard");
  console.log('3. Click "Search for a new patient" (or National Search in the left menu)');
  console.log("4. Stop on the screen with Member ID / DOB fields");
  console.log("5. Press Enter here to save cookies + that page URL\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  });
  const page = await context.newPage();
  await page.goto(providerToolsUrl, { waitUntil: "domcontentloaded" });

  await waitForEnter(
    'Press Enter on the "Search for a new patient" / National Search form... ',
  );

  const nationalSearchUrl = page.url();

  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await context.storageState({ path: storageStatePath });

  console.log(`\nSaved session → ${storageStatePath}`);
  console.log("\nAdd this to .env.local (if not already set):\n");
  console.log(`DELTA_DENTAL_NATIONAL_SEARCH_URL=${nationalSearchUrl}`);
  console.log("\nRestart `npm run dev` and submit a verification from /verify.\n");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
