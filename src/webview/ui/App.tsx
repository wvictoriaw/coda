import * as React from 'react';
import { useState, useEffect } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { EnvGate } from './components/EnvGate';
import { useTheme } from './components/useTheme';
import { getTokens, TokenSet } from './components/tokens';
import { NodeEntryGate } from './components/NodeEntryGate';
import { NodeDebugPanel } from './components/NodeDebugPanel';

type Tab = 'debug' | 'chat' | 'settings';

const vscode = acquireVsCodeApi();

export function App() {
  const detectedTheme = useTheme();
  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null);
  const theme = themeOverride ?? detectedTheme;
  const tokens = getTokens(theme);
  
  const [activeTab, setActiveTab] = useState<Tab>('debug');
  const [snippet, setSnippet] = useState<string>('');
  const [startLine, setStartLine] = useState<number>(0);
  const [externalVars, setExternalVars] = useState<string[]>([]);
  const [hasSelectedEnv, setHasSelectedEnv] = useState<boolean>(true);
  const [pythonPath, setPythonPath] = useState<string | null>(null);
  const [snippetContext, setSnippetContext] = useState<string>('');
  
  const [mode, setMode] = useState<'python' | 'node' | 'welcome'>('welcome');
  const [nodeStarted, setNodeStarted] = useState(false);
  const [nodePort, setNodePort] = useState(3000);
  // preserve each mode's view
  const [pythonLastSnippet, setPythonLastSnippet] = useState('');
  
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'loadSnippet':
        setSnippet(msg.snippet);
        setStartLine(msg.startLine);
        setExternalVars(msg.externalVars);
        setSnippetContext(msg.context ?? '');
        setActiveTab('debug');
        break;
        case 'languageMode':
        setMode(msg.mode);
        break;
        case 'envStatus':
        setHasSelectedEnv(msg.hasSelectedEnv);
        setPythonPath(msg.pythonPath);
        setNodePort(msg.nodePort ?? 3000);
        break;
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'var(--vscode-editor-font-family)',
      fontSize: 12.5,
      background: tokens.bg,
      color: tokens.textPrimary,
    }}>
    {/* Left nav */}
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: 28,
      borderRight: `1px solid ${tokens.border}`,
      paddingTop: 16,
      paddingBottom: 16,
      flexShrink: 0,
      background: tokens.bgCode, // distinctly different from main bg
    }}>
    <NavButton label="DEBUG" active={activeTab === 'debug'} tokens={tokens} onClick={() => setActiveTab('debug')} />
    <NavButton label="CHAT" active={activeTab === 'chat'} tokens={tokens} onClick={() => setActiveTab('chat')} />
    <div style={{ flex: 1 }} />
    <NavButton label="ENV" active={activeTab === 'settings'} tokens={tokens} onClick={() => setActiveTab('settings')} />
    </div>
    
    {/* Content */}
    
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    {/* Header */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px',
      borderBottom: `1px solid ${tokens.border}`,
      flexShrink: 0,
      background: tokens.bg,
    }}>
    <span style={{
      fontSize: 13.5,
      fontWeight: 700,
      letterSpacing: '0.18em',
      color: tokens.accent,
    }}>
    CODA
    </span>
    <span style={{
      fontSize: 10.5,
      color: tokens.textSecondary,
      letterSpacing: '0.05em',
    }}>
    {activeTab === 'debug' && snippet
      ? snippet.split('\n')[0].slice(0, 30) + (snippet.split('\n')[0].length > 30 ? '...' : '')
      : activeTab}
      </span>
      </div>
      {activeTab === 'debug' && (
        mode === 'welcome' ? (
          <WelcomePanel tokens={tokens} />
        ) : mode === 'python' ? (
          !hasSelectedEnv
          ? <EnvGate vscode={vscode} onEnvSelected={() => setHasSelectedEnv(true)} tokens={tokens} />
          : <DebugPanel
          snippet={snippet}
          startLine={startLine}
          externalVars={externalVars}
          snippetContext={snippetContext}
          vscode={vscode}
          tokens={tokens}
          />
        ) : (
          !nodeStarted
          ? <NodeEntryGate
          savedPort={nodePort}
          onStart={(p) => { setNodePort(p); setNodeStarted(true); }}
          tokens={tokens}
          />
          : <NodeDebugPanel
          port={nodePort}
          vscode={vscode}
          tokens={tokens}
          onEditPort={() => {}}
          />
        )
      )}
      {activeTab === 'chat' && <ChatPanel vscode={vscode} tokens={tokens} />}
      {activeTab === 'settings' && <SettingsPanel 
        currentPath={pythonPath} 
        vscode={vscode} 
        tokens={tokens}
        theme={theme}
        onThemeChange={setThemeOverride}
        />}
        </div>
        </div>
      );
    }
    
    function NavButton({ label, active, onClick, tokens }: {
      label: string;
      active: boolean;
      onClick: () => void;
      tokens: ReturnType<typeof getTokens>;
    }) {
      return (
        <button
        onClick={onClick}
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 72,
          border: 'none',
          borderLeft: active ? `2px solid ${tokens.accent}` : '2px solid transparent',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          color: tokens.accent,
          opacity: active ? 1 : 0.5,
        }}
        >
        <span style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          letterSpacing: '0.15em',
          fontSize: 9,
          fontWeight: 600,
        }}>
        {label}
        </span>
        </button>
      );
    }
    
    function WelcomePanel({ tokens }: { tokens: TokenSet }) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          padding: 24,
          boxSizing: 'border-box',
        }}>
        <span style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: tokens.accent,
        }}>
        CODA
        </span>
        <span style={{
          fontSize: 11.5,
          color: tokens.textDimmed,
          textAlign: 'center',
          lineHeight: 1.7,
          maxWidth: 220,
        }}>
        open a Python or TypeScript file to get started
        </span>
        </div>
      );
    }