/**
 * Formats an ISO UTC date string into the airport's local time zone.
 */
export function formatTimeInTimeZone(
  isoDate: string,
  timeZone?: string
): string {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timeZone || 'UTC',
    }).format(date);
  } catch {
    return isoDate.substring(11, 16) || '--:--';
  }
}

/**
 * Formats an ISO date into full readable date in a specific time zone (e.g. "mié, 15 de oct").
 */
export function formatDateInTimeZone(
  isoDate: string,
  timeZone?: string
): string {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('es-EC', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: timeZone || 'UTC',
    }).format(date);
  } catch {
    return isoDate.substring(0, 10);
  }
}

/**
 * Formats duration in minutes to human readable string (e.g. "2 h 15 min").
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the local or specified time zone.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current date in UTC as YYYY-MM-DD.
 * The backend verifies departureDate >= todayUtc(), so this provides
 * the exact minimum date acceptable by the backend.
 */
export function getValidSearchDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns tomorrow's date based on UTC as YYYY-MM-DD.
 * Recommended default for flight departures to ensure schedule availability.
 */
export function getTomorrowDateString(): string {
  return addDaysToDate(getValidSearchDateString(), 1);
}

/**
 * Adds days to a YYYY-MM-DD date string.
 */
export function addDaysToDate(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

