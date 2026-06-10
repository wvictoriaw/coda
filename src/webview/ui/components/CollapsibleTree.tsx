import * as React from 'react';
import { useState } from 'react';
import { TokenSet } from './tokens';

interface Props {
    data: unknown;
    label?: string;
    depth?: number;
    tokens: TokenSet;
    defaultOpen?: boolean;
}

export function CollapsibleTree({ data, label, depth = 0, tokens, defaultOpen = true }: Props) {
    const [open, setOpen] = useState(defaultOpen);
    const indent = depth * 14;
    
    const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
    const isArray = Array.isArray(data);
    const isExpandable = isObject || isArray;
    
    const preview = () => {
        if (isArray) return `[${(data as unknown[]).length}]`;
        if (isObject) return `{${Object.keys(data as object).length}}`;
        return null;
    };
    
    const renderScalar = (value: unknown) => {
        if (value === null) return <span style={{ color: tokens.textDimmed }}>null</span>;
        if (value === undefined) return <span style={{ color: tokens.textDimmed }}>undefined</span>;
        if (typeof value === 'boolean') return <span style={{ color: tokens.accent }}>{String(value)}</span>;
        if (typeof value === 'number') return <span style={{ color: tokens.accent }}>{String(value)}</span>;
        if (typeof value === 'string') return <span style={{ color: tokens.textSecondary }}>"{value}"</span>;
        return <span style={{ color: tokens.textPrimary }}>{String(value)}</span>;
    };
    
    if (!isExpandable) {
        return (
            <div style={{ paddingLeft: indent, paddingTop: 3, paddingBottom: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
            {label && <span style={{ fontSize: 11.5, color: tokens.textDimmed, minWidth: 80 }}>{label}</span>}
            <span style={{ fontSize: 11.5, fontFamily: 'var(--vscode-editor-font-family)' }}>
            {renderScalar(data)}
            </span>
            </div>
        );
    }
    
    const entries = isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as object);
    
    return (
        <div style={{ paddingLeft: indent }}>
        <div
        onClick={() => setOpen(o => !o)}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            paddingTop: 3,
            paddingBottom: 3,
            userSelect: 'none',
        }}
        >
        <span style={{ fontSize: 9, color: tokens.textDimmed, width: 10 }}>
        {open ? '▾' : '▸'}
        </span>
        {label && (
            <span style={{ fontSize: 11.5, color: tokens.textDimmed, minWidth: 80 }}>{label}</span>
        )}
        {!open && (
            <span style={{ fontSize: 11, color: tokens.textDimmed, opacity: 0.6 }}>
            {preview()}
            </span>
        )}
        </div>
        
        {open && (
            <div>
            {entries.map(([k, v]) => (
                <CollapsibleTree
                key={k}
                data={v}
                label={k}
                depth={depth + 1}
                tokens={tokens}
                defaultOpen={false}
                />
            ))}
            </div>
        )}
        </div>
    );
}