const REDACTED_VALUE = '[REDACTED]';

export function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.searchParams.has('apikey')) {
      url.searchParams.set('apikey', REDACTED_VALUE);
    }

    return url.toString();
  } catch {
    return value.replace(/([?&]apikey=)[^&]*/gi, `$1${REDACTED_VALUE}`);
  }
}
