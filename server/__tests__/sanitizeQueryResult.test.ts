import { sanitizeQueryResult } from '../sanitize';

describe('sanitizeQueryResult', () => {
  it('converts Date objects to ISO strings', () => {
    const now = new Date('2023-08-01T12:34:56.789Z');
    const input = { foo: now };
    const result = sanitizeQueryResult(input);
    expect(result.foo).toBe('2023-08-01T12:34:56.789Z');
  });

  it('converts nested Date objects to ISO strings', () => {
    const now = new Date('2023-08-01T12:34:56.789Z');
    const input = { foo: { bar: now } };
    const result = sanitizeQueryResult(input);
    expect(result.foo.bar).toBe('2023-08-01T12:34:56.789Z');
  });

  it('converts arrays of Date objects to ISO strings', () => {
    const now = new Date('2023-08-01T12:34:56.789Z');
    const input = [now, { foo: now }];
    const result = sanitizeQueryResult(input);
    expect(result[0]).toBe('2023-08-01T12:34:56.789Z');
    expect(result[1].foo).toBe('2023-08-01T12:34:56.789Z');
  });

  it('converts BigInt to Number', () => {
    const input = { big: BigInt(123) };
    const result = sanitizeQueryResult(input);
    expect(result.big).toBe(123);
  });
});
