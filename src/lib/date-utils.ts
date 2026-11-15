/**
 * Standardize any date to 12:00:00 PM local time
 */
export function toTwelvePM(dateInput: string | Date): Date {
  const d = new Date(dateInput);
  d.setHours(12, 0, 0, 0);
  return d;
}
