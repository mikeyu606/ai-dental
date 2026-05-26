import { existsSync } from "node:fs";

/** Marketing site — use only for manual registration links. */
const DEFAULT_LOGIN_URL = "https://www1.deltadentalins.com/dentists/provider-tools.html";

/** Authenticated Provider Tools v2 app (session cookies are scoped here). */
export const DEFAULT_PROVIDER_TOOLS_APP_URL =
  "https://www.deltadentalins.com/provider-tools/v2";

/** Patient search screen ("Search for a new patient") with name / member ID / national tabs. */
export const DEFAULT_PATIENT_SEARCH_URL =
  "https://www.deltadentalins.com/provider-tools/v2/patient-search";

/** Fallback routes if the patient-search URL changes. */
export const NATIONAL_SEARCH_PATH_CANDIDATES = [
  "/provider-tools/v2/patient-search",
  "/provider-tools/v2/national-search",
  "/provider-tools/v2/eligibility/national-search",
  "/provider-tools/v2/eligibility-benefits/national-search",
  "/provider-tools/v2/#/national-search",
  "/provider-tools/v2/#/eligibility/national-search",
];

const DEFAULT_STORAGE_STATE = ".delta-dental/storage-state.json";

export type DeltaDentalConfig = {
  loginUrl: string;
  providerToolsAppUrl: string;
  nationalSearchUrl: string;
  username: string;
  password: string;
  storageStatePath: string;
  defaultPatientState: string | null;
};

export function getDeltaDentalConfig(): DeltaDentalConfig {
  const storageStatePath =
    process.env.DELTA_DENTAL_STORAGE_STATE?.trim() || DEFAULT_STORAGE_STATE;

  return {
    loginUrl: process.env.DELTA_DENTAL_LOGIN_URL?.trim() || DEFAULT_LOGIN_URL,
    providerToolsAppUrl:
      process.env.DELTA_DENTAL_PROVIDER_TOOLS_URL?.trim() ||
      DEFAULT_PROVIDER_TOOLS_APP_URL,
    nationalSearchUrl:
      process.env.DELTA_DENTAL_NATIONAL_SEARCH_URL?.trim() ||
      DEFAULT_PATIENT_SEARCH_URL,
    username: process.env.DELTA_DENTAL_USER?.trim() ?? "",
    password: process.env.DELTA_DENTAL_PASSWORD?.trim() ?? "",
    storageStatePath,
    defaultPatientState:
      process.env.DELTA_DENTAL_DEFAULT_PATIENT_STATE?.trim().toUpperCase() ||
      null,
  };
}

/** Credentials and/or a saved session file (recommended after MFA login). */
export function isDeltaDentalConfigured(): boolean {
  const config = getDeltaDentalConfig();
  if (config.username && config.password) return true;
  return existsSync(config.storageStatePath);
}

export function assertDeltaDentalConfigured(): void {
  if (!isDeltaDentalConfigured()) {
    throw new Error(
      "Delta Dental Provider Tools is not configured. Set DELTA_DENTAL_USER and DELTA_DENTAL_PASSWORD, or save a session with npm run delta:save-session.",
    );
  }
}
