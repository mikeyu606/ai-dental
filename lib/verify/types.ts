export type VerifyPatientInput = {
  patientName: string;
  dateOfBirth: string;
  memberId: string;
  /** Two-letter state (helps PPO / DeltaCare search since Aug 2025). */
  patientState?: string;
};

export type VerifyJobStatus =
  | "accepted"
  | "pending_configuration"
  | "running"
  | "completed"
  | "failed";

export type BenefitLevelRow = {
  treatmentType: string;
  ppoLevel?: string;
  premierLevel?: string;
  nonDeltaLevel?: string;
};

export type MaximumRow = {
  type: string;
  treatmentTypes?: string;
  network?: string;
  amount?: string;
  used?: string;
  remaining?: string;
};

export type DeductibleRow = {
  type: string;
  treatmentTypes?: string;
  network?: string;
  amount?: string;
  used?: string;
  remaining?: string;
};

export type EligibilitySnapshot = {
  payer: "delta_dental";
  source: "provider_tools_eligibility_benefits";
  capturedAt: string;
  coverageStatus: "active" | "inactive" | "unknown";
  patientName?: string;
  planName?: string;
  groupName?: string;
  memberId?: string;
  memberType?: string;
  dateOfBirth?: string;
  groupNumber?: string;
  eligibilityPeriod?: string;
  recordDate?: string;
  provisions?: string[];
  benefitLevels?: BenefitLevelRow[];
  maximums?: MaximumRow[];
  deductibles?: DeductibleRow[];
  /** Truncated benefits text for display — handle as PHI. */
  summaryExcerpt: string;
};

export type VerifyJobResponse = {
  jobId: string;
  status: VerifyJobStatus;
  message: string;
  payer?: "delta_dental";
  eligibility?: EligibilitySnapshot;
  requiresAction?: "mfa" | "session_login" | "selector_tune";
};
