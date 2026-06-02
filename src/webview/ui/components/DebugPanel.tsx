import * as React from 'react';
import { useState } from 'react';
import { RunResult } from './types';


const tokens = {
    bg: '#f5f2ee',
    bgPanel: '#eeebe6',
    bgCode: '#eee9e3',
    border: '#ddd9d3',
    textPrimary: '#2c2825',
    textSecondary: '#8c8480',
    textDimmed: '#b8b4af',
    accent: '#8b5e3c',
    error: '#a63d2f',
    print: '#5a7a5a',
};

interface Props {
    snippet: string;
    startLine: number;
    externalVars: string[];
    vscode: ReturnType<typeof acquireVsCodeApi>;
    snippetContext: string;
}

import { isSpecialValue, SpecialValue, DataFrameValue, SeriesValue, NdarrayValue } from './types';

function SpecialValueCell({ value, onPreview }: {
    value: SpecialValue;
    onPreview: (value: SpecialValue) => void;
}) {
    const descriptor = () => {
        if (value.__type === 'dataframe') {
            return `DataFrame  ${value.rows} rows × ${value.cols} cols`;
        }
        if (value.__type === 'series') {
            return `Series  ${value.length} items  ${value.dtype}`;
        }
        if (value.__type === 'ndarray') {
            return `ndarray  [${value.shape.join(' × ')}]  ${value.dtype}`;
        }
        return 'unknown';
    };
    
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
            fontSize: 11,
            fontFamily: 'var(--vscode-editor-font-family)',
            color: tokens.accent,
        }}>
        {descriptor()}
        </span>
        <button
        onClick={() => onPreview(value)}
        style={{
            background: 'transparent',
            border: `1px solid ${tokens.border}`,
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 9,
            color: tokens.textSecondary,
            cursor: 'pointer',
            letterSpacing: '0.05em',
        }}
        >
        preview
        </button>
        </div>
    );
}

function PreviewModal({ value, onClose }: {
    value: SpecialValue;
    onClose: () => void;
}) {
    const renderTable = (columns: string[], rows: Record<string, unknown>[]) => (
        <div style={{ overflowX: 'auto' }}>
        <table style={modalStyles.table}>
        <thead>
        <tr>
        {columns.map(col => (
            <th key={col} style={modalStyles.th}>{col}</th>
        ))}
        </tr>
        </thead>
        <tbody>
        {rows.map((row, i) => (
            <tr key={i}>
            {columns.map(col => (
                <td key={col} style={modalStyles.td}>
                {JSON.stringify(row[col])}
                </td>
            ))}
            </tr>
        ))}
        </tbody>
        </table>
        </div>
    );
    
    const renderContent = () => {
        if (value.__type === 'dataframe') {
            if (value.too_wide) {
                return (
                    <p style={{ color: tokens.textSecondary, fontSize: 11 }}>
                    Too many columns to preview ({value.cols} cols) — open in notebook for full view.
                    </p>
                );
            }
            return (
                <>
                {renderTable(value.columns, value.preview)}
                {value.rows > 10 && (
                    <p style={{ color: tokens.textDimmed, fontSize: 9, marginTop: 8 }}>
                    showing 10 of {value.rows} rows
                    </p>
                )}
                </>
            );
        }
        
        if (value.__type === 'series') {
            return (
                <>
                {renderTable(
                    [value.name ?? 'value'],
                    value.preview.map(v => ({ [value.name ?? 'value']: v }))
                )}
                {value.length > 10 && (
                    <p style={{ color: tokens.textDimmed, fontSize: 9, marginTop: 8 }}>
                    showing 10 of {value.length} items
                    </p>
                )}
                </>
            );
        }
        
        if (value.__type === 'ndarray') {
            if (value.too_wide) {
                return (
                    <p style={{ color: tokens.textSecondary, fontSize: 11 }}>
                    Too many columns to preview — open in notebook for full view.
                    </p>
                );
            }
            if (value.shape.length === 1) {
                return renderTable(
                    ['value'],
                    (value.preview as unknown[]).map(v => ({ value: v }))
                );
            }
            // 2D array
            const cols = Array.from(
                { length: value.shape[1] },
                (_, i) => `col_${i}`
            );
            const rows = (value.preview as unknown[][]).map(row =>
                Object.fromEntries(row.map((v, i) => [`col_${i}`, v]))
            );
            return (
                <>
                {renderTable(cols, rows)}
                {value.shape[0] > 10 && (
                    <p style={{ color: tokens.textDimmed, fontSize: 9, marginTop: 8 }}>
                    showing 10 of {value.shape[0]} rows
                    </p>
                )}
                </>
            );
        }
    };
    
    return (
        <div style={modalStyles.overlay} onClick={onClose}>
        <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
        <span style={modalStyles.title}>
        {value.__type === 'dataframe'
            ? `DataFrame  ${(value as DataFrameValue).rows} × ${(value as DataFrameValue).cols}`
            : value.__type === 'series'
            ? `Series  ${(value as SeriesValue).length} items`
            : `ndarray  [${(value as NdarrayValue).shape.join(' × ')}]`
        }
        </span>
        <button onClick={onClose} style={modalStyles.closeButton}>✕</button>
        </div>
        <div style={modalStyles.body}>
        {renderContent()}
        </div>
        </div>
        </div>
    );
}

