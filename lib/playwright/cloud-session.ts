import { existsSync } from "node:fs";

import { chromium, type Browser, type BrowserContext } from "playwright-core";

import {
  getDeltaDentalConfig,
  isDeltaDentalConfigured,
  verifyWithDeltaDentalProviderTools,
} from "@/lib/playwright/payers/delta-dental/verify";
import type { VerifyJobResponse, VerifyPatientInput } from "@/lib/verify/types";

const PLACEHOLDER_HOST_FRAGMENTS = [
  "your-browserless-or-browserbase-endpoint",
  "example.com",
  "changeme",
  "placeholder",
];

export class CloudBrowserNotConfiguredError extends Error {
  constructor() {
    super("PLAYWRIGHT_WS_ENDPOINT is not set or is still a placeholder.");
    this.name = "CloudBrowserNotConfiguredError";
  }
}

export function isCloudBrowserConfigured(): boolean {
  const endpoint = process.env.PLAYWRIGHT_WS_ENDPOINT?.trim();
  if (!endpoint) return false;

  try {
    const { hostname } = new URL(endpoint);
    const normalized = hostname.toLowerCase();
    return !PLACEHOLDER_HOST_FRAGMENTS.some((fragment) =>
      normalized.includes(fragment),
    );
  } catch {
    return false;
  }
}

function getWsEndpoint(): string {
  if (!isCloudBrowserConfigured()) {
    throw new CloudBrowserNotConfiguredError();
  }
  return process.env.PLAYWRIGHT_WS_ENDPOINT!.trim();
}

function toUserFacingBrowserError(error: unknown): string {
  if (error instanceof CloudBrowserNotConfiguredError) {
    return "Cloud browser is not configured. Add a real PLAYWRIGHT_WS_ENDPOINT to .env.local, then restart the dev server.";
  }

  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("ENOTFOUND") ||
    message.includes("WebSocket error") ||
    message.includes("connectOverCDP")
  ) {
    return "Could not reach the cloud browser. Verify PLAYWRIGHT_WS_ENDPOINT is correct and restart the dev server.";
  }

  return "Cloud browser session failed.";
}

/**
 * Connects to a remote Chromium instance (Browserbase, Browserless, etc.)
 * via Playwright's CDP WebSocket endpoint.
 */
export async function connectCloudBrowser(): Promise<Browser> {
  return chromium.connectOverCDP(getWsEndpoint());
}

export type VerificationSession = {
  browser: Browser;
  context: BrowserContext;
  close: () => Promise<void>;
};

/**
 * Opens an isolated browser context for a single verification run.
 * Caller must invoke `close()` when finished.
 */
export async function createVerificationSession(): Promise<VerificationSession> {
  const browser = await connectCloudBrowser();
  const storageStatePath = getDeltaDentalConfig().storageStatePath;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    ...(existsSync(storageStatePath)
      ? { storageState: storageStatePath }
      : {}),
  });

  return {
    browser,
    context,
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

/**
 * Orchestrates a headless cloud verification job via Delta Dental Provider Tools.
 */
export async function runInsuranceVerification(
  input: VerifyPatientInput,
): Promise<VerifyJobResponse> {
  const jobId = crypto.randomUUID();

  if (!isCloudBrowserConfigured()) {
    return {
      jobId,
      status: "pending_configuration",
      message:
        "Verification request accepted. Set PLAYWRIGHT_WS_ENDPOINT (Browserless, Browserbase, etc.) to enable automation.",
      payer: "delta_dental",
    };
  }

  if (!isDeltaDentalConfigured()) {
    return {
      jobId,
      status: "pending_configuration",
      message:
        "Cloud browser ready. Set DELTA_DENTAL_USER/PASSWORD or run npm run delta:save-session after logging into Provider Tools.",
      payer: "delta_dental",
    };
  }

  let session: VerificationSession | null = null;

  try {
    session = await createVerificationSession();
    return await verifyWithDeltaDentalProviderTools(input, session, jobId);
  } catch (error) {
    return {
      jobId,
      status: "failed",
      message: toUserFacingBrowserError(error),
      payer: "delta_dental",
    };
  } finally {
    await session?.close();
  }
}
