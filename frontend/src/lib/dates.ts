/** Time zone of the whole system: Ecuador (UTC-5, no daylight saving). */
const ECUADOR_TZ = 'America/Guayaquil';

/**
 * Formats an ISO UTC instant as a clock time in the given time zone (default: Ecuador).
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
      timeZone: timeZone || ECUADOR_TZ,
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
      timeZone: timeZone || ECUADOR_TZ,
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
 * Today's date as YYYY-MM-DD in Ecuador, whatever the zone of the browser (the web reads a date as an Ecuador day).
 */
export function getTodayDateString(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * The earliest date the search accepts: today in Ecuador (the backend checks departureDate >= today in Ecuador).
 */
export function getValidSearchDateString(now: Date = new Date()): string {
  return getTodayDateString(now);
}

/**
 * Returns tomorrow's date in Ecuador as YYYY-MM-DD.
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