const modalStyles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 6,
        width: '90%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: `1px solid ${tokens.border}`,
    },
    title: {
        fontSize: 11,
        fontWeight: 600,
        color: tokens.textPrimary,
        fontFamily: 'var(--vscode-editor-font-family)',
        letterSpacing: '0.05em',
    },
    closeButton: {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: tokens.textSecondary,
        fontSize: 12,
        padding: '0 4px',
    },
    body: {
        padding: 16,
        overflowY: 'auto',
        overflowX: 'auto',
    },
    table: {
        borderCollapse: 'collapse',
        fontSize: 11,
        fontFamily: 'var(--vscode-editor-font-family)',
        width: '100%',
    },
    th: {
        padding: '6px 12px',
        background: tokens.bgPanel,
        borderBottom: `1px solid ${tokens.border}`,
        color: tokens.textSecondary,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textAlign: 'left',
        whiteSpace: 'nowrap',
    },
    td: {
        padding: '5px 12px',
        borderBottom: `1px solid ${tokens.border}`,
        color: tokens.textPrimary,
        whiteSpace: 'nowrap',
    },
};

export function DebugPanel({ snippet, startLine, externalVars, snippetContext, vscode }: Props) {
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
        // Validate inputs
        const empty = externalVars.filter(v => !varValues[v]?.trim());
        if (empty.length > 0) {
            setInputError(`fill in all inputs before running`);
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
            <div style={styles.empty}>
            <span style={styles.emptyLabel}>select a python snippet</span>
            <code style={styles.emptyCode}>⌘ shift D</code>
            </div>
        );
    }
    
    return (
        <div style={styles.container}>
        {previewValue && (
            <PreviewModal value={previewValue} onClose={() => setPreviewValue(null)} />
        )}
        
        {/* Context */}
        {snippetContext && (
            <div style={styles.contextSection}>
            <div style={styles.contextHeader} onClick={() => setContextOpen(o => !o)}>
            <span style={sectionStyles.label}>CONTEXT</span>
            <span style={styles.contextToggle}>{contextOpen ? '▲' : '▼'}</span>
            </div>
            {contextOpen && (
                <pre style={styles.contextCode}>{snippetContext}</pre>
            )}
            </div>
        )}
        
        {/* Inputs */}
        {externalVars.length > 0 && (
            <Section label="INPUTS">
            <div style={styles.table}>
            {externalVars.map(v => (
                <div key={v} style={styles.tableRow}>
                <span style={styles.varName}>{v}</span>
                <textarea
                style={styles.varInput}
                value={varValues[v] ?? ''}
                onChange={e => setVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                placeholder="value or JSON"
                spellCheck={false}
                rows={1}
                />
                </div>
            ))}
            </div>
            </Section>
        )}
        
        {/* Snippet */}
        <Section label="SNIPPET" hint={`line ${startLine + 1}`}>
        <textarea
        style={{
            ...styles.codeEditor,
            height: `${(editedSnippet.split('\n').length + 1) * 20}px`,
        }}
        value={editedSnippet}
        onChange={e => setEditedSnippet(e.target.value)}
        spellCheck={false}
        />
        </Section>
        
        {/* Run */}
        <div style={styles.runRow}>
        <button
        style={{ ...styles.runButton, opacity: running ? 0.5 : 1 }}
        onClick={handleRun}
        disabled={running}
        >
        {running ? 'running...' : 'run'}
        </button>
        </div>
        
        {/* Input error */}
        {inputError && (
            <p style={styles.inputError}>{inputError}</p>
        )}
        
        {/* Prints */}
        {result && result.prints && result.prints.length > 0 && (
            <Section label="PRINTS">
            <div style={styles.prints}>
            {result.prints.map((line, i) => (
                <div key={i} style={styles.printLine}>
                <span style={styles.printPrefix}>›</span>
                <span style={styles.printText}>{line}</span>
                </div>
            ))}
            </div>
            </Section>
        )}
        
        {/* Output */}
        {result && (
            <Section label="OUTPUT">
            {!result.success && (
                <pre style={styles.error}>{result.error}</pre>
            )}
            {result.success && result.final_vars && (
                <div style={styles.table}>
                {Object.entries(result.final_vars).map(([k, v]) => (
                    <div key={k} style={styles.tableRow}>
                    <span style={styles.varName}>{k}</span>
                    {isSpecialValue(v)
                        ? <SpecialValueCell value={v} onPreview={setPreviewValue} />
                        : <span style={styles.varValue}>{JSON.stringify(v)}</span>
                    }
                    </div>
                ))}
                </div>
            )}
            </Section>
        )}
        </div>
    );
}

