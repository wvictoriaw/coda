import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

export class NodeRunner {
    constructor(private context: vscode.ExtensionContext) {}

    async runSnippet(snippet: string, langId: string): Promise<any> {
        return new Promise((resolve) => {
            const runnerPath = path.join(this.context.extensionPath, 'out', 'node', 'sandbox', 'bridge.js');
            const child = spawn('node', [runnerPath]);

            let output = '';
            let errorOutput = '';

            // 1. Send the payload to the sandbox
            child.stdin.write(JSON.stringify({ snippet, langId }));
            child.stdin.end();

            // 2. Buffer the outputs
            child.stdout.on('data', (data) => output += data.toString());
            child.stderr.on('data', (data) => errorOutput += data.toString());

            // 3. Handle completion safely
            child.on('close', (code) => {
                try {
                    if (output.trim()) {
                        // Safely parse our standard handshake
                        const result = JSON.parse(output);
                        resolve(result);
                    } else {
                        // Bridge crashed before outputting JSON
                        resolve({
                            success: false,
                            error: errorOutput || `Process exited with code ${code}`,
                            logs: [],
                            steps: []
                        });
                    }
                } catch (e: any) {
                    // JSON parsing failed (e.g., raw stack trace printed to stdout)
                    resolve({
                        success: false,
                        error: `Failed to parse sandbox output.\nStderr: ${errorOutput}\nRaw Stdout: ${output}`,
                        logs: [],
                        steps: []
                    });
                }
            });
        });
    }
}