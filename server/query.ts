// Query building utilities for DuckDB
import * as duckdb from 'duckdb';
import logger from './logger';

// Utility function to convert BigInt values to numbers for JSON serialization
const sanitizeQueryResult = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeQueryResult);
  } else if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = typeof value === 'bigint' ? Number(value) : sanitizeQueryResult(value);
    }
    return sanitized;
  } else if (typeof data === 'bigint') {
    return Number(data);
  }
  return data;
};

// Create a query runner with shared connection and queuing
export function createQueryRunner(db: duckdb.Database) {
  // Create a shared connection for better caching and performance
  const sharedConnection = new duckdb.Connection(db);
  
  // Query queue to serialize queries on the shared connection
  const queryQueue: Array<() => void> = [];
  let isProcessingQuery = false;
  
  const processQueryQueue = () => {
    if (isProcessingQuery || queryQueue.length === 0) return;
    
    isProcessingQuery = true;
    const nextQuery = queryQueue.shift();
    if (nextQuery) {
      nextQuery();
    }
  };
  
  // Promisified query function using the shared connection with queuing
  const runQuery = (query: string, params: any[] = []): Promise<any[]> => {
    const startTime = Date.now();
    const queryId = Math.random().toString(36).substring(2, 8); // Generate short unique ID
    
    // Log when the query starts
    logger.info('SQL query started', { 
      queryId,
      query: query.trim(),
      params: params.length > 0 ? params : undefined
    });
    
    return new Promise((resolve, reject) => {
      const executeQuery = () => {
        if (params.length === 0) {
          sharedConnection.all(query, (err: Error | null, rows: any[]) => {
            isProcessingQuery = false;
            const duration = Date.now() - startTime;
            
            if (err) {
              logger.error('SQL query failed', { 
                queryId,
                query: query.trim(),
                params: params.length > 0 ? params : undefined,
                error: err.message,
                duration: `${duration}ms`
              });
              reject(err);
            } else {
              logger.info('SQL query finished', { 
                queryId,
                query: query.trim(),
                rowCount: rows?.length || 0,
                duration: `${duration}ms`
              });
              resolve(sanitizeQueryResult(rows || []));
            }
            
            // Process next query in queue
            processQueryQueue();
          });
        } else {
          sharedConnection.all(query, params, (err: Error | null, rows: any[]) => {
            isProcessingQuery = false;
            const duration = Date.now() - startTime;
            
            if (err) {
              logger.error('SQL query failed', { 
                queryId,
                query: query.trim(),
                params,
                error: err.message,
                duration: `${duration}ms`
              });
              reject(err);
            } else {
              logger.info('SQL query finished', { 
                queryId,
                query: query.trim(),
                rowCount: rows?.length || 0,
                duration: `${duration}ms`
              });
              resolve(sanitizeQueryResult(rows || []));
            }
            
            // Process next query in queue
            processQueryQueue();
          });
        }
      };
      
      // Add query to queue
      queryQueue.push(executeQuery);
      processQueryQueue();
    });
  };

  return runQuery;
}

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
export const transformNumericalHistogramResults = (rawHistogram: any[], maxBins?: number): any[] => {
  let validBins = rawHistogram.map(row => ({
    bin_value: Number(row.bin_value),
    count: Number(row.count)
  })).filter(bin => bin.count > 0);
  
  if (validBins.length === 0) return [];
  
  // Limit the number of bins if specified by merging adjacent bins
  if (maxBins && validBins.length > maxBins) {
    validBins.sort((a, b) => a.bin_value - b.bin_value);
    
    // Merge bins to reduce to maxBins
    const mergedBins = [];
    const binsPerGroup = Math.ceil(validBins.length / maxBins);
    
    for (let i = 0; i < validBins.length; i += binsPerGroup) {
      const group = validBins.slice(i, i + binsPerGroup);
      const totalCount = group.reduce((sum, bin) => sum + bin.count, 0);
      const minValue = Math.min(...group.map(bin => bin.bin_value));
      const maxValue = Math.max(...group.map(bin => bin.bin_value));
      
      mergedBins.push({
        bin_value: (minValue + maxValue) / 2, // Use center as representative value
        count: totalCount
      });
    }
    
    validBins = mergedBins;
  }
  
  // Sort by bin_value to ensure proper ordering
  validBins.sort((a, b) => a.bin_value - b.bin_value);
  
  // Calculate bin ranges
  return validBins.map((bin, index) => {
    let bin_start: number;
    let bin_end: number;
    
    if (validBins.length === 1) {
      // Single bin case - create a small range around the value
      const value = bin.bin_value;
      const range = Math.abs(value) * 0.1 || 1; // 10% of value or 1 if value is 0
      bin_start = value - range / 2;
      bin_end = value + range / 2;
    } else if (index === 0) {
      // First bin
      const nextValue = validBins[1].bin_value;
      const midpoint = (bin.bin_value + nextValue) / 2;
      bin_start = bin.bin_value - (midpoint - bin.bin_value);
      bin_end = midpoint;
    } else if (index === validBins.length - 1) {
      // Last bin
      const prevValue = validBins[index - 1].bin_value;
      const midpoint = (prevValue + bin.bin_value) / 2;
      bin_start = midpoint;
      bin_end = bin.bin_value + (bin.bin_value - midpoint);
    } else {
      // Middle bins
      const prevValue = validBins[index - 1].bin_value;
      const nextValue = validBins[index + 1].bin_value;
      bin_start = (prevValue + bin.bin_value) / 2;
      bin_end = (bin.bin_value + nextValue) / 2;
    }
    
    return {
      bin_start,
      bin_end,
      count: bin.count,
      bin_value: bin.bin_value
    };
  });
};

// Transform categorical histogram results to expected format with top N + others
export const transformCategoricalHistogramResults = async (
  rawHistogram: any[], 
  topLimit: number, 
  tableName: string, 
  columnName: string, 
  whereClause: string,
  runQuery: (query: string) => Promise<any[]>
): Promise<any[]> => {
  const filteredResults = rawHistogram.filter(row => Number(row.count) > 0);
  
  // Take only the top N results
  const topResults = filteredResults.slice(0, topLimit).map(row => ({
    ...row,
    count: Number(row.count),
    is_others: false
  }));
  
  // Calculate "others" if there are more than topLimit categories
  if (filteredResults.length > topLimit) {
    // Get total count
    const sanitizedTableName = sanitizeIdentifier(tableName);
    const totalQuery = `SELECT COUNT(*) as total FROM ${sanitizedTableName} ${whereClause}`;
    const totalResult = await runQuery(totalQuery);
    const totalCount = totalResult[0]?.total || 0;
    
    // Calculate count for "others"
    const topCount = topResults.reduce((sum, item) => sum + item.count, 0);
    const othersCount = totalCount - topCount;
    
    if (othersCount > 0) {
      topResults.push({
        [columnName]: '(others)',
        count: othersCount,
        is_others: true
      });
    }
  }
  
  return topResults;
};