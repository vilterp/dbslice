// Utility functions for data sanitization and processing

// Utility function to convert BigInt values to numbers for JSON serialization
export const sanitizeQueryResult = (data: any): any => {
  // DuckDB DATE: { year, month, day }
  if (
    data &&
    typeof data === 'object' &&
    Object.keys(data).length === 3 &&
    typeof data.year === 'number' &&
    typeof data.month === 'number' &&
    typeof data.day === 'number'
  ) {
    // Pad month/day
    const mm = String(data.month).padStart(2, '0');
    const dd = String(data.day).padStart(2, '0');
    return `${data.year}-${mm}-${dd}`;
  }
  // DuckDB TIMESTAMP: { year, month, day, hours, minutes, seconds, ms }
  if (
    data &&
    typeof data === 'object' &&
    typeof data.year === 'number' &&
    typeof data.month === 'number' &&
    typeof data.day === 'number' &&
    typeof data.hours === 'number' &&
    typeof data.minutes === 'number' &&
    typeof data.seconds === 'number' &&
    typeof data.ms === 'number'
  ) {
    const mm = String(data.month).padStart(2, '0');
    const dd = String(data.day).padStart(2, '0');
    const hh = String(data.hours).padStart(2, '0');
    const min = String(data.minutes).padStart(2, '0');
    const ss = String(data.seconds).padStart(2, '0');
    const ms = String(data.ms).padStart(3, '0');
    return `${data.year}-${mm}-${dd}T${hh}:${min}:${ss}.${ms}Z`;
  }
  if (data instanceof Date) {
    return data.toISOString();
  } else if (Array.isArray(data)) {
    return data.map(sanitizeQueryResult);
  } else if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'bigint') {
        sanitized[key] = Number(value);
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else {
        sanitized[key] = sanitizeQueryResult(value);
      }
    }
    return sanitized;
  } else if (typeof data === 'bigint') {
    return Number(data);
  }
  return data;
};

// Utility function to sanitize identifiers
export const sanitizeIdentifier = (identifier: string): string => {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
};