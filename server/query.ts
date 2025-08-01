import { NUMERICAL_COLUMN_TYPES, Query, RangeFilter, HistogramQuery } from '../src/common';
import { sanitizeQueryResult, sanitizeIdentifier } from './helpers';
import * as duckdb from 'duckdb';
import logger from './logger';

export type QueryRunner = (sql: string, params?: any[]) => Promise<any[]>;

// Top-level runQuery function that takes a Query object and executes it
export const runQuery = async (query: Query, queryRunner: QueryRunner): Promise<any[]> => {
  const {
    tableName,
    exactFilters = {},
    rangeFilters = {},
    orderBy,
    orderDir = 'ASC',
    limit,
    offset
  } = query;

  const sanitizedTableName = sanitizeIdentifier(tableName);
  
  // Build WHERE clause
  const whereClause = buildWhereClause(exactFilters, rangeFilters);
  
  // Build ORDER BY clause
  const orderByClause = buildOrderByClause(orderBy, orderDir);
  
  // Build LIMIT clause
  let limitClause = '';
  if (limit !== undefined) {
    limitClause = ` LIMIT ${limit}`;
    if (offset !== undefined) {
      limitClause += ` OFFSET ${offset}`;
    }
  }
  
  // Construct final SQL query
  const sql = `SELECT * FROM ${sanitizedTableName}${whereClause}${orderByClause}${limitClause}`;
  
  // Execute query
  return await queryRunner(sql);
};

// Count query function that takes a Query object and returns the count
export const runCountQuery = async (query: Query, queryRunner: QueryRunner): Promise<number> => {
  const {
    tableName,
    exactFilters = {},
    rangeFilters = {}
  } = query;

  const sanitizedTableName = sanitizeIdentifier(tableName);
  
  // Build WHERE clause
  const whereClause = buildWhereClause(exactFilters, rangeFilters);
  
  // Construct count SQL query
  const sql = `SELECT COUNT(*) as total FROM ${sanitizedTableName}${whereClause}`;
  
  // Execute query
  const result = await queryRunner(sql);
  return result[0]?.total ?? 0;
};

// Histogram query function that takes a HistogramQuery object and returns histogram data
export const runHistogramQuery = async (histogramQuery: HistogramQuery, queryRunner: QueryRunner): Promise<any[]> => {
  const {
    tableName,
    columnName,
    columnType,
    exactFilters = {},
    rangeFilters = {},
    topN = 5,
    bins = 20
  } = histogramQuery;

  // Build WHERE clause for histogram using the direct filters
  const { whereClause } = buildHistogramWhereClause(exactFilters, rangeFilters, columnName);
  
  // Check if column is numerical for binning
  const isNumerical = isNumericalColumnType(columnType);
  
  if (isNumerical) {
    // For numerical columns, use DuckDB's automatic histogram binning
    const histogramQuerySQL = buildNumericalHistogramQuery(tableName, columnName, whereClause);
    const rawHistogram = await queryRunner(histogramQuerySQL);
    const numBins = Math.max(1, Math.min(bins, 100)); // Limit between 1 and 100 bins
    return transformNumericalHistogramResults(rawHistogram, numBins);
  } else {
    // For categorical columns, use simple GROUP BY COUNT
    // Get top N categories plus calculate "others"
    const topLimit = Math.max(1, Math.min(topN, 20)); // Limit between 1 and 20
    const histogramQuerySQL = buildCategoricalHistogramQuery(tableName, columnName, whereClause, topLimit + 1);
    const rawHistogram = await queryRunner(histogramQuerySQL);
    return await transformCategoricalHistogramResults(rawHistogram, topLimit, columnName, tableName, whereClause, queryRunner);
  }
};

// Create a query runner with shared connection and queuing
export function createQueryRunner(db: duckdb.Database): QueryRunner {
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
  const runSQLQuery = (query: string, params: any[] = []): Promise<any[]> => {
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

  return runSQLQuery;
}

// Build WHERE conditions for exact filters
const buildExactFilterConditions = (filters: Record<string, string | number | boolean>): string[] => {
  if (Object.keys(filters).length === 0) return [];
  
  return Object.entries(filters).map(([column, value]) => {
    const sanitizedColumn = sanitizeIdentifier(column);
    // Use direct substitution with proper escaping
    const safeValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value;
    return `${sanitizedColumn} = ${safeValue}`;
  });
};

// Build WHERE conditions for range filters
const buildRangeFilterConditions = (rangeFilters: Record<string, RangeFilter>): string[] => {
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
const buildWhereClause = (
  filters: Record<string, string | number | boolean>, 
  rangeFilters: Record<string, RangeFilter>
): string => {
  const conditions: string[] = [];
  
  // Add exact filter conditions
  conditions.push(...buildExactFilterConditions(filters));
  
  // Add range filter conditions
  conditions.push(...buildRangeFilterConditions(rangeFilters));
  
  return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
};

// Build ORDER BY clause
const buildOrderByClause = (orderBy?: string, orderDir?: string): string => {
  if (!orderBy || typeof orderBy !== 'string') return '';
  
  const sanitizedOrderBy = sanitizeIdentifier(orderBy);
  let dir = 'ASC';
  if (typeof orderDir === 'string' && ['asc', 'desc', 'ASC', 'DESC'].includes(orderDir)) {
    dir = orderDir.toUpperCase();
  }
  
  return ` ORDER BY ${sanitizedOrderBy} ${dir}`;
};

// Build WHERE clause for histograms (using direct substitution to avoid parameter binding issues)
const buildHistogramWhereClause = (
  exactFilters: Record<string, string | number | boolean>,
  rangeFilters: Record<string, RangeFilter>,
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
const isNumericalColumnType = (columnType: string): boolean => {
  return NUMERICAL_COLUMN_TYPES.some(type => 
    columnType.toUpperCase().includes(type)
  );
};


// Build optimized numerical histogram query using DuckDB's automatic binning
const buildNumericalHistogramQuery = (tableName: string, columnName: string, whereClause: string): string => {
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
const buildCategoricalHistogramQuery = (
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
const transformNumericalHistogramResults = (rawHistogram: any[], maxBins?: number): any[] => {
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
const transformCategoricalHistogramResults = async (
  rawHistogram: any[], 
  topLimit: number, 
  columnName: string,
  tableName: string,
  whereClause: string,
  queryRunner: QueryRunner
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
    // We queried for topLimit + 1, so if we got more than topLimit, there might be even more
    // Query for total distinct count to get accurate count of "other" values
    const sanitizedTableName = sanitizeIdentifier(tableName);
    const sanitizedColumnName = sanitizeIdentifier(columnName);
    const distinctCountQuery = `SELECT COUNT(DISTINCT ${sanitizedColumnName}) as total_distinct FROM ${sanitizedTableName}${whereClause}`;
    const distinctResult = await queryRunner(distinctCountQuery);
    const totalDistinctCount = distinctResult[0]?.total_distinct || 0;
    
    // Count the number of distinct values that are not in the top N
    const otherDistinctCount = Math.max(0, totalDistinctCount - topLimit);
    
    // Sum the row counts for all the "other" categories (those beyond topLimit)
    const otherRowCount = filteredResults.slice(topLimit).reduce((sum, item) => sum + Number(item.count), 0);
    
    if (otherDistinctCount > 0) {
      topResults.push({
        [columnName]: `(${otherDistinctCount} other value${otherDistinctCount === 1 ? '' : 's'})`,
        count: otherRowCount,
        is_others: true,
        distinct_count: otherDistinctCount
      });
    }
  }
  
  return topResults;
};