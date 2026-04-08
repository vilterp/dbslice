/**
 * Tests for SQLite compound FK/PK detection.
 *
 * Creates a temporary SQLite database via a child_process so `node:sqlite` resolves
 * outside Jest 28's module resolver (which doesn't handle the `node:` protocol).
 *
 * Schema:
 *   single_pk_table    – 1-col PK, referenced by a single-col FK
 *   compound_pk_target – 2-col compound PK, referenced by a compound FK
 *   compound_fk_source – 2-col compound FK → compound_pk_target
 *                        + 1-col single FK  → single_pk_table
 */
import request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createServer } from '../server';
import { initializeDatabase } from '../initDB';

let app: any = null;
let dbPath = '';

beforeAll(async () => {
  // Create temp SQLite file via child_process (avoids Jest 28 node: protocol issue)
  dbPath = path.join(os.tmpdir(), `dbslice_sqlite_test_${Date.now()}.db`);
  const script = [
    `const { DatabaseSync } = require('node:sqlite');`,
    `const db = new DatabaseSync(${JSON.stringify(dbPath)});`,
    `db.exec('CREATE TABLE single_pk_table (pk_col TEXT NOT NULL PRIMARY KEY, label TEXT)');`,
    `db.exec('CREATE TABLE compound_pk_target (type_col TEXT NOT NULL, id_col INTEGER NOT NULL, extra TEXT, PRIMARY KEY (type_col, id_col))');`,
    `db.exec('CREATE TABLE compound_fk_source (src_id INTEGER PRIMARY KEY, ref_type TEXT NOT NULL, ref_id INTEGER NOT NULL, single_ref TEXT, data TEXT, FOREIGN KEY (ref_type, ref_id) REFERENCES compound_pk_target(type_col, id_col), FOREIGN KEY (single_ref) REFERENCES single_pk_table(pk_col))');`,
    `db.close();`,
  ].join('\n');

  try {
    execFileSync(process.execPath, ['--eval', script], { stdio: 'pipe' });
  } catch {
    // node:sqlite not available — all tests in this file will be no-ops
    return;
  }

  const config = {
    database: { path: dbPath, type: 'sqlite' as const },
    server: { port: 3002, host: 'localhost' },
    api: { maxRows: 1000, maxHistogramBins: 50 },
  };
  const db = initializeDatabase(config);
  const server = createServer(db, config);
  app = server.app;

  // Give DuckDB time to create views asynchronously
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(() => {
  if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

// Helper: if app wasn't created, skip gracefully
const skip = () => { if (!app) return true; return false; };

describe('SQLite compound FK detection', () => {
  describe('compound_fk_source forward FK columns', () => {
    it('both columns in a compound FK get foreign_key with all_columns set', async () => {
      if (skip()) return;
      const response = await request(app)
        .get('/api/tables/compound_fk_source/columns')
        .expect(200);

      const refType = response.body.find((c: any) => c.column_name === 'ref_type');
      const refId   = response.body.find((c: any) => c.column_name === 'ref_id');

      expect(refType).toHaveProperty('foreign_key');
      expect(refId).toHaveProperty('foreign_key');

      expect(refType.foreign_key.referenced_table).toBe('compound_pk_target');
      expect(refType.foreign_key.referenced_column).toBe('type_col');
      expect(refType.foreign_key.all_columns).toEqual(['ref_type', 'ref_id']);
      expect(refType.foreign_key.all_referenced_columns).toEqual(['type_col', 'id_col']);

      expect(refId.foreign_key.referenced_table).toBe('compound_pk_target');
      expect(refId.foreign_key.referenced_column).toBe('id_col');
      expect(refId.foreign_key.all_columns).toEqual(['ref_type', 'ref_id']);
      expect(refId.foreign_key.all_referenced_columns).toEqual(['type_col', 'id_col']);
    });

    it('single-column FK on same table does not get all_columns', async () => {
      if (skip()) return;
      const response = await request(app)
        .get('/api/tables/compound_fk_source/columns')
        .expect(200);

      const singleRef = response.body.find((c: any) => c.column_name === 'single_ref');
      expect(singleRef).toHaveProperty('foreign_key');
      expect(singleRef.foreign_key.referenced_table).toBe('single_pk_table');
      expect(singleRef.foreign_key.all_columns).toBeUndefined();
      expect(singleRef.foreign_key.all_referenced_columns).toBeUndefined();
    });

    it('non-FK columns do not get foreign_key', async () => {
      if (skip()) return;
      const response = await request(app)
        .get('/api/tables/compound_fk_source/columns')
        .expect(200);

      const srcId = response.body.find((c: any) => c.column_name === 'src_id');
      const data  = response.body.find((c: any) => c.column_name === 'data');
      expect(srcId.foreign_key).toBeUndefined();
      expect(data.foreign_key).toBeUndefined();
    });
  });

  describe('compound_pk_target reverse FK columns', () => {
    it('both PK columns get reverse_foreign_keys with all_source_columns set', async () => {
      if (skip()) return;
      const response = await request(app)
        .get('/api/tables/compound_pk_target/columns')
        .expect(200);

      const typeCol = response.body.find((c: any) => c.column_name === 'type_col');
      const idCol   = response.body.find((c: any) => c.column_name === 'id_col');

      expect(typeCol).toHaveProperty('reverse_foreign_keys');
      expect(idCol).toHaveProperty('reverse_foreign_keys');
      expect(typeCol.reverse_foreign_keys.length).toBe(1);
      expect(idCol.reverse_foreign_keys.length).toBe(1);

      const typeRfk = typeCol.reverse_foreign_keys[0];
      expect(typeRfk.source_table).toBe('compound_fk_source');
      expect(typeRfk.source_column).toBe('ref_type');
      expect(typeRfk.all_source_columns).toEqual(['ref_type', 'ref_id']);
      expect(typeRfk.all_referenced_columns).toEqual(['type_col', 'id_col']);

      const idRfk = idCol.reverse_foreign_keys[0];
      expect(idRfk.source_table).toBe('compound_fk_source');
      expect(idRfk.source_column).toBe('ref_id');
      expect(idRfk.all_source_columns).toEqual(['ref_type', 'ref_id']);
      expect(idRfk.all_referenced_columns).toEqual(['type_col', 'id_col']);
    });

    it('non-referenced columns do not get reverse_foreign_keys', async () => {
      if (skip()) return;
      const response = await request(app)
        .get('/api/tables/compound_pk_target/columns')
        .expect(200);

      const extra = response.body.find((c: any) => c.column_name === 'extra');
      expect(extra.reverse_foreign_keys).toBeUndefined();
    });
  });

  describe('single_pk_table reverse FK columns', () => {
    it('single-column reverse FK does not get all_source_columns', async () => {
      if (skip()) return;
      const response = await request(app)
        .get('/api/tables/single_pk_table/columns')
        .expect(200);

      const pkCol = response.body.find((c: any) => c.column_name === 'pk_col');
      expect(pkCol).toHaveProperty('reverse_foreign_keys');
      expect(pkCol.reverse_foreign_keys.length).toBe(1);
      expect(pkCol.reverse_foreign_keys[0].all_source_columns).toBeUndefined();
      expect(pkCol.reverse_foreign_keys[0].all_referenced_columns).toBeUndefined();
    });
  });
});
