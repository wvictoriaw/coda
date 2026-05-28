import * as React from 'react';
import { useState, useEffect } from 'react';

const tokens = {
  bg:            '#f5f2ee',
  bgPanel:       '#eeebe6',
  bgCode:        '#eee9e3',
  border:        '#ddd9d3',
  textPrimary:   '#2c2825',
  textSecondary: '#8c8480',
  textDimmed:    '#b8b4af',
  accent:        '#8b5e3c',
  error:         '#a63d2f',
};

interface Env {
  name: string;
  path: string;
  type: string;
}

interface Props {
  vscode: ReturnType<typeof acquireVsCodeApi>;
  onEnvSelected: () => void;
}

export function EnvGate({ vscode, onEnvSelected }: Props) {
  const [envs, setEnvs] = useState<Env[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Env | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'environmentsDetected') {
        setEnvs(msg.envs);
        setLoading(false);
      }
      if (msg.type === 'environmentsError') {
        setError(msg.error);
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'detectEnvironments' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleConfirm = () => {
    if (!selected) return;
    vscode.postMessage({ type: 'selectEnvironment', pythonPath: selected.path });
    onEnvSelected();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        <p style={styles.label}>SELECT PYTHON ENVIRONMENT</p>
        <p style={styles.hint}>
          This workspace has no Python environment configured.
          Select one to enable debugging.
        </p>

        {/* Custom dropdown */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => !loading && setOpen(o => !o)}
            style={{
              ...styles.dropdownTrigger,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <span style={{
              color: selected ? tokens.textPrimary : tokens.textDimmed,
              fontSize: 11,
              fontFamily: 'var(--vscode-editor-font-family)',
            }}>
              {loading
                ? 'scanning...'
                : selected
                  ? selected.name
                  : 'choose environment'}
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
                  onClick={() => { setSelected(env); setOpen(false); }}
                  style={{
                    ...styles.dropdownItem,
                    background: selected?.path === env.path
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

        {selected && (
          <div style={styles.selectedPath}>
            <span style={styles.selectedPathLabel}>path</span>
            <span style={styles.selectedPathValue}>{selected.path}</span>
          </div>
        )}

        {error && <p style={styles.error}>failed to detect environments</p>}

        <div style={styles.actions}>
          <button
            style={styles.refreshButton}
            onClick={() => {
              setLoading(true);
              setEnvs([]);
              setSelected(null);
              vscode.postMessage({ type: 'detectEnvironments' });
            }}
          >
            refresh
          </button>
          <button
            style={{
              ...styles.confirmButton,
              opacity: selected ? 1 : 0.4,
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
            onClick={handleConfirm}
            disabled={!selected}
          >
            confirm
          </button>
        </div>

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 24,
    boxSizing: 'border-box',
    overflowY: 'auto',
    background: tokens.bg,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 380,
  },
  label: {
    margin: 0,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: tokens.textSecondary,
  },
  hint: {
    margin: 0,
    fontSize: 11,
    color: tokens.textDimmed,
    lineHeight: 1.7,
  },
  dropdownTrigger: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: tokens.bgPanel,
    border: `1px solid ${tokens.border}`,
    borderRadius: 4,
    userSelect: 'none',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    background: tokens.bgPanel,
    border: `1px solid ${tokens.border}`,
    borderRadius: 4,
    maxHeight: 240,
    overflowY: 'auto',
    marginTop: 2,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  dropdownItem: {
    display: 'flex',
    flexDirection: 'column',
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
  selectedPath: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 12px',
    background: tokens.bgCode,
    borderRadius: 4,
    border: `1px solid ${tokens.border}`,
  },
  selectedPathLabel: {
    fontSize: 9,
    color: tokens.accent,
    letterSpacing: '0.08em',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  selectedPathValue: {
    fontSize: 10,
    color: tokens.textSecondary,
    fontFamily: 'var(--vscode-editor-font-family)',
    wordBreak: 'break-all' as const,
  },
  error: {
    margin: 0,
    fontSize: 11,
    color: tokens.error,
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  refreshButton: {
    background: 'transparent',
    color: tokens.textSecondary,
    border: `1px solid ${tokens.border}`,
    borderRadius: 3,
    padding: '5px 14px',
    fontFamily: 'var(--vscode-editor-font-family)',
    fontSize: 11,
    cursor: 'pointer',
    letterSpacing: '0.08em',
  },
  confirmButton: {
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