import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { BrowserContext, Page } from "playwright-core";

import { getDeltaDentalConfig } from "./config";
import { DeltaDentalAuthError } from "./errors";

const AUTH_TIMEOUT_MS = 60_000;

export async function saveStorageState(context: BrowserContext): Promise<void> {
  const { storageStatePath } = getDeltaDentalConfig();
  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await context.storageState({ path: storageStatePath });
}

export async function isOnLoginScreen(page: Page): Promise<boolean> {
  const url = page.url();
  if (/ciam\/login|\/login\b|sign-?in|authenticate|mfa/i.test(url)) {
    return true;
  }

  const title = await page.title().catch(() => "");
  if (/sign\s*in|log\s*in/i.test(title)) {
    return true;
  }

  const passwordField = page.locator('input[type="password"]').first();
  return passwordField.isVisible().catch(() => false);
}

async function isInProviderToolsApp(page: Page): Promise<boolean> {
  if (!/provider-tools\/v2/i.test(page.url())) {
    return false;
  }

  if (await isOnLoginScreen(page)) {
    return false;
  }

  const authenticatedSignals = [
    page.getByRole("button", { name: /sign out|log out/i }),
    page.getByRole("link", { name: /sign out|log out/i }),
    page.getByText(/national search/i),
    page.getByText(/my patients/i),
    page.getByText(/eligibility\s*&\s*benefits/i),
    page.locator('[data-testid*="nav"], nav[aria-label]'),
  ];

  for (const locator of authenticatedSignals) {
    if (await locator.first().isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

export async function getSessionDiagnostics(page: Page): Promise<string> {
  const title = await page.title().catch(() => "unknown");
  return `Current page: ${page.url()} (title: "${title}")`;
}

export async function assertAuthenticatedProviderTools(
  page: Page,
): Promise<void> {
  if (await isOnLoginScreen(page)) {
    throw new DeltaDentalAuthError(
      "session_expired",
      `Provider Tools is showing the sign-in screen in the cloud browser. Your saved session may have expired or cannot be reused from Browserless. Run npm run delta:save-session on this machine, open National Search, then press Enter. ${await getSessionDiagnostics(page)}`,
    );
  }

  if (!(await isInProviderToolsApp(page))) {
    throw new DeltaDentalAuthError(
      "login_failed",
      `Could not confirm an authenticated Provider Tools session. ${await getSessionDiagnostics(page)}`,
    );
  }
}

export async function openProviderToolsApp(page: Page): Promise<void> {
  const { providerToolsAppUrl } = getDeltaDentalConfig();
  await page.goto(providerToolsAppUrl, {
    waitUntil: "networkidle",
    timeout: AUTH_TIMEOUT_MS,
  });
}

async function openProviderLogin(page: Page): Promise<void> {
  const { loginUrl } = getDeltaDentalConfig();
  await page.goto(loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: AUTH_TIMEOUT_MS,
  });

  const loginEntry = page
    .getByRole("link", { name: /^log\s*in$/i })
    .or(page.getByRole("button", { name: /^log\s*in$/i }))
    .first();

  if (await loginEntry.isVisible().catch(() => false)) {
    await loginEntry.click();
    await page.waitForLoadState("domcontentloaded");
  }
}

async function submitCredentialLogin(page: Page): Promise<void> {
  const { username, password } = getDeltaDentalConfig();
  if (!username || !password) {
    throw new DeltaDentalAuthError(
      "login_failed",
      "No saved session found. Run npm run delta:save-session after logging into Provider Tools.",
    );
  }

  const userField = page
    .getByLabel(/username|user name|email/i)
    .or(page.locator('input[name="username"], input[type="email"]'))
    .first();
  const passwordField = page
    .getByLabel(/^password$/i)
    .or(page.locator('input[type="password"]'))
    .first();

  await userField.fill(username, { timeout: AUTH_TIMEOUT_MS });
  await passwordField.fill(password, { timeout: AUTH_TIMEOUT_MS });

  const rememberMe = page.getByRole("checkbox", {
    name: /remember me/i,
  });
  if (await rememberMe.isVisible().catch(() => false)) {
    await rememberMe.check().catch(() => undefined);
  }

  await page
    .getByRole("button", { name: /sign in|log in|continue/i })
    .first()
    .click();

  await page.waitForLoadState("networkidle", { timeout: AUTH_TIMEOUT_MS });
}

async function detectMfaChallenge(page: Page): Promise<boolean> {
  const mfaPatterns = [
    page.getByText(/verification code|one-time code|authenticate your/i),
    page.getByLabel(/verification code|one-time code/i),
    page.getByRole("textbox", { name: /code/i }),
  ];

  for (const locator of mfaPatterns) {
    if (await locator.first().isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

/**
 * Opens Provider Tools v2 with saved cookies and confirms we are inside the app.
 */
export async function ensureProviderToolsSession(page: Page): Promise<void> {
  await openProviderToolsApp(page);

  if (await isInProviderToolsApp(page)) {
    return;
  }

  if (await isOnLoginScreen(page)) {
    const { username, password } = getDeltaDentalConfig();
    if (!username || !password) {
      throw new DeltaDentalAuthError(
        "session_expired",
        "Provider Tools redirected to CIAM sign-in — your saved session is not active in the cloud browser. Run npm run delta:save-session: log in via deltadentalins.com/ciam/login, land on provider-tools/v2, open National Search, then press Enter.",
      );
    }

    await submitCredentialLogin(page);

    if (await detectMfaChallenge(page)) {
      throw new DeltaDentalAuthError(
        "mfa_required",
        "Delta Dental MFA is required. Run `npm run delta:save-session`, complete login + MFA, then retry.",
      );
    }

    await openProviderToolsApp(page);
  } else {
    await openProviderLogin(page);
    await submitCredentialLogin(page);

    if (await detectMfaChallenge(page)) {
      throw new DeltaDentalAuthError(
        "mfa_required",
        "Delta Dental MFA is required. Run `npm run delta:save-session`, complete login + MFA, then retry.",
      );
    }

    await openProviderToolsApp(page);
  }

  await assertAuthenticatedProviderTools(page);
}
