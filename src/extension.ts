import * as vscode from 'vscode';
import { CodaPanel } from './webview/panel';
import { PythonRunner } from './python/runner';
import { NodeRunner } from './node/runner';
import { LLMClient } from './llm/client';
import { StateManager } from './state/manager';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  console.log('Coda is active');
  
  const state = new StateManager(context);
  const llm = new LLMClient();
  const runner = new PythonRunner(context);
  const nodeRunner = new NodeRunner(context);
  
  // Restore saved Python environment
  const { pythonPath, hasSelectedEnv } = state.getEnvironment();
  if (hasSelectedEnv && pythonPath) {
    if (fs.existsSync(pythonPath)) {
      runner.setPythonPath(pythonPath);
    } else {
      // Path doesn't exist on this machine — reset silently
      state.setEnvironment('');
      console.log(`Coda: saved Python path not found (${pythonPath}), resetting`);
    }
  }
  
  // Language detection — switch panel mode based on active file
  const sendLanguageMode = (editor: vscode.TextEditor | undefined) => {
    if (!editor) return;
    if (!CodaPanel.instance) return;
    
    const lang = editor.document.languageId;
    if (lang === 'python') {
      CodaPanel.instance.postMessage({ type: 'languageMode', mode: 'python' });
    } else if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(lang)) {
      CodaPanel.instance.postMessage({ type: 'languageMode', mode: 'node' });
    }
  };
  
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      sendLanguageMode(editor);
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('coda.smartOpen', async () => {
      const editor = vscode.window.activeTextEditor;
      const langId = editor?.document.languageId;
      const selection = editor?.selection;
      const snippet = editor && selection ? editor.document.getText(selection) : '';
      const fileContent = editor?.document.getText() ?? '';
      
      // Panel not open — open it, remember snippet if selected
      if (!CodaPanel.instance) {
        CodaPanel.createOrShow(context.extensionUri, state, llm, runner, nodeRunner);
        sendLanguageMode(editor);
        if (snippet && langId === 'python') {
          // Small delay to let panel initialise
          setTimeout(() => {
            CodaPanel.instance?.loadSnippet(snippet, selection!.start.line, fileContent);
          }, 500);
        }
        return;
      }
      
      // Panel already open — force mode switch and load snippet
      CodaPanel.instance?.postMessage({ 
        type: 'forceLanguageMode', 
        mode: langId === 'python' ? 'python' : 'node' 
      });
      
      
      // Panel open — trigger debug if snippet selected
      if (snippet && langId === 'python') {
        CodaPanel.instance.loadSnippet(snippet, selection!.start.line, fileContent);
      } else if (snippet && langId && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(langId)) {
        CodaPanel.instance.postMessage({ type: 'languageMode', mode: 'node' });
      } else {
        // Just reveal the panel
        CodaPanel.instance.reveal();
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