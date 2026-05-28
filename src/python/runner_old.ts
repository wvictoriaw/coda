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
    private pythonPath: string;
    private entryScript: string;
    private sandboxDir: string | null = null;
    
    constructor(private context: vscode.ExtensionContext) {
        this.pythonPath = process.platform === 'win32' ? 'python' : 'python3'; // temp default
        this.entryScript = path.join(context.extensionPath, 'src', 'python', 'sandbox', 'entry.py');
        this.initSandboxDir();
        
        // Resolve async, update when ready
        this.resolvePython().then(path => {
            this.pythonPath = path;
            console.log('Python path resolved:', this.pythonPath);
        });
    }
    
    private async resolvePython(): Promise<string> {
        try {
            const pythonExt = vscode.extensions.getExtension('ms-python.python');
            if (pythonExt) {
                if (!pythonExt.isActive) {
                    await pythonExt.activate();
                }
                
                const api = pythonExt.exports;
                console.log('Python API keys:', Object.keys(api || {}));
                console.log('Environments keys:', Object.keys(api?.environments || {}));
                const interpreter = api?.environments?.getActiveEnvironmentPath?.();
                console.log('Raw interpreter:', JSON.stringify(interpreter));
                if (interpreter?.path) {
                    console.log('Resolved Python from extension:', interpreter.path);
                    return interpreter.path;
                }
            }
        } catch (err) {
            console.log('Python extension API failed:', err);
        }
        
        // Fall back to coda setting
        const configured = vscode.workspace.getConfiguration('coda').get<string>('pythonPath', '');
        if (configured) return configured;
        
        // Fall back to platform default
        return process.platform === 'win32' ? 'python' : 'python3';
    }
    
    private initSandboxDir() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) { return; }
        this.sandboxDir = path.join(workspaceFolders[0].uri.fsPath, 'vibecode_sandbox');
    }
    
    private call(payload: object): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            const sandboxModulePath = path.join(this.context.extensionPath, 'src', 'python', 'sandbox');
            
            const proc = cp.spawn(this.pythonPath, [this.entryScript], {
                timeout: 25000,
                cwd: workspaceRoot,
                env: {
                    ...process.env,
                    PYTHONPATH: sandboxModulePath,
                }
            });
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (chunk) => stdout += chunk);
            proc.stderr.on('data', (chunk) => {
                stderr += chunk;
                console.log('Python stderr:', chunk.toString());
            });
            
            proc.on('close', (code, signal) => {
                if (code === 0) {
                    resolve(JSON.parse(stdout));
                    return;
                }
                const exitReason = code !== null 
                    ? `code ${code}` 
                    : `signal ${signal}`;
                reject(new Error(`Python process crashed or was killed via ${exitReason}.\nStderr: ${stderr}`));
                // try {
                //     resolve(JSON.parse(stdout));
                // } catch {
                //     reject(new Error(`Failed to parse Python output: ${stdout}`));
                // }
            });
            
            proc.on('error', (err) => {
                reject(new Error(`Failed to spawn Python: ${err.message}`));
            });
            
            proc.stdin.write(JSON.stringify(payload));
            proc.stdin.end();
        });
    }
    
    async detectExternalVars(snippet: string): Promise<DetectResult> {
        console.log('Detecting vars for snippet:', snippet);
        const result = await this.call({ mode: 'detect', snippet }) as string[];
        console.log('Detected vars:', result);
        return { externalVars: result };
    }
    
    setPythonPath(pythonPath: string) {
        this.pythonPath = pythonPath;
        console.log('Python path updated:', pythonPath);
    }
    
    async runSnippet(snippet: string, vars: Record<string, unknown>): Promise<RunResult> {
        if (!this.sandboxDir) {
            throw new Error('No workspace folder found — open a folder first');
        }
        const result = await this.call({
            mode: 'run',
            snippet,
            vars,
            sandbox_dir: this.sandboxDir,
        }) as RunResult;
        return result;
    }
    async detectEnvironments(): Promise<{ name: string; path: string; type: string }[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '';
        const detectorScript = path.join(
            this.context.extensionPath, 'src', 'python', 'workspace', 'env_detector.py'
        );
        
        return new Promise((resolve, reject) => {
            const proc = cp.spawn(
                process.platform === 'win32' ? 'python' : 'python3',
                [detectorScript],
                { timeout: 15000 }
            );
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (chunk) => stdout += chunk);
            proc.stderr.on('data', (chunk) => {
                stderr += chunk;
                console.log('env_detector stderr:', chunk.toString());
            });
            
            proc.on('close', (code) => {
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
                reject(new Error(`Failed to spawn env_detector: ${err.message}`));
            });
            
            proc.stdin.write(JSON.stringify({ workspace_root: workspaceRoot }));
            proc.stdin.end();
        });
    }
}