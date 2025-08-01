import * as duckdb from 'duckdb';

describe('DuckDB date/datetime object shape', () => {
  let db: duckdb.Database;
  let conn: duckdb.Connection;

  beforeAll(() => {
    db = new duckdb.Database(':memory:');
    conn = new duckdb.Connection(db);
  });

  afterAll(() => {
    conn.close();
    db.close();
  });

  it('should return JS object for DATE and TIMESTAMP columns', (done) => {
    conn.all(
      `SELECT DATE '2024-08-01' as d, TIMESTAMP '2024-08-01 12:34:56' as t`,
      (err, rows) => {
        expect(err).toBeNull();
        expect(rows).toBeInstanceOf(Array);
        expect(rows.length).toBe(1);
        const row = rows[0];
        // Log for inspection
        console.log('DuckDB DATE:', row.d);
        console.log('DuckDB TIMESTAMP:', row.t);
        expect(typeof row.d).toBe('object');
        expect(typeof row.t).toBe('object');
        done();
      }
    );
  });
});
