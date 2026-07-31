import * as React from 'react';
import { useState, useEffect } from 'react';
import { TokenSet } from './tokens';

interface Env {
  name: string;
  path: string;
  type: string;
}

interface Props {
  currentPath: string | null;
  vscode: ReturnType<typeof acquireVsCodeApi>;
  tokens: TokenSet;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark' | null) => void;
}

// Section defined outside to prevent remount on every keystroke
function Section({ label, children, tokens }: {
  label: string;
  children: React.ReactNode;
  tokens: TokenSet;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: tokens.textSecondary,
    }}>
    {label}
    </span>
    {children}
    </div>
  );
}

export function SettingsPanel({ currentPath, vscode, tokens, theme, onThemeChange }: Props) {
  const [envs, setEnvs] = useState<Env[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentPath);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [folderPath, setFolderPath] = useState('');
  const [folderStatus, setFolderStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  
  useEffect(() => {
    setSelected(currentPath);
  }, [currentPath]);
  
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'environmentsDetected') {
        setEnvs(msg.envs);
        setLoading(false);
      }
      if (msg.type === 'folderDetectResult') {
        setFolderLoading(false);
        if (msg.error || !msg.result) {
          setFolderStatus({ ok: false, message: msg.error ?? 'no python environment found in that folder' });
        } else if (msg.result.type === 'conda_base') {
          setEnvs(prev => [...prev, ...msg.result.envs]);
          setFolderStatus({ ok: true, message: `found ${msg.result.envs.length} environments` });
        } else {
          setEnvs(prev => [...prev, msg.result]);
          setSelected(msg.result.path);
          vscode.postMessage({ type: 'selectEnvironment', pythonPath: msg.result.path });
          setFolderStatus({ ok: true, message: `loaded: ${msg.result.name}` });
          setSaved(true);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
  
  const handleScan = () => {
    setLoading(true);
    setEnvs([]);
    setOpen(false);
    vscode.postMessage({ type: 'detectEnvironments' });
  };
  
  const handleSave = () => {
    if (!selected) return;
    vscode.postMessage({ type: 'selectEnvironment', pythonPath: selected });
    setSaved(true);
  };
  
  const handleLoad = () => {
    if (!folderPath.trim()) return;
    setFolderLoading(true);
    setFolderStatus(null);
    vscode.postMessage({ type: 'detectFromFolder', folderPath: folderPath.trim() });
  };
  
  const selectedEnv = envs.find(e => e.path === selected);
  
  const s: Record<string, React.CSSProperties> = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      gap: 28,
      height: '100%',
      boxSizing: 'border-box',
      overflowY: 'auto',
      background: tokens.bg,
    },
    currentEnv: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '10px 12px',
      background: tokens.bgAlt,
      borderRadius: 4,
      border: `1px solid ${tokens.border}`,
    },
    currentLabel: {
      fontSize: 9,
      color: tokens.accent,
      letterSpacing: '0.08em',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
    },
    currentPath: {
      fontSize: 11,
      color: tokens.textPrimary,
      fontFamily: 'var(--vscode-editor-font-family)',
      wordBreak: 'break-all' as const,
    },
    scanButton: {
      background: 'transparent',
      color: tokens.textSecondary,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      padding: '5px 14px',
      fontFamily: 'var(--vscode-editor-font-family)',
      fontSize: 11,
      cursor: 'pointer',
      letterSpacing: '0.08em',
      alignSelf: 'flex-start' as const,
    },
    folderRow: {
      display: 'flex',
      gap: 6,
    },
    folderInput: {
      flex: 1,
      background: tokens.bgInput,
      border: `1px solid ${tokens.border}`,
      borderRadius: 3,
      padding: '5px 8px',
      fontSize: 11,
      color: tokens.textPrimary,
      fontFamily: 'var(--vscode-editor-font-family)',
      outline: 'none',
    },
    folderButton: {
      background: 'transparent',
      border: `1px solid ${tokens.accent}`,
      borderRadius: 3,
      padding: '5px 14px',
      fontSize: 11,
      color: tokens.accent,
      fontFamily: 'var(--vscode-editor-font-family)',
      letterSpacing: '0.08em',
      flexShrink: 0,
    },
    dropdownTrigger: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      background: tokens.bgAlt,
      border: `1px solid ${tokens.border}`,
      borderRadius: 4,
      cursor: 'pointer',
      userSelect: 'none' as const,
    },
    dropdownList: {
      position: 'absolute' as const,
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 100,
      background: tokens.bgAlt,
      border: `1px solid ${tokens.border}`,
      borderRadius: 4,
      maxHeight: 240,
      overflowY: 'auto' as const,
      marginTop: 2,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    },
    dropdownItem: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 2,
      padding: '8px 12px',
      cursor: 'pointer',
      borderBottom: `1px solid ${tokens.border}`,
    },
    envName: {
      fontSize: 12,
      color: tokens.textPrimary,
      fontFamily: 'var(--vscode-editor-font-family)',
    },
    envMeta: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    },
    envType: {
      fontSize: 9,
      color: tokens.accent,
      letterSpacing: '0.08em',
      fontWeight: 600,
      textTransform: 'uppercase' as const,
    },
    envPath: {
      fontSize: 9,
      color: tokens.textDimmed,
      fontFamily: 'var(--vscode-editor-font-family)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    saveRow: {
      display: 'flex',
      justifyContent: 'flex-end',
    },
    saveButton: {
      background: 'transparent',
      color: tokens.accent,
      border: `1px solid ${tokens.accent}`,
      borderRadius: 3,
      padding: '5px 14px',
      fontFamily: 'var(--vscode-editor-font-family)',
      fontSize: 11,
      letterSpacing: '0.08em',
    },
  };
  
  return (
    <div style={s.container}>
    
    <Section label="PYTHON ENVIRONMENT" tokens={tokens}>
    
    {/* Current active */}
    <div style={s.currentEnv}>
    <span style={s.currentLabel}>active</span>
    <span style={s.currentPath}>{currentPath ?? 'none selected'}</span>
    </div>
    
    {/* Scan */}
    <button style={s.scanButton} onClick={handleScan}>
    {loading ? 'scanning...' : 'scan environments'}
    </button>
    
    {/* Dropdown — only when envs found */}
    {envs.length > 0 && (
      <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={s.dropdownTrigger}>
      <span style={{
        color: selectedEnv ? tokens.textPrimary : tokens.textDimmed,
        fontSize: 11,
        fontFamily: 'var(--vscode-editor-font-family)',
      }}>
      {selectedEnv ? selectedEnv.name : 'choose environment'}
      </span>
      <span style={{ color: tokens.textDimmed, fontSize: 10 }}>
      {open ? '▲' : '▼'}
      </span>
      </div>
      
      {open && (
        <div style={s.dropdownList}>
        {envs.map(env => (
          <div
          key={env.path}
          onClick={() => { setSelected(env.path); setOpen(false); setSaved(false); }}
          style={{
            ...s.dropdownItem,
            background: selected === env.path ? tokens.bgCode : 'transparent',
          }}
          >
          <div style={s.envName}>{env.name}</div>
          <div style={s.envMeta}>
          <span style={s.envType}>{env.type}</span>
          <span style={s.envPath}>{env.path}</span>
          </div>
          </div>
        ))}
        </div>
      )}
      </div>
    )}
    
    {/* Folder input — always visible */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={s.folderRow}>
    <input
    value={folderPath}
    onChange={e => setFolderPath(e.target.value)}
    placeholder="or enter environment folder path..."
    spellCheck={false}
    style={s.folderInput}
    onKeyDown={e => e.key === 'Enter' && !folderLoading && handleLoad()}
    />
    <button
    onClick={handleLoad}
    disabled={folderLoading || !folderPath.trim()}
    style={{
      ...s.folderButton,
      cursor: folderLoading || !folderPath.trim() ? 'not-allowed' : 'pointer',
      opacity: folderLoading || !folderPath.trim() ? 0.4 : 1,
    }}
    >
    {folderLoading ? '...' : 'load'}
    </button>
    </div>
    {folderStatus && (
      <span style={{
        fontSize: 10.5,
        color: folderStatus.ok ? '#5a7a5a' : tokens.error,
      }}>
      {folderStatus.ok ? '✓ ' : '✗ '}{folderStatus.message}
      </span>
    )}
    </div>
    
    {/* Save */}
    {selected && selected !== currentPath && (
      <div style={s.saveRow}>
      <button
      style={{
        ...s.saveButton,
        opacity: saved ? 0.4 : 1,
        cursor: saved ? 'not-allowed' : 'pointer',
      }}
      onClick={handleSave}
      disabled={saved}
      >
      {saved ? 'saved' : 'save'}
      </button>
      </div>
    )}
    
    </Section>
    
    <Section label="APPEARANCE" tokens={tokens}>
    <div style={{ display: 'flex', gap: 8 }}>
    {(['light', 'dark', null] as const).map(t => (
      <button
      key={String(t)}
      onClick={() => onThemeChange(t)}
      style={{
        background: theme === (t ?? 'auto') ? tokens.accent : 'transparent',
        color: theme === (t ?? 'auto') ? tokens.accentText : tokens.textSecondary,
        border: `1px solid ${theme === (t ?? 'auto') ? tokens.accent : tokens.border}`,
        borderRadius: 3,
        padding: '5px 14px',
        fontFamily: 'var(--vscode-editor-font-family)',
        fontSize: 11,
        cursor: 'pointer',
        letterSpacing: '0.08em',
      }}
      >
      {t === null ? 'auto' : t}
      </button>
    ))}
    </div>
    </Section>
    
    </div>
  );
}