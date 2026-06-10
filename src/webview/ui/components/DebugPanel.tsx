import * as React from 'react';
import { useState } from 'react';
import { RunResult, isSpecialValue, SpecialValue, DataFrameValue, SeriesValue, NdarrayValue } from './types';
import { TokenSet } from './tokens';

interface Props {
  snippet: string;
  startLine: number;
  externalVars: string[];
  snippetContext: string;
  vscode: ReturnType<typeof acquireVsCodeApi>;
  tokens: TokenSet;
}

export function DebugPanel({ snippet, startLine, externalVars, snippetContext, vscode, tokens }: Props) {
  const [editedSnippet, setEditedSnippet] = useState(snippet);
  const [varValues, setVarValues] = useState<Record<string, string>>(
    Object.fromEntries(externalVars.map(v => [v, '']))
  );
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [previewValue, setPreviewValue] = useState<SpecialValue | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  React.useEffect(() => {
    setEditedSnippet(snippet);
    setVarValues(Object.fromEntries(externalVars.map(v => [v, ''])));
    setResult(null);
    setInputError(null);
  }, [snippet, externalVars]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'runResult') {
        setResult(event.data.result);
        setRunning(false);
      }
      if (event.data.type === 'runError') {
        setResult({ success: false, error: event.data.error, steps: [] });
        setRunning(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleRun = () => {
    const empty = externalVars.filter(v => !varValues[v]?.trim());
    if (empty.length > 0) {
      setInputError('fill in all inputs before running');
      return;
    }
    setInputError(null);
    setRunning(true);
    setResult(null);
    const parsed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(varValues)) {
      try { parsed[k] = JSON.parse(v); }
      catch { parsed[k] = v; }
    }
    const fullSnippet = snippetContext ? `${snippetContext}\n\n${editedSnippet}` : editedSnippet;
    vscode.postMessage({ type: 'runSnippet', snippet: fullSnippet, vars: parsed });
  };

  if (!snippet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <span style={{ fontSize: 11.5, color: tokens.textDimmed, letterSpacing: '0.05em' }}>select a python snippet</span>
        <code style={{ fontSize: 11.5, color: tokens.textSecondary, background: tokens.bgAlt, padding: '3px 8px', borderRadius: 3, border: `1px solid ${tokens.border}` }}>⌘ shift D</code>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {previewValue && (
        <PreviewModal value={previewValue} onClose={() => setPreviewValue(null)} tokens={tokens} />
      )}

      {/* CONTEXT */}
      {snippetContext && (
        <Section label="CONTEXT" tokens={tokens} alt
          right={
            <span
              onClick={() => setContextOpen(o => !o)}
              style={{ fontSize: 9, color: tokens.textDimmed, cursor: 'pointer', userSelect: 'none' }}
            >
              {contextOpen ? '▲' : '▼'}
            </span>
          }
        >
          {contextOpen && (
            <pre style={{
              margin: 0,
              padding: '8px 10px',
              background: tokens.bgCode,
              borderRadius: 4,
              fontSize: 10.5,
              color: tokens.textSecondary,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>{snippetContext}</pre>
          )}
        </Section>
      )}

      {/* INPUTS */}
      {externalVars.length > 0 && (
        <Section label="INPUTS" tokens={tokens}>
          {externalVars.map(v => (
            <div key={v} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${tokens.border}` }}>
              <span style={{ fontSize: 11.5, color: tokens.textDimmed }}>{v}</span>
              <textarea
                style={{ background: tokens.bgInput, border: `1px solid ${tokens.border}`, borderRadius: 3, padding: '4px 8px', fontSize: 11.5, color: tokens.textPrimary, fontFamily: 'var(--vscode-editor-font-family)', width: '100%', boxSizing: 'border-box', resize: 'none', outline: 'none', lineHeight: 1.5, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}
                value={varValues[v] ?? ''}
                onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                placeholder="value or JSON"
                spellCheck={false}
                rows={1}
              />
            </div>
          ))}
        </Section>
      )}

      {/* SNIPPET */}
      <Section label="SNIPPET" tokens={tokens} alt hint={`line ${startLine + 1}`}>
        <textarea
          style={{
            width: '100%',
            background: tokens.bgCode,
            color: tokens.textPrimary,
            border: `1px solid ${tokens.border}`,
            borderRadius: 4,
            padding: 12,
            fontFamily: 'var(--vscode-editor-font-family)',
            fontSize: 12.5,
            resize: 'none',
            boxSizing: 'border-box',
            lineHeight: '20px',
            outline: 'none',
            height: `${(editedSnippet.split('\n').length + 1) * 20}px`,
            maxHeight: `${8 * 20}px`,
            overflowY: 'auto',
          }}
          value={editedSnippet}
          onChange={e => setEditedSnippet(e.target.value)}
          spellCheck={false}
        />
      </Section>

      {/* RUN */}
      <Section tokens={tokens}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            style={{
              background: tokens.accent,
              color: tokens.accentText,
              border: 'none',
              borderRadius: 4,
              padding: '8px 48px',
              fontSize: 11.5,
              cursor: running ? 'not-allowed' : 'pointer',
              letterSpacing: '0.1em',
              fontFamily: 'var(--vscode-editor-font-family)',
              opacity: running ? 0.6 : 1,
              fontWeight: 600,
            }}
            onClick={handleRun}
            disabled={running}
          >
            {running ? 'running...' : 'run'}
          </button>
          {inputError && (
            <span style={{ fontSize: 11, color: tokens.error }}>{inputError}</span>
          )}
        </div>
      </Section>

      {/* PRINTS */}
      {result && result.prints && result.prints.length > 0 && (
        <Section label="PRINTS" tokens={tokens} alt>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.prints.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, fontFamily: 'var(--vscode-editor-font-family)' }}>
                <span style={{ color: tokens.textDimmed }}>›</span>
                <span style={{ color: tokens.textPrimary, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{line}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* OUTPUT */}
      {result && (
        <Section label="OUTPUT" tokens={tokens}>
          {!result.success && (
            <pre style={{ color: tokens.error, fontFamily: 'var(--vscode-editor-font-family)', fontSize: 11.5, margin: 0, whiteSpace: 'pre-wrap' }}>{result.error}</pre>
          )}
          {result.success && result.final_vars && (
            Object.entries(result.final_vars).map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${tokens.border}` }}>
                <span style={{ fontSize: 11.5, color: tokens.textDimmed }}>{k}</span>
                {isSpecialValue(v)
                  ? <SpecialValueCell value={v} onPreview={setPreviewValue} tokens={tokens} />
                  : <span style={{ fontSize: 11.5, fontFamily: 'var(--vscode-editor-font-family)', color: tokens.accent, wordBreak: 'break-all' }}>{JSON.stringify(v)}</span>
                }
              </div>
            ))
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ label, hint, alt, right, tokens, children }: {
  label?: string;
  hint?: string;
  alt?: boolean;
  right?: React.ReactNode;
  tokens: TokenSet;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ background: tokens.bg, padding: '16px 20px' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: tokens.sectionLine,
            whiteSpace: 'nowrap',
          }}>
            {label}
            {hint && <span style={{ fontSize: 9, color: tokens.textSecondary, fontWeight: 400, marginLeft: 8, opacity: 0.5}}>{hint}</span>}
          </span>
          {/* The extending line */}
          <div style={{
            flex: 1,
            height: 1,
            background: tokens.sectionLine,
          }} />
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function SpecialValueCell({ value, onPreview, tokens }: {
  value: SpecialValue;
  onPreview: (value: SpecialValue) => void;
  tokens: TokenSet;
}) {
  const descriptor = () => {
    if (value.__type === 'dataframe') return `DataFrame  ${value.rows} rows × ${value.cols} cols`;
    if (value.__type === 'series') return `Series  ${value.length} items  ${value.dtype}`;
    if (value.__type === 'ndarray') return `ndarray  [${value.shape.join(' × ')}]  ${value.dtype}`;
    return 'unknown';
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, fontFamily: 'var(--vscode-editor-font-family)', color: tokens.textSecondary }}>{descriptor()}</span>
      <button
        onClick={() => onPreview(value)}
        style={{ background: 'transparent', border: `1px solid ${tokens.accent}`, borderRadius: 3, padding: '2px 8px', fontSize: 9.5, color: tokens.accent, cursor: 'pointer', letterSpacing: '0.05em', opacity: 0.8 }}
      >
        preview
      </button>
    </div>
  );
}

function PreviewModal({ value, onClose, tokens }: {
  value: SpecialValue;
  onClose: () => void;
  tokens: TokenSet;
}) {
  const renderTable = (columns: string[], rows: Record<string, unknown>[]) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11.5, fontFamily: 'var(--vscode-editor-font-family)', width: '100%' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col} style={{ padding: '6px 12px', background: tokens.bgAlt, borderBottom: `1px solid ${tokens.border}`, color: tokens.textSecondary, fontWeight: 600, letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? tokens.bg : tokens.bgAlt }}>
              {columns.map(col => (
                <td key={col} style={{ padding: '5px 12px', borderBottom: `1px solid ${tokens.border}`, color: tokens.textPrimary, whiteSpace: 'nowrap' }}>{JSON.stringify(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderContent = () => {
    if (value.__type === 'dataframe') {
      const df = value as DataFrameValue;
      if (df.too_wide) return <p style={{ color: tokens.textSecondary, fontSize: 11.5 }}>Too many columns ({df.cols}) — open in notebook for full view.</p>;
      return <>
        {renderTable(df.columns, df.preview)}
        {df.rows > 10 && <p style={{ color: tokens.textDimmed, fontSize: 9.5, marginTop: 8 }}>showing 10 of {df.rows} rows</p>}
      </>;
    }
    if (value.__type === 'series') {
      const s = value as SeriesValue;
      return <>
        {renderTable([s.name ?? 'value'], s.preview.map(v => ({ [s.name ?? 'value']: v })))}
        {s.length > 10 && <p style={{ color: tokens.textDimmed, fontSize: 9.5, marginTop: 8 }}>showing 10 of {s.length} items</p>}
      </>;
    }
    if (value.__type === 'ndarray') {
      const a = value as NdarrayValue;
      if (a.too_wide) return <p style={{ color: tokens.textSecondary, fontSize: 11.5 }}>Too many columns — open in notebook.</p>;
      if (a.shape.length === 1) return renderTable(['value'], (a.preview as unknown[]).map(v => ({ value: v })));
      const cols = Array.from({ length: a.shape[1] }, (_, i) => `col_${i}`);
      const rows = (a.preview as unknown[][]).map(row => Object.fromEntries(row.map((v, i) => [`col_${i}`, v])));
      return <>
        {renderTable(cols, rows)}
        {a.shape[0] > 10 && <p style={{ color: tokens.textDimmed, fontSize: 9.5, marginTop: 8 }}>showing 10 of {a.shape[0]} rows</p>}
      </>;
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: tokens.bg, border: `1px solid ${tokens.border}`, borderRadius: 6, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${tokens.border}`, background: tokens.bgAlt }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: tokens.textPrimary, letterSpacing: '0.05em' }}>
            {value.__type === 'dataframe' ? `DataFrame  ${(value as DataFrameValue).rows} × ${(value as DataFrameValue).cols}`
              : value.__type === 'series' ? `Series  ${(value as SeriesValue).length} items`
              : `ndarray  [${(value as NdarrayValue).shape.join(' × ')}]`}
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: tokens.textSecondary, fontSize: 12, padding: '0 4px' }}>✕</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', overflowX: 'auto' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}