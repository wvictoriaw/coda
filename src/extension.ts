import * as vscode from 'vscode';
import { CodaPanel } from './webview/panel';
import { PythonRunner } from './python/runner';
import { NodeRunner } from './node/runner';
import { LLMClient } from './llm/client';
import { StateManager } from './state/manager';

export function activate(context: vscode.ExtensionContext) {
  console.log('Coda is active');

  const state = new StateManager(context);
  const llm = new LLMClient();
  const runner = new PythonRunner(context);
  const nodeRunner = new NodeRunner(context);

  // Restore saved Python environment
  const { pythonPath, hasSelectedEnv } = state.getEnvironment();
  if (hasSelectedEnv && pythonPath) {
    runner.setPythonPath(pythonPath);
  }

  // Language detection — switch panel mode based on active file
  const sendLanguageMode = (editor: vscode.TextEditor | undefined) => {
    if (!editor) return;
    const lang = editor.document.languageId;
    if (lang === 'python') {
      CodaPanel.instance?.postMessage({ type: 'languageMode', mode: 'python' });
    } else if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(lang)) {
      CodaPanel.instance?.postMessage({ type: 'languageMode', mode: 'node' });
    }
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      sendLanguageMode(editor);
    })
  );

  // Open panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('coda.openPanel', () => {
      CodaPanel.createOrShow(context.extensionUri, state, llm, runner, nodeRunner);
      // Send current language mode immediately after panel opens
      sendLanguageMode(vscode.window.activeTextEditor);
    })
  );

  // Debug snippet command
  context.subscriptions.push(
    vscode.commands.registerCommand('coda.debugSnippet', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const langId = editor.document.languageId;
      const selection = editor.selection;
      const snippet = editor.document.getText(selection);
      const fileContent = editor.document.getText();

      if (!snippet) {
        vscode.window.showInformationMessage('Coda: Please select a snippet to debug.');
        return;
      }

      if (langId === 'python') {
        CodaPanel.createOrShow(context.extensionUri, state, llm, runner, nodeRunner);
        CodaPanel.instance?.loadSnippet(snippet, selection.start.line, fileContent);

      } else if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(langId)) {
        CodaPanel.createOrShow(context.extensionUri, state, llm, runner, nodeRunner);
        // Node snippet debug — placeholder until sandbox is built
        CodaPanel.instance?.postMessage({ type: 'languageMode', mode: 'node' });

      } else {
        vscode.window.showWarningMessage(`Coda: Language '${langId}' is not supported yet.`);
      }
    })
  );

  // Generate command — placeholder
  context.subscriptions.push(
    vscode.commands.registerCommand('coda.generateHere', () => {
      vscode.window.showInformationMessage('Generation coming soon');
    })
  );
}

export function deactivate() {}