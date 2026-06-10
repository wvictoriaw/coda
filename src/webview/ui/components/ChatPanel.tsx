import * as React from 'react';
import { TokenSet } from './tokens';

interface Props {
  vscode: ReturnType<typeof acquireVsCodeApi>;
  tokens: TokenSet;
}

export function ChatPanel({ tokens }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4, fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12.5, color: tokens.textPrimary }}>
      chat coming soon
    </div>
  );
}