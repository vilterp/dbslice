// Query building utilities for DuckDB

// Utility function to sanitize identifiers
export const sanitizeIdentifier = (identifier: string): string => {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
};

// Build WHERE conditions for exact filters
export const buildExactFilterConditions = (filters: Record<string, any>): string[] => {
  if (Object.keys(filters).length === 0) return [];
  
  return Object.entries(filters).map(([column, value]) => {
    const sanitizedColumn = sanitizeIdentifier(column);
    // Use direct substitution with proper escaping
    const safeValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
    return `${sanitizedColumn} = ${safeValue}`;
  });
};

// Build WHERE conditions for range filters
export const buildRangeFilterConditions = (rangeFilters: Record<string, { min: number; max: number }>): string[] => {
  if (Object.keys(rangeFilters).length === 0) return [];
  
  return Object.entries(rangeFilters).map(([column, range]) => {
    const sanitizedColumn = sanitizeIdentifier(column);
    
    if (typeof range !== 'object' || range === null) {
      throw new Error(`Invalid range filter for column ${column}: expected object, got ${typeof range}`);
    }
    
    const { min, max } = range;
    
    if (typeof min !== 'number' || typeof max !== 'number') {
      throw new Error(`Invalid range values for column ${column}: min=${min} (${typeof min}), max=${max} (${typeof max})`);
    }
    
    return `${sanitizedColumn} >= ${min} AND ${sanitizedColumn} <= ${max}`;
  });
};

// Build complete WHERE clause from filters
export const buildWhereClause = (
  filters: Record<string, any>, 
  rangeFilters: Record<string, { min: number; max: number }>
): string => {
  const conditions: string[] = [];
  
  // Add exact filter conditions
  conditions.push(...buildExactFilterConditions(filters));
  
  // Add range filter conditions
  conditions.push(...buildRangeFilterConditions(rangeFilters));
  
  return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
};

// Build ORDER BY clause
export const buildOrderByClause = (orderBy?: string, orderDir?: string): string => {
  if (!orderBy || typeof orderBy !== 'string') return '';
  
  const sanitizedOrderBy = sanitizeIdentifier(orderBy);
  let dir = 'ASC';
  if (typeof orderDir === 'string' && ['asc', 'desc', 'ASC', 'DESC'].includes(orderDir)) {
    dir = orderDir.toUpperCase();
  }
  
  return ` ORDER BY ${sanitizedOrderBy} ${dir}`;
};

// Parse query parameters into exact and range filters for histograms
export const parseHistogramFilters = (
  queryParams: Record<string, any>,
  excludeColumn: string
): { exactFilters: Record<string, any>; rangeFilters: Record<string, { min: number; max: number }> } => {
  const exactFilters: Record<string, any> = {};
  const rangeFilters: Record<string, { min: number; max: number }> = {};
  const sanitizedExcludeColumn = sanitizeIdentifier(excludeColumn);
  
  Object.entries(queryParams).forEach(([key, value]) => {
    const sanitizedKey = sanitizeIdentifier(key);
    
    // Skip the column we're creating a histogram for
    if (sanitizedKey === sanitizedExcludeColumn) return;
    
    if (typeof value === 'string' && value.includes('-')) {
      // Check if this looks like a range filter (format: "min-max")
      const parts = value.split('-');
      if (parts.length === 2) {
        const min = parseFloat(parts[0]);
        const max = parseFloat(parts[1]);
        if (!isNaN(min) && !isNaN(max)) {
          rangeFilters[key] = { min, max };
          return;
        }
      }
    }
    // Not a range filter, treat as exact filter
    exactFilters[key] = value;
  });
  
  return { exactFilters, rangeFilters };
};

