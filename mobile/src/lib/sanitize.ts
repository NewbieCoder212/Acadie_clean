/**
 * Security utilities for input sanitization
 * Prevents XSS attacks and other injection vulnerabilities
 */

/**
 * Escape HTML entities to prevent XSS attacks
 * Use this for any user input that will be rendered in HTML (emails, PDF, etc.)
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';

  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize a string for safe use in URLs
 */
export function sanitizeForUrl(input: string): string {
  return encodeURIComponent(input);
}

/**
 * Truncate and sanitize text for display
 */
export function sanitizeAndTruncate(
  text: string | null | undefined,
  maxLength: number
): string {
  const sanitized = escapeHtml(text);
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.substring(0, maxLength) + '...';
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize object values recursively
 * Useful for sanitizing form data before sending to templates
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;

  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = escapeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      (result as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>
      );
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}
