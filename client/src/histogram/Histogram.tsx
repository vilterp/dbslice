import "./Histogram.css";
import React, { useState, useEffect } from "react";
import { Filter, Query, HistogramResult } from "../../../src/types";
import { Column } from "../api";
import { Database } from "../../../src/database";
import NumericHistogram from "./NumericHistogram";
import DiscreteHistogram from "./DiscreteHistogram";

// Configuration constants (should match api.ts)
const DEFAULT_TOP_N_CATEGORIES = 5;
const BAR_HEIGHT = 24;

type HistogramProps = {
  columnName: string;
  column: Column;
  query: Query;
  isNumerical: boolean;
  database: Database;
  addFilter: (
    column: string,
    value: string,
    type?: "exact" | "range",
    min?: number,
    max?: number
  ) => void;
  removeFilter: (column: string, value: string) => void;
};

const Histogram: React.FC<HistogramProps> = (props) => {
  const [histogramResult, setHistogramResult] =
    useState<HistogramResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const {
    columnName,
    column,
    query,
    isNumerical,
    database,
    addFilter,
    removeFilter,
  } = props;

  // Calculate proper height for discrete histograms: (DEFAULT_TOP_N_CATEGORIES + 1 for "others") * BAR_HEIGHT
  // For numeric histograms, use a fixed height of 100px
  const calculatedHeight = isNumerical
    ? 100
    : (DEFAULT_TOP_N_CATEGORIES + 1) * BAR_HEIGHT;

  useEffect(() => {
    const loadHistogram = async () => {
      setLoading(true);
      try {
        const histogramQuery = {
          tableName: query.tableName,
          columnName: column.column_name,
          columnType: column.data_type,
          filters: query.filters,
          steps: query.steps || [],
          topN: DEFAULT_TOP_N_CATEGORIES,
          bins: 20
        };
        const result = await database.getHistogram(histogramQuery);
        setHistogramResult(result);
      } catch (error) {
        setHistogramResult({
          data: [],
          error:
            error instanceof Error ? error.message : "Failed to load histogram",
        });
      } finally {
        setLoading(false);
      }
    };

    loadHistogram();
  }, [query.tableName, query.filters, query.steps, column]);

  if (loading) {
    return (
      <div
        className="histogram-container"
        style={{ minHeight: `${calculatedHeight}px` }}
      >
        <div
          className="histogram-loading"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: `${calculatedHeight}px`,
            color: "#666",
            fontSize: "14px",
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  const data = histogramResult?.data || [];
  const error = histogramResult?.error;
  const isEmpty = histogramResult?.isEmpty;

  // Render the appropriate histogram component
  if (isNumerical) {
    return (
      <NumericHistogram
        columnName={columnName}
        data={data}
        error={error}
        isEmpty={isEmpty}
        addFilter={addFilter}
        removeFilter={removeFilter}
        filters={query.filters}
      />
    );
  }

  return (
    <DiscreteHistogram
      columnName={columnName}
      data={data}
      error={error}
      isEmpty={isEmpty}
      addFilter={addFilter}
      removeFilter={removeFilter}
      filters={query.filters}
    />
  );
};

export default Histogram;
