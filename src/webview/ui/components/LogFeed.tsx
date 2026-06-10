import * as React from 'react';
import { TokenSet } from './tokens';

export interface LogEntry {
    id: number;
    source: 'py' | 'js';
    level: 'log' | 'warn' | 'error';
    text: string;
    timestamp: number;
}

interface Props {
    logs: LogEntry[];
    onClear: () => void;
    tokens: TokenSet;
}

export function LogFeed({ logs, onClear, tokens }: Props) {
    
    
    const levelColour = (level: string) => {
        if (level === 'error') return tokens.error;
        if (level === 'warn') return '#b08040';
        return tokens.textPrimary;
    };
    
    const sourceColour = (source: string) => {
        return source === 'py' ? tokens.accent : tokens.textSecondary;
    };
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 10,
            gap: 10,
        }}>
        <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: tokens.sectionLine,
            whiteSpace: 'nowrap',
        }}>
        LOGS
        </span>
        <div style={{ flex: 1, height: 1, background: tokens.sectionLine, opacity: 0.3 }} />
        <button
        onClick={onClear}
        style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 9.5,
            color: tokens.textDimmed,
            letterSpacing: '0.08em',
            padding: 0,
        }}
        >
        clear
        </button>
        </div>
        
        {/* Log entries */}
        <div style={{
            height: 160,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
        }}>
        {logs.length === 0 && (
            <span style={{ fontSize: 11, color: tokens.textDimmed, fontStyle: 'italic' }}>
            no logs yet
            </span>
        )}
        {logs.map(entry => (
            <div
            key={entry.id}
            style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontFamily: 'var(--vscode-editor-font-family)',
                fontSize: 11.5,
            }}
            >
            <span style={{
                fontSize: 9,
                color: sourceColour(entry.source),
                letterSpacing: '0.05em',
                fontWeight: 600,
                marginTop: 2,
                flexShrink: 0,
            }}>
            [{entry.source}]
            </span>
            <span style={{
                color: levelColour(entry.level),
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
            }}>
            {entry.level === 'error' ? '✕ ' : '› '}{entry.text}
            </span>
            </div>
        ))}
        </div>
        </div>
    );
}