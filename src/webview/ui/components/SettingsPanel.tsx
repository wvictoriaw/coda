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

export function SettingsPanel({ currentPath, vscode, tokens, theme, onThemeChange }: Props) {
  const [envs, setEnvs] = useState<Env[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentPath);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  
  
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
  
  const selectedEnv = envs.find(e => e.path === selected);
  
  function Section({ label, children }: { label: string; children: React.ReactNode }) {
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
  
  const styles: Record<string, React.CSSProperties> = {
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
      alignSelf: 'flex-start',
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
    <div style={styles.container}>
    
    <Section label="PYTHON ENVIRONMENT">
    
    {/* Current active */}
    <div style={styles.currentEnv}>
    <span style={styles.currentLabel}>active</span>
    <span style={styles.currentPath}>
    {currentPath ?? 'none selected'}
    </span>
    </div>
    
    {/* Scan button */}
    <button style={styles.scanButton} onClick={handleScan}>
    {loading ? 'scanning...' : 'scan environments'}
    </button>
    
    {/* Dropdown */}
    {envs.length > 0 && (
      <div style={{ position: 'relative' }}>
      <div
      onClick={() => setOpen(o => !o)}
      style={styles.dropdownTrigger}
      >
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
        <div style={styles.dropdownList}>
        {envs.map(env => (
          <div
          key={env.path}
          onClick={() => {
            setSelected(env.path);
            setOpen(false);
            setSaved(false);
          }}
          style={{
            ...styles.dropdownItem,
            background: selected === env.path
            ? tokens.bgCode
            : 'transparent',
          }}
          >
          <div style={styles.envName}>{env.name}</div>
          <div style={styles.envMeta}>
          <span style={styles.envType}>{env.type}</span>
          <span style={styles.envPath}>{env.path}</span>
          </div>
          </div>
        ))}
        </div>
      )}
      </div>
    )}
    
    {/* Save */}
    {selected && selected !== currentPath && (
      <div style={styles.saveRow}>
      <button
      style={{
        ...styles.saveButton,
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
    
    <Section label="APPEARANCE">
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
    
    </Section>
    </div>
  );
}

