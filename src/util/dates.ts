/**
 * Date formatting helpers.
 *
 * Every function here works in **UTC**, deliberately. Post dates come from
 * front matter and are part of the site's permanent URL/archive structure, so
 * they must render identically no matter which machine or timezone runs the
 * build. Using local time would mean a post dated `2026-01-01` could appear
 * under 2025 when built on a machine west of UTC.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Zero-pad a number to two digits, e.g. `7` -> `"07"`. */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Calendar year in UTC, used to group the archive listing. */
export function utcYear(date: Date): number {
  return date.getUTCFullYear();
}

/**
 * Full ISO-8601 timestamp, e.g. `"2026-08-23T04:18:23.000Z"`.
 * Used for the machine-readable `datetime` attribute on `<time>` elements.
 */
export function toIsoString(date: Date): string {
  return date.toISOString();
}

/**
 * Numeric date, e.g. `"2026-08-23"`.
 * Used as the visible date line on a post page.
 */
export function formatNumericDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
  ].join('-');
}

/**
 * Short month and day, e.g. `"Aug 23"`.
 * Used in the archive listing, where the year is already the group heading.
 */
export function formatShortDate(date: Date): string {
  // `getUTCMonth()` returns 0-11, which indexes MONTH_NAMES directly. The
  // fallback satisfies `noUncheckedIndexedAccess`; it is not reachable.
  const month = MONTH_NAMES[date.getUTCMonth()] ?? '???';
  return `${month} ${date.getUTCDate()}`;
}

/**
 * Render the footer copyright span, collapsing `2026 - 2026` to just `2026`.
 */
export function formatCopyrightYears(startYear: number, now: Date): string {
  const current = now.getUTCFullYear();
  return current <= startYear ? String(startYear) : `${startYear} - ${current}`;
}
