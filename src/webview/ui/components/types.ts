export interface TraceStep {
    line: number;
    event: 'line' | 'return' | 'exception';
    changed: Record<string, { from: unknown; to: unknown; new: boolean }>;
    all_vars: Record<string, unknown>;
    return_value?: unknown;
    exception?: string;
}

export interface RunResult {
  success: boolean;
  steps: TraceStep[];
  final_vars?: Record<string, unknown>;
  prints?: string[];
  files_written?: string[];
  error?: string;
  traceback?: string;
}

export interface DataFrameValue {
  __type: 'dataframe';
  rows: number;
  cols: number;
  columns: string[];
  preview: Record<string, unknown>[];
  too_wide: boolean;
}

export interface SeriesValue {
  __type: 'series';
  name: string | null;
  length: number;
  dtype: string;
  preview: unknown[];
}

export interface NdarrayValue {
  __type: 'ndarray';
  shape: number[];
  dtype: string;
  preview: unknown[];
  too_wide: boolean;
}

export type SpecialValue = DataFrameValue | SeriesValue | NdarrayValue;

export function isSpecialValue(v: unknown): v is SpecialValue {
  return typeof v === 'object' && v !== null && '__type' in v;
}