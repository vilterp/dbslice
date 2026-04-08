import "./Histogram.css";
import React, { useState, useEffect } from "react";
import { Filter, Query } from "../../../src/types";
import { HistogramResult, Column, fetchHistogram } from "../api";
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
  addFilter: (filter: Filter) => void;
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
        const result = await fetchHistogram(query, column);
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
