import type { VerifyPatientInput } from "./types";

const MAX_NAME_LENGTH = 120;
const MAX_MEMBER_ID_LENGTH = 64;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ParseResult =
  | { ok: true; data: VerifyPatientInput }
  | { ok: false; error: string };

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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
  if (!dateOfBirth || !isValidIsoDate(dateOfBirth)) {
    return {
      ok: false,
      error: "Date of birth must be a valid ISO date (YYYY-MM-DD).",
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
      dateOfBirth,
      memberId,
      ...(patientStateRaw ? { patientState: patientStateRaw } : {}),
    },
  };
}
