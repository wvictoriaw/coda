import * as React from 'react';
import { useState } from 'react';
import { TokenSet } from './tokens';

interface Props {
    savedPort: number;
    onStart: (port: number) => void;
    tokens: TokenSet;
}

export function NodeEntryGate({ savedPort, onStart, tokens }: Props) {
    const [port, setPort] = useState(String(savedPort));
    const [error, setError] = useState<string | null>(null);
    
    const handleStart = () => {
        const parsed = parseInt(port, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
            setError('enter a valid port number (1–65535)');
            return;
        }
        setError(null);
        onStart(parsed);
    };
    
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: 24,
            boxSizing: 'border-box',
            background: tokens.bg,
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 320 }}>
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: tokens.textDimmed }}>
        NODE DEBUG
        </p>
        <p style={{ margin: 0, fontSize: 11.5, color: tokens.textSecondary, lineHeight: 1.6 }}>
        Enter the port your dev server is running on.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 9.5, color: tokens.textDimmed, letterSpacing: '0.08em' }}>
        PORT
        </label>
        <input
        style={{
            background: tokens.bgInput,
            border: `1px solid ${tokens.border}`,
            borderRadius: 3,
            padding: '6px 10px',
            fontSize: 13,
            color: tokens.textPrimary,
            fontFamily: 'var(--vscode-editor-font-family)',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
        }}
        value={port}
        onChange={e => {
            setPort(e.target.value);
            setError(null);
        }}
        onKeyDown={e => e.key === 'Enter' && handleStart()}
        placeholder="3000"
        type="number"
        />
        {error && (
            <span style={{ fontSize: 11, color: tokens.error }}>{error}</span>
        )}
        </div>
        
        <button
        onClick={handleStart}
        style={{
            background: tokens.accent,
            color: tokens.accentText,
            border: 'none',
            borderRadius: 4,
            padding: '8px 0',
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.1em',
            fontFamily: 'var(--vscode-editor-font-family)',
            width: '100%',
        }}
        >
        start debug
        </button>
        </div>
        </div>
    );
}