import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { TokenSet } from './tokens';
import { LogFeed, LogEntry } from './LogFeed';
import { CollapsibleTree } from './CollapsibleTree';

interface Props {
    port: number;
    vscode: ReturnType<typeof acquireVsCodeApi>;
    tokens: TokenSet;
    onEditPort: () => void;
}

let logCounter = 0;

export function NodeDebugPanel({ port, vscode, tokens, onEditPort }: Props) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [componentState, setComponentState] = useState<Record<string, unknown> | null>(null);
    const [componentProps, setComponentProps] = useState<Record<string, unknown> | null>(null);
    const [editingPort, setEditingPort] = useState(false);
    const [portInput, setPortInput] = useState(String(port));
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            
            if (msg.type === 'appendLog') {
                const text = Array.isArray(msg.args)
                ? msg.args.map((a: unknown) => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
                : String(msg.args);
                
                setLogs(prev => [...prev, {
                    id: logCounter++,
                    source: msg.source,
                    level: msg.level ?? 'log',
                    text,
                    timestamp: msg.timestamp ?? Date.now(),
                }]);
            }
            
            if (msg.type === 'clearLogs') {
                setLogs([]);
            }
            
            if (msg.type === 'updateState') {
                setComponentState(msg.state ?? null);
                setComponentProps(msg.props ?? null);
            }
        };
        
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);
    
    // Forward messages from the iframe to the extension
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source === iframeRef.current?.contentWindow) {
                if (event.data?.type === 'coda:log') {
                    vscode.postMessage({
                        type: 'componentLog',
                        level: event.data.level,
                        args: event.data.args,
                    });
                }
                if (event.data?.type === 'coda:state') {
                    vscode.postMessage({
                        type: 'componentState',
                        state: event.data.state,
                        props: event.data.props,
                    });
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);
    
    const handlePortConfirm = () => {
        const parsed = parseInt(portInput, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 65535) return;
        vscode.postMessage({ type: 'setNodePort', port: parsed });
        setEditingPort(false);
        onEditPort();
        if (iframeRef.current) {
            iframeRef.current.src = `http://localhost:${parsed}`;
        }
    };
    
    const handleOpenInBrowser = () => {
        vscode.postMessage({ type: 'openInBrowser', port });
    };
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflowY: 'auto',
            background: tokens.bg,
        }}>
        
        {/* Port bar */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderBottom: `1px solid ${tokens.border}`,
            background: tokens.bgAlt,
            flexShrink: 0,
        }}>
        {editingPort ? (
            <>
            <input
            value={portInput}
            onChange={e => setPortInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePortConfirm()}
            style={{
                background: tokens.bgInput,
                border: `1px solid ${tokens.border}`,
                borderRadius: 3,
                padding: '3px 8px',
                fontSize: 11.5,
                color: tokens.textPrimary,
                fontFamily: 'var(--vscode-editor-font-family)',
                outline: 'none',
                width: 80,
            }}
            autoFocus
            type="number"
            />
            <button
            onClick={handlePortConfirm}
            style={{
                background: tokens.accent,
                color: tokens.accentText,
                border: 'none',
                borderRadius: 3,
                padding: '3px 10px',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'var(--vscode-editor-font-family)',
            }}
            >
            go
            </button>
            <button
            onClick={() => setEditingPort(false)}
            style={{
                background: 'transparent',
                color: tokens.textDimmed,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--vscode-editor-font-family)',
            }}
            >
            cancel
            </button>
            </>
        ) : (
            <>
            <span style={{
                fontSize: 11.5,
                color: tokens.textSecondary,
                fontFamily: 'var(--vscode-editor-font-family)',
            }}>
            localhost:{port}
            </span>
            <button
            onClick={() => { setPortInput(String(port)); setEditingPort(true); }}
            style={{
                background: 'transparent',
                border: `1px solid ${tokens.border}`,
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 9.5,
                color: tokens.textDimmed,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                fontFamily: 'var(--vscode-editor-font-family)',
            }}
            >
            edit
            </button>
            <div style={{ flex: 1 }} />
            <button
            onClick={() => {
                if (iframeRef.current) {
                    iframeRef.current.src = iframeRef.current.src;
                }
            }}
            style={{
                background: 'transparent',
                border: `1px solid ${tokens.border}`,
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 9.5,
                color: tokens.textDimmed,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                fontFamily: 'var(--vscode-editor-font-family)',
            }}
            >
            refresh
            </button>
            <button
            onClick={handleOpenInBrowser}
            style={{
                background: 'transparent',
                border: `1px solid ${tokens.border}`,
                borderRadius: 3,
                padding: '2px 8px',
                fontSize: 9.5,
                color: tokens.textDimmed,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                fontFamily: 'var(--vscode-editor-font-family)',
            }}
            >
            open in browser
            </button>
            </>
        )}
        </div>
        
        {/* iframe */}
        <div style={{ padding: '16px 20px', flexShrink: 0 }}>
        <iframe
        ref={iframeRef}
        src={`http://localhost:${port}`}
        style={{
            width: '100%',
            height: 360,
            border: `1px solid ${tokens.border}`,
            borderRadius: 4,
            background: '#fff',
        }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        />
        </div>
        
        {/* Logs */}
        <div style={{ padding: '0 20px 16px 20px', flexShrink: 0 }}>
        <LogFeed
        logs={logs}
        onClear={() => setLogs([])}
        tokens={tokens}
        />
        </div>
        
        {/* State */}
        {(componentState || componentProps) && (
            <div style={{ padding: '0 20px 24px 20px' }}>
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
            STATE
            </span>
            <div style={{ flex: 1, height: 1, background: tokens.sectionLine, opacity: 0.3 }} />
            </div>
            
            {componentState && (
                <CollapsibleTree
                data={componentState}
                tokens={tokens}
                defaultOpen={true}
                />
            )}
            
            {componentProps && (
                <div style={{ marginTop: 12 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 8,
                    gap: 10,
                }}>
                <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: tokens.sectionLine,
                    whiteSpace: 'nowrap',
                }}>
                PROPS
                </span>
                <div style={{ flex: 1, height: 1, background: tokens.sectionLine, opacity: 0.3 }} />
                </div>
                <CollapsibleTree
                data={componentProps}
                tokens={tokens}
                defaultOpen={true}
                />
                </div>
            )}
            </div>
        )}
        </div>
    );
}