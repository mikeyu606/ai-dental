export class DeltaDentalAuthError extends Error {
  readonly code: "mfa_required" | "login_failed" | "session_expired";

  constructor(
    code: DeltaDentalAuthError["code"],
    message: string,
  ) {
    super(message);
    this.name = "DeltaDentalAuthError";
    this.code = code;
  }
}

export class DeltaDentalNavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeltaDentalNavigationError";
  }
}
