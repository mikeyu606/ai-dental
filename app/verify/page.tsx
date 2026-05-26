"use client";

import { FormEvent, useState } from "react";

type FormState = {
  patientName: string;
  dateOfBirth: string;
  memberId: string;
  patientState: string;
};

type EligibilitySnapshot = {
  coverageStatus?: string;
  patientName?: string;
  planName?: string;
  groupName?: string;
  memberId?: string;
  eligibilityPeriod?: string;
  summaryExcerpt?: string;
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

export default function VerifyPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<VerifyApiResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        patientName: form.patientName,
        dateOfBirth: form.dateOfBirth,
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

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Dental AI Copilot
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Insurance verification
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Delta Dental Provider Tools — National Search
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
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
                type="date"
                name="dateOfBirth"
                required
                value={form.dateOfBirth}
                onChange={(event) =>
                  updateField("dateOfBirth", event.target.value)
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
              />
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
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
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
                  <dl className="space-y-1 text-xs leading-relaxed opacity-90">
                    {feedback.eligibility.patientName && (
                      <div>
                        <dt className="inline font-medium">Patient: </dt>
                        <dd className="inline">{feedback.eligibility.patientName}</dd>
                      </div>
                    )}
                    {feedback.eligibility.planName && (
                      <div>
                        <dt className="inline font-medium">Plan: </dt>
                        <dd className="inline">{feedback.eligibility.planName}</dd>
                      </div>
                    )}
                    {feedback.eligibility.eligibilityPeriod && (
                      <div>
                        <dt className="inline font-medium">Eligibility: </dt>
                        <dd className="inline">
                          {feedback.eligibility.eligibilityPeriod}
                        </dd>
                      </div>
                    )}
                    {feedback.eligibility.memberId && (
                      <div>
                        <dt className="inline font-medium">Member ID: </dt>
                        <dd className="inline">{feedback.eligibility.memberId}</dd>
                      </div>
                    )}
                  </dl>
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
    </div>
  );
}