function Section({ label, hint, children }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div style={sectionStyles.container}>
        <div style={sectionStyles.header}>
        <span style={sectionStyles.label}>{label}</span>
        {hint && <span style={sectionStyles.hint}>{hint}</span>}
        </div>
        <div style={sectionStyles.body}>{children}</div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: 24,
        gap: 28,
        boxSizing: 'border-box',
    },
    empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 10,
    },
    emptyLabel: {
        fontSize: 11,
        color: tokens.textDimmed,
        letterSpacing: '0.05em',
    },
    emptyCode: {
        fontSize: 11,
        color: tokens.textSecondary,
        background: tokens.bgPanel,
        padding: '3px 8px',
        borderRadius: 3,
        border: `1px solid ${tokens.border}`,
    },
    table: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    tableRow: {
        display: 'grid',
        gridTemplateColumns: '100px 180px',
        alignItems: 'start',
        gap: 12,
        padding: '8px 0',
        borderBottom: `1px solid ${tokens.border}`,
    },
    varName: {
        fontSize: 11,
        color: tokens.textSecondary,
        fontFamily: 'var(--vscode-editor-font-family)',
        paddingTop: 4,
    },
    varInput: {
        background: tokens.bgPanel,
        color: tokens.textPrimary,
        border: `1px solid ${tokens.border}`,
        borderRadius: 3,
        padding: '4px 8px',
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 11,
        width: 180,
        boxSizing: 'border-box',
        outline: 'none',
        resize: 'none',
        lineHeight: 1.5,
        overflowY: 'hidden',
        wordBreak: 'break-all',
        whiteSpace: 'pre-wrap',
    },
    varValue: {
        fontSize: 11,
        fontFamily: 'var(--vscode-editor-font-family)',
        color: tokens.accent,
        wordBreak: 'break-all',
        whiteSpace: 'pre-wrap',
        width: 180,
    },
    codeEditor: {
        width: '100%',
        background: tokens.bgCode,
        color: tokens.textPrimary,
        border: `1px solid ${tokens.border}`,
        borderRadius: 4,
        padding: 12,
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 12,
        resize: 'none',
        boxSizing: 'border-box',
        lineHeight: '20px',
        outline: 'none',
    },
    runRow: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    runButton: {
        background: 'transparent',
        color: tokens.accent,
        border: `1px solid ${tokens.accent}`,
        borderRadius: 3,
        padding: '6px 20px',
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 11,
        cursor: 'pointer',
        letterSpacing: '0.08em',
        transition: 'opacity 0.1s',
    },
    error: {
        color: tokens.error,
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 11,
        margin: 0,
        whiteSpace: 'pre-wrap',
    },
    prints: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        background: tokens.bgPanel,
        borderRadius: 4,
        border: `1px solid ${tokens.border}`,
    },
    printLine: {
        display: 'flex',
        gap: 10,
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 11,
    },
    printPrefix: {
        color: tokens.print,
        flexShrink: 0,
    },
    printText: {
        color: tokens.textPrimary,
        wordBreak: 'break-all',
        whiteSpace: 'pre-wrap',
    },
    contextSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    contextHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        userSelect: 'none' as const,
    },
    contextToggle: {
        fontSize: 9,
        color: tokens.textDimmed,
    },
    contextCode: {
        margin: 0,
        padding: '10px 12px',
        background: tokens.bgCode,
        border: `1px solid ${tokens.border}`,
        borderRadius: 4,
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 11,
        color: tokens.textSecondary,
        whiteSpace: 'pre-wrap' as const,
        wordBreak: 'break-all' as const,
    },
    inputError: {
        margin: 0,
        fontSize: 11,
        color: tokens.error,
        textAlign: 'right' as const,
    },
};

const sectionStyles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    label: {
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: tokens.textSecondary,
    },
    hint: {
        fontSize: 9,
        color: tokens.textDimmed,
        letterSpacing: '0.05em',
    },
    body: {
        display: 'flex',
        flexDirection: 'column',
    },
    
};