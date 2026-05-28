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

export function DebugPanel({ snippet, startLine, externalVars, vscode, snippetContext }: Props) {
    const [editedSnippet, setEditedSnippet] = useState(snippet);
    const [varValues, setVarValues] = useState<Record<string, string>>(
        Object.fromEntries(externalVars.map(v => [v, '']))
    );
    const [result, setResult] = useState<RunResult | null>(null);
    const [running, setRunning] = useState(false);
    const [contextOpen, setContextOpen] = useState(false);
    
    React.useEffect(() => {
        setEditedSnippet(snippet);
        setVarValues(Object.fromEntries(externalVars.map(v => [v, ''])));
        setResult(null);
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
        
        {snippetContext && (
            <div style={styles.contextSection}>
            <div
            style={styles.contextHeader}
            onClick={() => setContextOpen(o => !o)}
            >
            <span style={styles.sectionLabel}>CONTEXT</span>
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
        
        {/* Output vars */}
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
                    <span style={styles.varValue}>{JSON.stringify(v)}</span>
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