import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from '../state/manager';
import { LLMClient } from '../llm/client';
import { PythonRunner } from '../python/runner';
import { NodeRunner } from '../node/runner';

export class CodaPanel {
  public static instance: CodaPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  
  private constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly state: StateManager,
    private readonly llm: LLMClient,
    private readonly runner: PythonRunner,
    private readonly nodeRunner: NodeRunner,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'codaPanel',
      'Coda',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'out', 'webview')
        ]
      }
    );
    
    this.panel.webview.html = this.getHtml();
    
    // Message bridge — webview to extension
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === 'ready') {
          await this.sendEnvStatus();
          return;
        }
        this.handleMessage(message);
      },
      null,
      this.disposables
    );
    
    this.panel.onDidDispose(
      () => this.dispose(),
      null,
      this.disposables
    );
  }
  
  // Create or bring existing panel to focus
  public static createOrShow(
    extensionUri: vscode.Uri,
    state: StateManager,
    llm: LLMClient,
    runner: PythonRunner,
    nodeRunner: NodeRunner
  ) {
    if (CodaPanel.instance) {
      CodaPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    CodaPanel.instance = new CodaPanel(extensionUri, state, llm, runner, nodeRunner);
  }
  
  // Called when developer highlights and triggers debug mode
  public async loadSnippet(snippet: string, startLine: number, fileContent: string) {
    const context = await this.runner.extractContext(fileContent, startLine);
    const { externalVars } = await this.runner.detectExternalVars(snippet, context);
    
    this.panel.webview.postMessage({
      type: 'loadSnippet',
      snippet,
      startLine,
      externalVars,
      context,
    });
  }
  
  public postMessage(message: unknown) {
    this.panel.webview.postMessage(message);
  }
  
  // Handle messages coming from the React UI
  private async handleMessage(message: { type: string; [key: string]: unknown }) {
    console.log('handleMessage received:', message.type);
    switch (message.type) {
      
      case 'runSnippet': {
        console.log('running snippet...');
        const snippet = message.snippet as string;
        const vars = message.vars as Record<string, unknown>;
        try {
          console.log('calling runner...');
          const result = await this.runner.runSnippet(snippet, vars);
          console.log('success:', result.success);
          console.log('error:', result.error);
          console.log('prints:', result.prints);
          console.log('files:', result.files_written);
          this.panel.webview.postMessage({ type: 'runResult', result });
        } catch (err) {
          const error = err instanceof Error ? err.stack : String(err);
          console.log('run error:', error);
          this.panel.webview.postMessage({ type: 'runError', error });
        }
        break;
      }
      
      case 'detectEnvironments': {
        try {
          const envs = await this.runner.detectEnvironments();
          this.panel.webview.postMessage({ type: 'environmentsDetected', envs });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          this.panel.webview.postMessage({ type: 'environmentsError', error });
        }
        break;
      }
      
      case 'selectEnvironment': {
        const pythonPath = message.pythonPath as string;
        this.state.setEnvironment(pythonPath);
        this.runner.setPythonPath(pythonPath);
        this.panel.webview.postMessage({ type: 'envStatus', hasSelectedEnv: true, pythonPath });
        break;
      }
      
      case 'getState': {
        this.panel.webview.postMessage({
          type: 'state',
          state: this.state.getState()
        });
        break;
      }
      
      case 'lockLine': {
        this.state.lockLine(message.line as number);
        break;
      }
      
      case 'markReviewed': {
        this.state.markReviewed(message.lines as number[]);
        break;
      }
      
      case 'setNodePort': {
        const port = message.port as number;
        this.state.setNodePort(port);
        break;
      }
      
      case 'openInBrowser': {
        const port = message.port as number;
        const url = `http://localhost:${port}`;
        const browser = this.state.getNodeConfig().preferredBrowser;
        if (browser) {
          const cp = require('child_process');
          const platform = process.platform;
          if (platform === 'darwin') {
            cp.spawn('open', ['-a', browser, url]);
          } else if (platform === 'win32') {
            cp.spawn('start', [browser, url], { shell: true });
          } else {
            cp.spawn(browser, [url]);
          }
        } else {
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
      }
      
      case 'clearLogs': {
        this.panel.webview.postMessage({ type: 'clearLogs' });
        break;
      }
      
      case 'componentLog': {
        // forwarded from coda-dev.ts via iframe postMessage
        this.panel.webview.postMessage({
          type: 'appendLog',
          source: 'js',
          level: message.level,
          args: message.args,
          timestamp: Date.now(),
        });
        break;
      }
      
      case 'componentState': {
        this.panel.webview.postMessage({
          type: 'updateState',
          state: message.state,
          props: message.props,
        });
        break;
      }
      
      default:
      console.warn(`Coda: unknown message type ${message.type}`);
    }
  }
  
  private getHtml(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'index.js')
    );
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" 
  content="default-src 'none'; 
           script-src ${this.panel.webview.cspSource}; 
           style-src ${this.panel.webview.cspSource} 'unsafe-inline';
           frame-src http://localhost:*;">
  <title>Coda</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    #root {
      height: 100vh;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
  
  private dispose() {
    CodaPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
  
  private async sendEnvStatus() {
    const { pythonPath, hasSelectedEnv } = this.state.getEnvironment();
    const { port, preferredBrowser } = this.state.getNodeConfig();
    this.panel.webview.postMessage({
      type: 'envStatus',
      hasSelectedEnv,
      pythonPath,
      nodePort: port,
      preferredBrowser,
    });
  }
}