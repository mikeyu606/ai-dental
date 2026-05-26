import type { VerificationSession } from "@/lib/playwright/cloud-session";
import type {
  EligibilitySnapshot,
  VerifyJobResponse,
  VerifyPatientInput,
} from "@/lib/verify/types";

import { ensureProviderToolsSession } from "./auth";
import {
  assertDeltaDentalConfigured,
  getDeltaDentalConfig,
  isDeltaDentalConfigured,
} from "./config";
import { DeltaDentalAuthError, DeltaDentalNavigationError } from "./errors";
import { runNationalSearch } from "./national-search";

function toJobResponse(
  jobId: string,
  partial: Pick<VerifyJobResponse, "status" | "message"> &
    Partial<VerifyJobResponse>,
): VerifyJobResponse {
  return { jobId, ...partial };
}

function mapAuthError(error: DeltaDentalAuthError): VerifyJobResponse {
  const messages: Record<DeltaDentalAuthError["code"], string> = {
    mfa_required: error.message,
    login_failed: error.message,
    session_expired:
      "Provider Tools session expired. Run npm run delta:save-session to refresh.",
  };

  return {
    jobId: crypto.randomUUID(),
    status: "failed",
    message: messages[error.code],
    requiresAction:
      error.code === "mfa_required" ? "mfa" : "session_login",
  };
}

export function getDeltaDentalPendingMessage(): string {
  return "Verification accepted. Configure Delta Dental Provider Tools credentials or a saved session (npm run delta:save-session).";
}

export async function verifyWithDeltaDentalProviderTools(
  input: VerifyPatientInput,
  session: VerificationSession,
  jobId: string,
): Promise<VerifyJobResponse> {
  if (!isDeltaDentalConfigured()) {
    return toJobResponse(jobId, {
      status: "pending_configuration",
      message: getDeltaDentalPendingMessage(),
      payer: "delta_dental",
    });
  }

  assertDeltaDentalConfigured();

  const page = await session.context.newPage();

  try {
    await ensureProviderToolsSession(page);
    const searchResult = await runNationalSearch(page, input);

    const eligibility: EligibilitySnapshot = {
      payer: "delta_dental",
      source: "provider_tools_eligibility_benefits",
      capturedAt: new Date().toISOString(),
      coverageStatus: searchResult.coverageStatus,
      patientName: searchResult.patientName ?? input.patientName,
      planName: searchResult.planName,
      groupName: searchResult.groupName,
      memberId: searchResult.memberId,
      memberType: searchResult.memberType,
      dateOfBirth: searchResult.dateOfBirth,
      groupNumber: searchResult.groupNumber,
      eligibilityPeriod: searchResult.eligibilityPeriod,
      recordDate: searchResult.recordDate,
      provisions: searchResult.provisions,
      benefitLevels: searchResult.benefitLevels,
      maximums: searchResult.maximums,
      deductibles: searchResult.deductibles,
      summaryExcerpt: searchResult.summaryText.slice(0, 500),
    };

    const planLabel = searchResult.planName ?? "plan on file";
    return toJobResponse(jobId, {
      status: "completed",
      message: `Eligibility verified — ${searchResult.coverageStatus} (${planLabel}).`,
      payer: "delta_dental",
      eligibility,
    });
  } catch (error) {
    if (error instanceof DeltaDentalAuthError) {
      return { ...mapAuthError(error), jobId };
    }

    if (error instanceof DeltaDentalNavigationError) {
      return toJobResponse(jobId, {
        status: "failed",
        message: error.message,
        payer: "delta_dental",
        requiresAction: "selector_tune",
      });
    }

    const message =
      error instanceof Error ? error.message : "Delta Dental verification failed.";

    return toJobResponse(jobId, {
      status: "failed",
      message,
      payer: "delta_dental",
    });
  } finally {
    await page.close();
  }
}

export { getDeltaDentalConfig, isDeltaDentalConfigured };
