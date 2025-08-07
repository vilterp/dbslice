import { 
  Query, 
  HistogramQuery, 
  Filter, 
  QueryStep,
  Table,
  Column,
  NUMERICAL_COLUMN_TYPES
} from './types';

export abstract class BaseDuckDBDatabase {
  protected schemaName: string = 'main';

  // Method to set schema name from subclasses
  protected setSchemaName(schemaName: string): void {
    console.log('[BaseDuckDBDatabase] Setting schema name to:', schemaName);
    this.schemaName = schemaName;
  }

  // Abstract method for executing SQL queries - implemented by subclasses
  protected abstract executeQuery(sql: string): Promise<any[]>;
  
  // Abstract method for determining if a column should not have histogram - implemented by subclasses
  protected abstract shouldSkipHistogram(tableName: string, columnName: string): boolean;

  // Shared SQL building methods
  protected buildQuerySQL(query: Query): { sql: string; countSql: string } {
    const { tableName, filters = [], orderBy, orderDir = 'ASC', limit, offset, steps = [] } = query;
    
    console.log('[BaseDuckDBDatabase] Building query with schema:', this.schemaName, 'for table:', tableName);
    console.log('[BaseDuckDBDatabase] Schema name type:', typeof this.schemaName);
    const sanitizedTableName = `${this.schemaName}.${this.sanitizeIdentifier(tableName)}`;
    console.log('[BaseDuckDBDatabase] Full table name:', sanitizedTableName);
    
    // Build CTE clauses if steps exist
    const cteClause = this.buildCTEClause(steps);
    
    // Build WHERE clause
    const whereClause = this.buildWhereClause(filters);
    
    // Build ORDER BY clause
    let orderByClause = '';
    if (orderBy) {
      const sanitizedOrderBy = this.sanitizeIdentifier(orderBy);
      const dir = orderDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      orderByClause = ` ORDER BY ${sanitizedOrderBy} ${dir}`;
    }
    
    // Build LIMIT clause
    let limitClause = '';
    if (limit !== undefined) {
      limitClause = ` LIMIT ${limit}`;
      if (offset !== undefined) {
        limitClause += ` OFFSET ${offset}`;
      }
    }
    
    const sql = `${cteClause}SELECT * FROM ${sanitizedTableName}${whereClause}${orderByClause}${limitClause}`;
    const countSql = `${cteClause}SELECT COUNT(*) as total FROM ${sanitizedTableName}${whereClause}`;
    
    console.log('Generated SQL:', sql);
    return { sql, countSql };
  }

  protected buildHistogramSQL(histogramQuery: HistogramQuery): { sql: string } {
    const { tableName, columnName, columnType, filters = [], topN = 5 } = histogramQuery;
    
    const sanitizedTableName = `${this.schemaName}.${this.sanitizeIdentifier(tableName)}`;
    const sanitizedColumnName = this.sanitizeIdentifier(columnName);
    
    // Build WHERE clause excluding the histogram column
    const whereClause = this.buildWhereClause(filters.filter(f => f.column !== columnName));
    
    const isNumerical = NUMERICAL_COLUMN_TYPES.some(type => 
      columnType.toUpperCase().includes(type)
    );
    
    let sql: string;
    
    if (isNumerical) {
      // For numerical columns, use DuckDB's histogram function
      sql = `
        SELECT 
          unnest(map_keys(histogram(${sanitizedColumnName}))) as bin_value,
          unnest(map_values(histogram(${sanitizedColumnName}))) as count
        FROM ${sanitizedTableName}
        ${whereClause}
      `;
    } else {
      // For categorical columns
      sql = `
        SELECT 
          ${sanitizedColumnName},
          COUNT(*) as count
        FROM ${sanitizedTableName}
        ${whereClause}
        GROUP BY ${sanitizedColumnName}
        ORDER BY count DESC, ${sanitizedColumnName} ASC
        LIMIT ${Math.max(1, Math.min(topN + 1, 20))}
      `;
    }
    
    return { sql };
  }

