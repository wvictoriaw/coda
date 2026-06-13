import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

export interface TraceStep {
    line: number;
    event: 'line' | 'return' | 'exception';
    changed: Record<string, { from: unknown; to: unknown; new: boolean }>;
    all_vars: Record<string, unknown>;
    return_value?: unknown;
    exception?: string;
}

export interface RunResult {
    success: boolean;
    steps: TraceStep[];
    final_vars?: Record<string, unknown>;
    prints?: string[];
    files_written?: string[];
    error?: string;
    traceback?: string;
}

export interface DetectResult {
    externalVars: string[];
}

export class PythonRunner {
    private pythonPath: string = '';
    private bridgeScript: string;
    private sandboxDir: string | null = null;
    
    constructor(private context: vscode.ExtensionContext) {
        this.bridgeScript = path.join(
            context.extensionPath, 'out', 'python', 'sandbox', 'bridge.py'
        );
        this.initSandboxDir();
    }
    
    setPythonPath(pythonPath: string) {
        this.pythonPath = pythonPath;
        console.log('Python path set:', this.pythonPath);
    }
    
    private initSandboxDir() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        this.sandboxDir = path.join(
            workspaceFolders[0].uri.fsPath, 'vibecode_sandbox'
        );
    }
    
    private call(payload: object): Promise<unknown> {
        return new Promise((resolve, reject) => {
            if (!this.pythonPath) {
                reject(new Error('No Python environment selected — please select one in the ENV tab'));
                return;
            }
            
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            
            const proc = cp.spawn(this.pythonPath, [this.bridgeScript], {
                cwd: workspaceRoot,
            });
            
            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error('Python process timed out'));
            }, 60000);
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (chunk) => { stdout += chunk; });
            proc.stderr.on('data', (chunk) => {
                stderr += chunk;
                console.log('Python stderr:', chunk.toString());
            });
            
            proc.on('close', (code) => {
                clearTimeout(timer);
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                    return;
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    reject(new Error(`Failed to parse Python output: ${stdout}`));
                }
            });
            
            proc.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Failed to spawn Python: ${err.message}`));
            });
            
            proc.stdin.write(JSON.stringify(payload));
            proc.stdin.end();
        });
    }
    
    async detectExternalVars(snippet: string, context: string = ''): Promise<DetectResult> {
        const result = await this.call({ 
            mode: 'detect', 
            snippet,
            context 
        }) as string[];
        return { externalVars: result };
    }
    
    async runSnippet(
        snippet: string,
        vars: Record<string, unknown>,
        onPrint: (line: string) => void
    ): Promise<RunResult> {
        if (!this.sandboxDir) {
            throw new Error('No workspace folder found — open a folder first');
        }
        
        return new Promise((resolve, reject) => {
            if (!this.pythonPath) {
                reject(new Error('No Python environment selected — please select one in the ENV tab'));
                return;
            }
            
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            const proc = cp.spawn(this.pythonPath, [this.bridgeScript], {
                cwd: workspaceRoot,
            });
            
            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error('Python process timed out'));
            }, 65000);
            
            let buffer = '';
            let stderr = '';
            
            proc.stdout.on('data', (chunk: Buffer) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line);
                        if (msg.type === 'print') {
                            onPrint(msg.line);
                        } else if (msg.type === 'result' || msg.success !== undefined) {
                            clearTimeout(timer);
                            resolve(msg as RunResult);
                        }
                    } catch {
                        // not JSON — ignore
                    }
                }
            });
            
            proc.stderr.on('data', (chunk: Buffer) => {
                stderr += chunk.toString();
                console.log('Python stderr:', chunk.toString());
            });
            
            proc.on('close', (code) => {
                clearTimeout(timer);
                if (buffer.trim()) {
                    try {
                        const msg = JSON.parse(buffer);
                        if (msg.type === 'result' || msg.success !== undefined) {
                            resolve(msg as RunResult);
                            return;
                        }
                    } catch { /* ignore */ }
                }
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                }
            });
            
            proc.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Failed to spawn Python: ${err.message}`));
            });
            
            proc.stdin.write(JSON.stringify({
                mode: 'run',
                snippet,
                vars,
                sandbox_dir: this.sandboxDir,
            }));
            proc.stdin.end();
        });
    }
    
    async detectEnvironments(): Promise<{ name: string; path: string; type: string }[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '';
        const detectorScript = path.join(
            this.context.extensionPath, 'out', 'python', 'workspace', 'env_detector.py'
        );
        
        return new Promise((resolve, reject) => {
            const systemPython = process.platform === 'win32' ? 'python' : 'python3';
            const proc = cp.spawn(systemPython, [detectorScript]);
            
            const timer = setTimeout(() => {
                proc.kill();
                reject(new Error('env_detector timed out'));
            }, 15000);
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (chunk) => { stdout += chunk; });
            proc.stderr.on('data', (chunk) => {
                stderr += chunk;
                console.log('env_detector stderr:', chunk.toString());
            });
            
            proc.on('close', (code) => {
                clearTimeout(timer);
                if (code !== 0) {
                    reject(new Error(`env_detector failed: ${stderr}`));
                    return;
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    reject(new Error(`Failed to parse env_detector output: ${stdout}`));
                }
            });
            
            proc.on('error', (err) => {
                clearTimeout(timer);
                reject(new Error(`Failed to spawn env_detector: ${err.message}`));
            });
            
            proc.stdin.write(JSON.stringify({ workspace_root: workspaceRoot }));
            proc.stdin.end();
        });
    }
    
    async extractContext(fileContent: string, snippetStartLine: number): Promise<string> {
        const result = await this.call({
            mode: 'context',
            file_content: fileContent,
            snippet_start_line: snippetStartLine,
        }) as string;
        return result;
    }
}