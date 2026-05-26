const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Accepts ISO (YYYY-MM-DD) or US (M/D/YYYY, MM/DD/YYYY). Returns ISO or null. */
export function normalizeDateOfBirth(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (ISO_DATE_PATTERN.test(trimmed) && isValidIsoDate(trimmed)) {
    return trimmed;
  }

  const usMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return isValidIsoDate(iso) ? iso : null;
  }

  return null;
}

/** Display ISO as MM/DD/YYYY for the text input. */
export function formatIsoDateForDisplay(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}
