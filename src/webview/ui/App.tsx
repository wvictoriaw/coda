import * as React from 'react';
import { useState, useEffect } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { ChatPanel } from './components/ChatPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { EnvGate } from './components/EnvGate';

type Tab = 'debug' | 'chat' | 'settings';

const vscode = acquireVsCodeApi();

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('debug');
  const [snippet, setSnippet] = useState<string>('');
  const [startLine, setStartLine] = useState<number>(0);
  const [externalVars, setExternalVars] = useState<string[]>([]);
  const [hasSelectedEnv, setHasSelectedEnv] = useState<boolean>(true);
  const [pythonPath, setPythonPath] = useState<string | null>(null);
  const [snippetContext, setSnippetContext] = useState<string>('');
  
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
        case 'envStatus':
        setHasSelectedEnv(msg.hasSelectedEnv);
        setPythonPath(msg.pythonPath);
        break;
      }
    };
    window.addEventListener('message', handler);
    
    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });
    
    return () => window.removeEventListener('message', handler);
  }, []);
  
  const handleEnvSelected = () => {
    setHasSelectedEnv(true);
  };
  
  return (
    <div style={styles.container}>
    {/* Left nav */}
    <div style={styles.nav}>
    <NavButton
    label="DEBUG"
    active={activeTab === 'debug'}
    onClick={() => setActiveTab('debug')}
    />
    <NavButton
    label="CHAT"
    active={activeTab === 'chat'}
    onClick={() => setActiveTab('chat')}
    />
    <div style={{ flex: 1 }} />
    <NavButton
    label="ENV"
    active={activeTab === 'settings'}
    onClick={() => setActiveTab('settings')}
    />
    </div>
    
    {/* Content */}
    <div style={styles.content}>
    {activeTab === 'debug' && (
      !hasSelectedEnv
      ? <EnvGate vscode={vscode} onEnvSelected={handleEnvSelected} />
      : <DebugPanel
      snippet={snippet}
      startLine={startLine}
      externalVars={externalVars}
      snippetContext={snippetContext}
      vscode={vscode}
      />
    )}
    {activeTab === 'chat' && <ChatPanel vscode={vscode} />}
    {activeTab === 'settings' && (
      <SettingsPanel currentPath={pythonPath} vscode={vscode} />
    )}
    </div>
    </div>
  );
}

function NavButton({ label, active, onClick }: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const tokens = {
    accent: '#8b5e3c',
    textSecondary: '#8c8480',
    border: '#ddd9d3',
  };
  
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
      color: active ? tokens.accent : tokens.textSecondary,
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

const tokens = {
  bg:      '#f5f2ee',
  bgPanel: '#eeebe6',
  border:  '#ddd9d3',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'var(--vscode-editor-font-family)',
    fontSize: 12,
    background: tokens.bg,
    color: '#2c2825',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 28,
    borderRight: `1px solid ${tokens.border}`,
    paddingTop: 16,
    paddingBottom: 16,
    flexShrink: 0,
    background: tokens.bgPanel,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};