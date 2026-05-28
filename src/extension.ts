import * as vscode from 'vscode';
import { CodaPanel } from './webview/panel';
import { PythonRunner } from './python/runner';
import { LLMClient } from './llm/client';
import { StateManager } from './state/manager';

export function activate(context: vscode.ExtensionContext) {
	console.log('Coda is active');
	
	const state = new StateManager(context);
	const llm = new LLMClient();
	const runner = new PythonRunner(context);
	
	// Restore saved environment immediately — no async needed
	const { pythonPath, hasSelectedEnv } = state.getEnvironment();
	if (hasSelectedEnv && pythonPath) {
		runner.setPythonPath(pythonPath);
	}
	
	context.subscriptions.push(
		vscode.commands.registerCommand('coda.openPanel', () => {
			CodaPanel.createOrShow(context.extensionUri, state, llm, runner);
		})
	);
	
	context.subscriptions.push(
		vscode.commands.registerCommand('coda.debugSnippet', () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;
			
			const selection = editor.selection;
			const snippet = editor.document.getText(selection);
			
			if (!snippet) {
				vscode.window.showWarningMessage('Select some Python code first');
				return;
			}
			
			const fileContent = editor.document.getText();
			
			CodaPanel.createOrShow(context.extensionUri, state, llm, runner);
			CodaPanel.instance?.loadSnippet(snippet, selection.start.line, fileContent);
		})
	);
	
	context.subscriptions.push(
		vscode.commands.registerCommand('coda.generateHere', () => {
			vscode.window.showInformationMessage('Generation coming soon');
		})
	);
}

export function deactivate() {}