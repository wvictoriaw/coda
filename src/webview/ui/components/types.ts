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