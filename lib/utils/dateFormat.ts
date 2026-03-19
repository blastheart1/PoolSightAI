/**
 * Normalize various date formats to MM/DD/YYYY format.
 * Used by contract parser location extraction.
 */
export function normalizeToMmddyyyy(
  dateString: string | null | undefined
): string | null {
  if (!dateString || typeof dateString !== "string") {
    return null;
  }

  const trimmed = dateString.trim();
  if (trimmed === "0" || trimmed === "") {
    return null;
  }

  const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = trimmed.match(mmddyyyyPattern);
  if (match) {
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    const year = match[3];
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    if (
      monthNum >= 1 &&
      monthNum <= 12 &&
      dayNum >= 1 &&
      dayNum <= 31 &&
      yearNum >= 1900 &&
      yearNum <= 2100
    ) {
      return `${month}/${day}/${year}`;
    }
  }

  const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    if (
      monthNum >= 1 &&
      monthNum <= 12 &&
      dayNum >= 1 &&
      dayNum <= 31 &&
      yearNum >= 1900 &&
      yearNum <= 2100
    ) {
      return `${month}/${day}/${year}`;
    }
  }

  try {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const y = date.getFullYear();
      return `${m}/${d}/${y}`;
    }
  } catch {
    // ignore
  }
  return null;
}
