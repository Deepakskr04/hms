/**
 * Standardize phone numbers to clean 10-digit format.
 * Handles '+91', spaces, hyphens, and leading zero.
 */
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");

  // If user included +91 / 91 country code (12 digits), strip leading 91
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  // If 11 digits and starts with 0, strip leading 0
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits;
}
