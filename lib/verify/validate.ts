import { normalizeDateOfBirth } from "./parse-dob";
import type { VerifyPatientInput } from "./types";

const MAX_NAME_LENGTH = 120;
const MAX_MEMBER_ID_LENGTH = 64;

export type ParseResult =
  | { ok: true; data: VerifyPatientInput }
  | { ok: false; error: string };

export function parseVerifyPayload(body: unknown): ParseResult {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const record = body as Record<string, unknown>;
  const patientName =
    typeof record.patientName === "string" ? record.patientName.trim() : "";
  const dateOfBirth =
    typeof record.dateOfBirth === "string" ? record.dateOfBirth.trim() : "";
  const memberId =
    typeof record.memberId === "string" ? record.memberId.trim() : "";
  const patientStateRaw =
    typeof record.patientState === "string"
      ? record.patientState.trim().toUpperCase()
      : "";

  if (!patientName) {
    return { ok: false, error: "Patient name is required." };
  }
  if (patientName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "Patient name is too long." };
  }
  const normalizedDob = normalizeDateOfBirth(dateOfBirth);
  if (!normalizedDob) {
    return {
      ok: false,
      error:
        "Date of birth must be a valid date (MM/DD/YYYY or YYYY-MM-DD).",
    };
  }
  if (!memberId) {
    return { ok: false, error: "Member ID is required." };
  }
  if (memberId.length > MAX_MEMBER_ID_LENGTH) {
    return { ok: false, error: "Member ID is too long." };
  }
  if (!/^[\w-]+$/.test(memberId)) {
    return {
      ok: false,
      error: "Member ID may only contain letters, numbers, hyphens, and underscores.",
    };
  }

  if (patientStateRaw && !/^[A-Z]{2}$/.test(patientStateRaw)) {
    return {
      ok: false,
      error: "Patient state must be a two-letter code (e.g. CA).",
    };
  }

  return {
    ok: true,
    data: {
      patientName,
      dateOfBirth: normalizedDob,
      memberId,
      ...(patientStateRaw ? { patientState: patientStateRaw } : {}),
    },
  };
}
