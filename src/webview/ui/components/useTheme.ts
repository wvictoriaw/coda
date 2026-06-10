import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme(): Theme {
  const getTheme = (): Theme => {
    const kind = document.body.getAttribute('data-vscode-theme-kind');
    return kind === 'vscode-dark' || kind === 'vscode-high-contrast' ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState<Theme>(getTheme());

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(getTheme());
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-vscode-theme-kind'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}