"use client";

import { type ClipboardEvent, FormEvent, useState } from "react";

import {
  formatIsoDateForDisplay,
  normalizeDateOfBirth,
} from "@/lib/verify/parse-dob";
import { DashboardShell } from "@/app/components/DashboardShell";
import type {
  BenefitLevelRow,
  DeductibleRow,
  EligibilitySnapshot,
  MaximumRow,
} from "@/lib/verify/types";

type FormState = {
  patientName: string;
  dateOfBirth: string;
  memberId: string;
  patientState: string;
};

type VerifyApiResponse = {
  jobId?: string;
  status?: string;
  message?: string;
  error?: string;
  eligibility?: EligibilitySnapshot;
  requiresAction?: string;
};

const initialForm: FormState = {
  patientName: "",
  dateOfBirth: "",
  memberId: "",
  patientState: "",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-0.5 text-xs">
      <dt className="font-medium text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200/80 dark:border-zinc-700/80">
      <table className="w-full min-w-[32rem] text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-zinc-100/80 dark:bg-zinc-800/80">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="whitespace-nowrap px-2 py-2 font-medium text-zinc-700 dark:text-zinc-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-700/80">
          {rows.map((row, rowIndex) => (
            <tr key={`${caption}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${caption}-${rowIndex}-${cellIndex}`}
                  className="px-2 py-2 align-top text-zinc-800 dark:text-zinc-200"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenefitLevelsTable({ rows }: { rows: BenefitLevelRow[] }) {
  return (
    <DataTable
      caption="Benefits overview"
      headers={[
        "Treatment type",
        "PPO",
        "Premier",
        "Non-Delta",
      ]}
      rows={rows.map((row) => [
        row.treatmentType,
        row.ppoLevel ?? "—",
        row.premierLevel ?? "—",
        row.nonDeltaLevel ?? "—",
      ])}
    />
  );
}

function MaximumsTable({ rows }: { rows: MaximumRow[] }) {
  return (
    <DataTable
      caption="Maximums"
      headers={["Type", "Treatment types", "Network", "Amount", "Used", "Remaining"]}
      rows={rows.map((row) => [
        row.type,
        row.treatmentTypes ?? "—",
        row.network ?? "—",
        row.amount ?? "—",
        row.used ?? "—",
        row.remaining ?? "—",
      ])}
    />
  );
}

function DeductiblesTable({ rows }: { rows: DeductibleRow[] }) {
  return (
    <DataTable
      caption="Deductibles"
      headers={["Type", "Treatment types", "Network", "Amount", "Used", "Remaining"]}
      rows={rows.map((row) => [
        row.type,
        row.treatmentTypes ?? "—",
        row.network ?? "—",
        row.amount ?? "—",
        row.used ?? "—",
        row.remaining ?? "—",
      ])}
    />
  );
}

function EligibilityResults({ eligibility }: { eligibility: EligibilitySnapshot }) {
  const hasBenefitLevels =
    eligibility.benefitLevels && eligibility.benefitLevels.length > 0;
  const hasMaximums = eligibility.maximums && eligibility.maximums.length > 0;
  const hasDeductibles =
    eligibility.deductibles && eligibility.deductibles.length > 0;

  function parseMoney(value: string | undefined): number | null {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatMoney(value: string | undefined): string {
    if (!value) return "—";
    return value.trim();
  }

  function pickRow<T extends { type: string }>(
    rows: T[] | undefined,
    patterns: RegExp[],
  ): T | undefined {
    if (!rows || rows.length === 0) return undefined;
    for (const pattern of patterns) {
      const hit = rows.find((r) => pattern.test(r.type));
      if (hit) return hit;
    }
    return rows[0];
  }

  const maxRow = pickRow(eligibility.maximums, [
    /calendar individual maximum/i,
    /individual maximum/i,
    /maximum/i,
  ]);
  const dedRow = pickRow(eligibility.deductibles, [
    /calendar individual/i,
    /individual/i,
    /deductible/i,
  ]);

  const maxRemaining = parseMoney(maxRow?.remaining);
  const maxAmount = parseMoney(maxRow?.amount);
  const dedRemaining = parseMoney(dedRow?.remaining);
  const dedAmount = parseMoney(dedRow?.amount);

  const lastChecked = eligibility.capturedAt
    ? new Date(eligibility.capturedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

  const planTitle = eligibility.planName ?? "Plan summary";

  return (
    <div className="mt-4 rounded-xl border border-emerald-200/60 bg-white/40 p-4 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/10 dark:text-emerald-50">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <aside className="w-full md:w-52">
          <div className="mb-3">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {planTitle}
            </p>
            {eligibility.groupName && (
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                {eligibility.groupName}
              </p>
            )}
          </div>

          <nav className="space-y-1 text-xs">
            <a className="block rounded-lg px-2 py-1.5 text-zinc-900 hover:bg-black/5 dark:text-zinc-50 dark:hover:bg-white/10" href="#plan-summary">
              Plan summary
            </a>
            <a className="block rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10" href="#maximums">
              Maximums
            </a>
            <a className="block rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10" href="#deductibles">
              Deductibles
            </a>
            <a className="block rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10" href="#benefits">
              Benefits
            </a>
            <a className="block rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10" href="#provisions">
              Provisions
            </a>
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <section id="plan-summary" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                  <span className={`inline-flex h-2 w-2 rounded-full ${eligibility.coverageStatus === "active" ? "bg-emerald-500" : eligibility.coverageStatus === "inactive" ? "bg-red-500" : "bg-zinc-400"}`} />
                  {eligibility.coverageStatus === "active"
                    ? "Active"
                    : eligibility.coverageStatus === "inactive"
                      ? "Inactive"
                      : "Unknown"}
                </span>
                {eligibility.patientName && (
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">
                    {eligibility.patientName}
                  </span>
                )}
                {eligibility.memberId && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    • {eligibility.memberId}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                <span>
                  Last checked{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {lastChecked}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Remaining benefits
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatMoney(maxRow?.remaining)}
                  {maxRow?.amount ? (
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {" "}
                      / {formatMoney(maxRow.amount)}
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Remaining deductibles
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatMoney(dedRow?.remaining)}
                  {dedRow?.amount ? (
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {" "}
                      / {formatMoney(dedRow.amount)}
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Eligibility period
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {eligibility.eligibilityPeriod ?? "—"}
                </p>
              </div>
            </div>

            {(maxRemaining !== null && maxAmount !== null && maxAmount > 0) ||
            (dedRemaining !== null && dedAmount !== null && dedAmount > 0) ? (
              <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                Amounts are parsed from portal tables; if anything looks off we can tune the selectors.
              </p>
            ) : null}
          </section>

          {eligibility.provisions && eligibility.provisions.length > 0 && (
            <section id="provisions" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
                Provisions
              </h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-zinc-700 dark:text-zinc-200">
                {eligibility.provisions.slice(0, 30).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {hasMaximums && (
            <section id="maximums" className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
                Maximums
              </h3>
              <MaximumsTable rows={eligibility.maximums!} />
            </section>
          )}

          {hasDeductibles && (
            <section id="deductibles" className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
                Deductibles
              </h3>
              <DeductiblesTable rows={eligibility.deductibles!} />
            </section>
          )}

          {hasBenefitLevels && (
            <section id="benefits" className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
                Benefits overview
              </h3>
              <BenefitLevelsTable rows={eligibility.benefitLevels!} />
            </section>
          )}

          {!hasBenefitLevels && !hasMaximums && !hasDeductibles && (
            <p className="text-xs opacity-80">
              Member details were captured, but benefit tables were not found on
              the page. Scroll may be required on the portal, or selectors may
              need tuning.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<VerifyApiResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const dateOfBirth = normalizeDateOfBirth(form.dateOfBirth);
      if (!dateOfBirth) {
        setFeedback({
          error:
            "Date of birth must be a valid date (MM/DD/YYYY or YYYY-MM-DD).",
        });
        return;
      }

      const payload = {
        patientName: form.patientName,
        dateOfBirth,
        memberId: form.memberId,
        ...(form.patientState ? { patientState: form.patientState } : {}),
      };

      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as VerifyApiResponse;

      if (!response.ok) {
        setFeedback({
          error: data.error ?? data.message ?? "Verification request failed.",
        });
        return;
      }

      setFeedback(data);
      setForm(initialForm);
    } catch {
      setFeedback({ error: "Unable to reach the verification service." });
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyDateOfBirth(value: string) {
    const normalized = normalizeDateOfBirth(value);
    updateField(
      "dateOfBirth",
      normalized ? formatIsoDateForDisplay(normalized) : value,
    );
  }

  function handleDateOfBirthPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    const normalized = normalizeDateOfBirth(pasted);
    if (normalized) {
      event.preventDefault();
      updateField("dateOfBirth", formatIsoDateForDisplay(normalized));
    }
  }

  return (
    <DashboardShell
      title="Insurance verification"
      subtitle="Delta Dental Provider Tools — National Search"
      active="verify"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Patient name
              </span>
              <input
                type="text"
                name="patientName"
                autoComplete="name"
                required
                value={form.patientName}
                onChange={(event) =>
                  updateField("patientName", event.target.value)
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                placeholder="Jane Doe"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Date of birth
              </span>
              <input
                type="text"
                name="dateOfBirth"
                required
                autoComplete="bday"
                inputMode="numeric"
                value={form.dateOfBirth}
                onChange={(event) =>
                  updateField("dateOfBirth", event.target.value)
                }
                onPaste={handleDateOfBirthPaste}
                onBlur={(event) => applyDateOfBirth(event.target.value)}
                placeholder="01/21/1993"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
              />
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                MM/DD/YYYY — paste friendly
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Patient state
              </span>
              <input
                type="text"
                name="patientState"
                required
                maxLength={2}
                value={form.patientState}
                onChange={(event) =>
                  updateField(
                    "patientState",
                    event.target.value.toUpperCase(),
                  )
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                placeholder="CA"
                spellCheck={false}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Member ID
              </span>
              <input
                type="text"
                name="memberId"
                required
                value={form.memberId}
                onChange={(event) => updateField("memberId", event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
                placeholder="ABC123456789"
                spellCheck={false}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isSubmitting ? "Submitting…" : "Verify eligibility"}
          </button>
        </form>

        {feedback && (
          <div
            role="status"
            className={`mt-4 rounded-2xl border px-4 py-4 text-sm ${
              feedback.error
                ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
            }`}
          >
            {feedback.error ? (
              feedback.error
            ) : (
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Job {feedback.jobId}</span>
                  {" — "}
                  {feedback.message}
                </p>
                {feedback.eligibility && (
                  <EligibilityResults eligibility={feedback.eligibility} />
                )}
                {feedback.requiresAction === "mfa" && (
                  <p className="text-xs">
                    Run{" "}
                    <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                      npm run delta:save-session
                    </code>{" "}
                    after logging in manually.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
