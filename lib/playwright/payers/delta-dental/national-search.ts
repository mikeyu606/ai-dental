import type { Page } from "playwright-core";

import type { VerifyPatientInput } from "@/lib/verify/types";

import {
  assertAuthenticatedProviderTools,
  getSessionDiagnostics,
  isOnLoginScreen,
} from "./auth";
import {
  getDeltaDentalConfig,
  NATIONAL_SEARCH_PATH_CANDIDATES,
} from "./config";
import { DeltaDentalNavigationError } from "./errors";
import {
  formatDobForPortal,
  formatStateForPortal,
  splitPatientName,
} from "./format";

const STEP_TIMEOUT_MS = 60_000;

export type NationalSearchResult = {
  summaryText: string;
  coverageStatus: "active" | "inactive" | "unknown";
  patientName?: string;
  planName?: string;
  groupName?: string;
  memberId?: string;
  eligibilityPeriod?: string;
};

async function isSearchFormVisible(page: Page): Promise<boolean> {
  return page
    .getByPlaceholder(/enter first name/i)
    .first()
    .isVisible()
    .catch(() => false);
}

async function selectSearchByNameTab(page: Page): Promise<void> {
  const tab = page.getByRole("tab", { name: /search by name/i }).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
}

async function tryPatientSearchUrls(page: Page): Promise<boolean> {
  const { providerToolsAppUrl, nationalSearchUrl } = getDeltaDentalConfig();
  const origin = new URL(providerToolsAppUrl).origin;

  const urls = [
    nationalSearchUrl,
    ...NATIONAL_SEARCH_PATH_CANDIDATES.map((path) => `${origin}${path}`),
  ];

  for (const url of urls) {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: STEP_TIMEOUT_MS,
    });

    if (await isOnLoginScreen(page)) {
      continue;
    }

    if (await isSearchFormVisible(page)) {
      return true;
    }
  }

  return false;
}

async function navigateToPatientSearch(page: Page): Promise<void> {
  await assertAuthenticatedProviderTools(page);

  if (!(await tryPatientSearchUrls(page))) {
    const diagnostics = await getSessionDiagnostics(page);
    throw new DeltaDentalNavigationError(
      `Could not open patient search. ${diagnostics}`,
    );
  }

  await selectSearchByNameTab(page);
}

async function fillFirstMatching(
  page: Page,
  candidates: RegExp[],
  value: string,
): Promise<void> {
  for (const pattern of candidates) {
    const field = page
      .getByLabel(pattern)
      .or(page.getByPlaceholder(pattern))
      .first();

    if (await field.isVisible().catch(() => false)) {
      await field.fill(value);
      return;
    }
  }

  throw new DeltaDentalNavigationError(
    `Could not find an input matching: ${candidates.map((c) => c.source).join(", ")}`,
  );
}

async function selectPatientState(
  page: Page,
  patientState: string | null,
): Promise<void> {
  if (!patientState) return;

  const fullName = formatStateForPortal(patientState);

  // MUI Select: hidden native <input name="state"> — click the visible listbox trigger.
  const muiTrigger = page.locator("#mui-component-select-state").first();

  if (await muiTrigger.isVisible().catch(() => false)) {
    await muiTrigger.click();

    const listbox = page.getByRole("listbox").last();
    await listbox.waitFor({ state: "visible", timeout: 15_000 });

    const option = listbox
      .getByRole("option", { name: new RegExp(`^${fullName}$`, "i") })
      .or(listbox.getByRole("option", { name: new RegExp(fullName, "i") }))
      .or(listbox.getByRole("option", { name: new RegExp(`^${patientState}$`, "i") }))
      .first();

    await option.click();
    return;
  }

  const nativeSelect = page.locator('select[name="state"]').first();
  if (await nativeSelect.isVisible().catch(() => false)) {
    await nativeSelect
      .selectOption({ label: fullName })
      .catch(async () => nativeSelect.selectOption(patientState));
  }
}

