import * as React from 'react';

interface Props {
    vscode: ReturnType<typeof acquireVsCodeApi>;
}

export function ChatPanel({ vscode }: Props) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            opacity: 0.4,
            fontFamily: 'var(--vscode-editor-font-family)',
            fontSize: 12,
        }}>
            Chat coming soon
        </div>
    );
}