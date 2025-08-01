// Utility to format values for display in tables and histograms
export function formatValue(value: any): string {
  if (value == null) return '';
  // DuckDB returns datetimes as ISO strings, e.g. '2023-08-01T12:34:56.789Z'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // If time is 00:00:00, show only date
      if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) {
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      }
      // Otherwise, show local date and time
      return date.toLocaleString();
    }
  }
  // If value is a Date object
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  // Fallback: string conversion
  return String(value);
}
