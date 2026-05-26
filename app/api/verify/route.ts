import { NextResponse } from "next/server";

import { runInsuranceVerification } from "@/lib/playwright/cloud-session";
import { parseVerifyPayload } from "@/lib/verify/validate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = parseVerifyPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await runInsuranceVerification(parsed.data);

  const status =
    result.status === "failed"
      ? 502
      : result.status === "completed"
        ? 200
        : 202;

  return NextResponse.json(result, { status });
}
