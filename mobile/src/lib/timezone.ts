// Atlantic Time Zone (Moncton/Dieppe) - Standardized across the app
// AST = UTC-4, ADT (Daylight Saving) = UTC-3

export const ATLANTIC_TIMEZONE = 'America/Moncton';

/**
 * Format a date/timestamp to Atlantic Time
 */
export function formatDateTimeAtlantic(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-US', {
    timeZone: ATLANTIC_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format just the date portion in Atlantic Time
 */
export function formatDateAtlantic(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString('en-US', {
    timeZone: ATLANTIC_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format just the time portion in Atlantic Time
 */
export function formatTimeAtlantic(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString('en-US', {
    timeZone: ATLANTIC_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get the current date in Atlantic Time (for "today" comparisons)
 */
export function getTodayAtlantic(): { year: number; month: number; day: number } {
  const now = new Date();
  const atlanticStr = now.toLocaleDateString('en-CA', { timeZone: ATLANTIC_TIMEZONE });
  const [year, month, day] = atlanticStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Check if a timestamp is "today" in Atlantic Time
 */
export function isTodayAtlantic(timestamp: string | Date): boolean {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: ATLANTIC_TIMEZONE });
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: ATLANTIC_TIMEZONE });
  return dateStr === todayStr;
}

/**
 * Format a date for display with Atlantic timezone indicator
 */
export function formatDateTimeWithZone(timestamp: string | Date): string {
  const formatted = formatDateTimeAtlantic(timestamp);
  return `${formatted} (Atlantic)`;
}

/**
 * Get ISO date string in Atlantic timezone (YYYY-MM-DD)
 */
export function getAtlanticDateISO(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: ATLANTIC_TIMEZONE });
}

/**
 * Parse a time string (HH:MM) and return hours and minutes
 */
export function parseTimeString(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Format hours and minutes to a time string (HH:MM)
 */
export function formatTimeString(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