  protected buildWhereClause(filters: Filter[]): string {
    if (filters.length === 0) return '';
    
    const conditions: string[] = [];
    
    for (const filter of filters) {
      switch (filter.type) {
        case 'exact':
          const sanitizedValue = typeof filter.value === 'string' 
            ? `'${filter.value.replace(/'/g, "''")}'` 
            : filter.value;
          conditions.push(`${this.sanitizeIdentifier(filter.column)} = ${sanitizedValue}`);
          break;
        case 'range':
          conditions.push(`${this.sanitizeIdentifier(filter.column)} BETWEEN ${filter.min} AND ${filter.max}`);
          break;
        case 'in':
          conditions.push(`${this.sanitizeIdentifier(filter.column)} IN (SELECT ${this.sanitizeIdentifier(filter.stepColumn)} FROM ${this.sanitizeIdentifier(filter.stepName)})`);
          break;
      }
    }
    
    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  protected buildCTEClause(steps: QueryStep[]): string {
    if (steps.length === 0) return '';
    
    const cteStatements: string[] = [];
    
    for (const step of steps) {
      const sanitizedTableName = `${this.schemaName}.${this.sanitizeIdentifier(step.tableName)}`;
      const sanitizedStepName = this.sanitizeIdentifier(step.name);
      const whereClause = this.buildWhereClause(step.filters);
      
      const selectClause = step.selectColumn ? this.sanitizeIdentifier(step.selectColumn) : '*';
      cteStatements.push(`${sanitizedStepName} AS (SELECT ${selectClause} FROM ${sanitizedTableName}${whereClause})`);
    }
    
    return `WITH ${cteStatements.join(', ')} `;
  }

  protected sanitizeIdentifier(identifier: string): string {
    // Basic sanitization - in production you'd want more robust sanitization
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }

  // Shared getTables implementation
  async getTables(): Promise<Table[]> {
    return await this.executeQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
    `);
  }

  // Shared getColumns implementation
  async getColumns(tableName: string): Promise<Column[]> {
    const sanitizedTableName = this.sanitizeIdentifier(tableName);
    
    const columns = await this.executeQuery(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${sanitizedTableName}' 
      AND table_schema = '${this.schemaName}'
    `);
    
    // Get foreign key information (if available)
    let foreignKeys: any[] = [];
    let reverseForeignKeys: any[] = [];
    
    try {
      foreignKeys = await this.executeQuery(`
        SELECT constraint_column_names, referenced_table, referenced_column_names
        FROM duckdb_constraints 
        WHERE table_name = '${sanitizedTableName}' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      
      reverseForeignKeys = await this.executeQuery(`
        SELECT constraint_column_names, table_name as source_table, referenced_column_names
        FROM duckdb_constraints 
        WHERE referenced_table = '${sanitizedTableName}' 
        AND constraint_type = 'FOREIGN KEY'
      `);
    } catch {
      // Foreign key constraints might not be available in all DuckDB versions
    }
    
    // Create foreign key mappings
    const foreignKeyMap = new Map<string, { referenced_table: string; referenced_column: string }>();
    foreignKeys.forEach((fk: any) => {
      const columnName = Array.isArray(fk.constraint_column_names) ? fk.constraint_column_names[0] : fk.constraint_column_names;
      const referencedTable = fk.referenced_table;
      const referencedColumn = Array.isArray(fk.referenced_column_names) ? fk.referenced_column_names[0] : fk.referenced_column_names;
      
      if (columnName && referencedTable && referencedColumn) {
        foreignKeyMap.set(columnName, {
          referenced_table: referencedTable,
          referenced_column: referencedColumn
        });
      }
    });

    const reverseForeignKeyMap = new Map<string, { source_table: string; source_column: string }[]>();
    reverseForeignKeys.forEach((rfk: any) => {
      const referencedColumn = Array.isArray(rfk.referenced_column_names) ? rfk.referenced_column_names[0] : rfk.referenced_column_names;
      const sourceTable = rfk.source_table;
      const sourceColumn = Array.isArray(rfk.constraint_column_names) ? rfk.constraint_column_names[0] : rfk.constraint_column_names;
      
      if (referencedColumn && sourceTable && sourceColumn) {
        if (!reverseForeignKeyMap.has(referencedColumn)) {
          reverseForeignKeyMap.set(referencedColumn, []);
        }
        reverseForeignKeyMap.get(referencedColumn)!.push({
          source_table: sourceTable,
          source_column: sourceColumn
        });
      }
    });
    
    return columns.map((column: any) => ({
      column_name: column.column_name,
      data_type: column.data_type,
      no_histogram: this.shouldSkipHistogram(tableName, column.column_name),
      foreign_key: foreignKeyMap.get(column.column_name),
      reverse_foreign_keys: reverseForeignKeyMap.get(column.column_name)
    }));
  }
}