// Build WHERE clause for histograms (using direct substitution to avoid parameter binding issues)
export const buildHistogramWhereClause = (
  exactFilters: Record<string, any>,
  rangeFilters: Record<string, { min: number; max: number }>,
  excludeColumn: string
): { whereClause: string; params: any[] } => {
  const conditions: string[] = [];
  const sanitizedExcludeColumn = sanitizeIdentifier(excludeColumn);
  
  // Handle exact filters (exclude the column we're histogramming) - use direct substitution
  Object.entries(exactFilters).forEach(([column, value]) => {
    const sanitizedColumn = sanitizeIdentifier(column);
    if (sanitizedColumn !== sanitizedExcludeColumn) {
      // Use direct substitution with proper escaping
      const safeValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
      conditions.push(`${sanitizedColumn} = ${safeValue}`);
    }
  });
  
  // Handle range filters (exclude the column we're histogramming)  
  Object.entries(rangeFilters).forEach(([column, range]) => {
    const sanitizedColumn = sanitizeIdentifier(column);
    if (sanitizedColumn !== sanitizedExcludeColumn) {
      // Use direct substitution for range filters
      conditions.push(`${sanitizedColumn} >= ${range.min} AND ${sanitizedColumn} <= ${range.max}`);
    }
  });
  
  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  
  // Return empty params array since we're using direct substitution
  return { whereClause, params: [] };
};

// Check if a column type is numerical
export const isNumericalColumnType = (columnType: string): boolean => {
  return ['INTEGER', 'BIGINT', 'DECIMAL', 'DOUBLE', 'FLOAT', 'NUMERIC', 'REAL'].some(type => 
    columnType.toUpperCase().includes(type)
  );
};

// Check if BigInt values might cause overflow in histogram calculations
export const isBigIntOverflowRisk = (columnType: string, minVal: number, maxVal: number): boolean => {
  return columnType.toUpperCase().includes('BIGINT') && 
         (Math.abs(minVal) > Number.MAX_SAFE_INTEGER || Math.abs(maxVal) > Number.MAX_SAFE_INTEGER);
};

// Build query to get min/max values for numerical histogram
export const buildRangeQuery = (tableName: string, columnName: string, whereClause: string): string => {
  const sanitizedTableName = sanitizeIdentifier(tableName);
  const sanitizedColumnName = sanitizeIdentifier(columnName);
  
  return `SELECT MIN(${sanitizedColumnName}) as min_val, MAX(${sanitizedColumnName}) as max_val FROM ${sanitizedTableName}${whereClause}`;
};

// Build optimized numerical histogram query using DuckDB's automatic binning
export const buildNumericalHistogramQuery = (tableName: string, columnName: string, whereClause: string): string => {
  const sanitizedTableName = sanitizeIdentifier(tableName);
  const sanitizedColumnName = sanitizeIdentifier(columnName);
  
  return `
    SELECT 
      unnest(map_keys(histogram(${sanitizedColumnName}))) as bin_value,
      unnest(map_values(histogram(${sanitizedColumnName}))) as count
    FROM ${sanitizedTableName}
    ${whereClause}
  `;
};

// Build categorical histogram query using simple GROUP BY COUNT
export const buildCategoricalHistogramQuery = (
  tableName: string, 
  columnName: string, 
  whereClause: string, 
  limit: number = 20
): string => {
  const sanitizedTableName = sanitizeIdentifier(tableName);
  const sanitizedColumnName = sanitizeIdentifier(columnName);
  
  return `
    SELECT 
      ${sanitizedColumnName},
      COUNT(*) as count
    FROM ${sanitizedTableName}
    ${whereClause}
    GROUP BY ${sanitizedColumnName}
    ORDER BY count DESC, ${sanitizedColumnName} ASC
    LIMIT ${limit}
  `;
};

// Transform numerical histogram results to expected format (for both regular and BigInt)
export const transformNumericalHistogramResults = (rawHistogram: any[]): any[] => {
  return rawHistogram.map(row => ({
    bin_start: Number(row.bin_value),
    bin_end: Number(row.bin_value),
    count: Number(row.count),
    bin_value: Number(row.bin_value)
  })).filter(bin => bin.count > 0);
};

// Transform categorical histogram results to expected format
export const transformCategoricalHistogramResults = (rawHistogram: any[]): any[] => {
  return rawHistogram.filter(row => Number(row.count) > 0).map(row => ({
    ...row,
    count: Number(row.count),
    is_others: false // No longer using 'other' concept since we're getting top results directly
  }));
};