async function waitForSearchResults(page: Page): Promise<void> {
  await page
    .getByText(/searching for patient/i)
    .waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS })
    .catch(() => undefined);

  const resultsHeading = page.getByText(/new patient search results/i);
  const noResults = page.getByText(/no patients found|no results|not found/i);
  const benefitButton = page.getByRole("button", {
    name: /check eligibility and benefits/i,
  });

  await Promise.race([
    resultsHeading.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
    benefitButton.first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
    noResults.first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
  ]).catch(() => undefined);

  if (await noResults.first().isVisible().catch(() => false)) {
    throw new DeltaDentalNavigationError(
      "No matching patient found in Provider Tools. Check spelling (first/last name), DOB, and state.",
    );
  }

  if (!(await benefitButton.first().isVisible().catch(() => false))) {
    throw new DeltaDentalNavigationError(
      "Patient search finished but no eligibility button appeared. Verify the patient exists in Delta Dental.",
    );
  }
}

async function openEligibilityBenefits(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /check eligibility and benefits/i })
    .first()
    .click();

  await page.waitForURL(/eligibility-benefits/, {
    timeout: STEP_TIMEOUT_MS,
  });

  await page
    .getByText(/benefits overview|eligibility & benefits/i)
    .first()
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
}

function extractField(text: string, label: string): string | undefined {
  const pattern = new RegExp(
    `${label}\\s*:?\\s*([^\\n]+)`,
    "i",
  );
  return text.match(pattern)?.[1]?.trim();
}

function parseEligibilityPage(text: string): Omit<NationalSearchResult, "coverageStatus"> {
  return {
    summaryText: text.slice(0, 4000),
    patientName: extractField(text, "Patient name") ?? extractField(text, "Name"),
    planName: extractField(text, "Plan"),
    groupName: extractField(text, "Group"),
    memberId: extractField(text, "Member ID"),
    eligibilityPeriod: extractField(text, "Member eligibility"),
  };
}

function inferCoverageStatus(
  text: string,
  eligibilityPeriod?: string,
): NationalSearchResult["coverageStatus"] {
  const normalized = text.toLowerCase();

  if (eligibilityPeriod && /\bpresent\b/i.test(eligibilityPeriod)) {
    return "active";
  }
  if (/\b\d{2}\/\d{2}\/\d{4}\s*-\s*present\b/i.test(normalized)) {
    return "active";
  }
  if (
    /\b(active|eligible|coverage confirmed|delta dental ppo)\b/.test(normalized) &&
    !/\b(inactive|terminated|not eligible|no coverage)\b/.test(normalized)
  ) {
    return "active";
  }
  if (/\b(inactive|terminated|not eligible|no coverage)\b/.test(normalized)) {
    return "inactive";
  }
  return "unknown";
}

export async function runNationalSearch(
  page: Page,
  input: VerifyPatientInput,
): Promise<NationalSearchResult> {
  const config = getDeltaDentalConfig();
  const { firstName, lastName } = splitPatientName(input.patientName);
  const dob = formatDobForPortal(input.dateOfBirth);
  const patientState =
    input.patientState?.toUpperCase() ?? config.defaultPatientState;

  if (!firstName || !lastName) {
    throw new DeltaDentalNavigationError(
      "Patient name must include first and last name for Search by name.",
    );
  }
  if (!patientState) {
    throw new DeltaDentalNavigationError(
      "Patient state is required (e.g. CA) for Search by name.",
    );
  }

  await navigateToPatientSearch(page);

  await fillFirstMatching(page, [/first name/i], firstName);
  await fillFirstMatching(page, [/last name/i], lastName);
  await fillFirstMatching(page, [/date of birth|birth date|dob/i], dob);
  await selectPatientState(page, patientState);

  await page.getByRole("button", { name: /^search$/i }).first().click();

  await waitForSearchResults(page);
  await openEligibilityBenefits(page);

  const mainContent = page
    .locator('[role="main"]')
    .or(page.locator("main"))
    .first();
  const summaryText = (await mainContent.innerText()).trim();

  if (!summaryText) {
    throw new DeltaDentalNavigationError(
      "Eligibility page loaded but contained no readable benefits text.",
    );
  }

  const parsed = parseEligibilityPage(summaryText);

  return {
    ...parsed,
    summaryText: parsed.summaryText,
    coverageStatus: inferCoverageStatus(
      summaryText,
      parsed.eligibilityPeriod,
    ),
  };
}
