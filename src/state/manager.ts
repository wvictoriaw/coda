import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface PreferenceEntry {
  summary: string;
  updatedAt: string;
}

export interface ChangeLogEntry {
  original: string;
  changed: string;
  reason: string;
  significance: 'cosmetic' | 'structural' | 'logic' | 'intent';
  timestamp: string;
}

export interface CodaState {
  lockedLines: number[];
  reviewedLines: number[];
  changeLog: ChangeLogEntry[];
  preferences: PreferenceEntry[];
  pythonPath: string | null;
  hasSelectedEnv: boolean;
}

export class StateManager {
  private state: CodaState;
  private statePath: string | null = null;
  
  constructor(private context: vscode.ExtensionContext) {
    this.state = this.empty();
    this.initStatePath();
  }
  
  private empty(): CodaState {
    return {
      lockedLines: [],
      reviewedLines: [],
      changeLog: [],
      preferences: [],
      pythonPath: null,
      hasSelectedEnv: false
    };
  }
  
  private initStatePath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { return; }
    
    const root = workspaceFolders[0].uri.fsPath;
    const codaDir = path.join(root, '.coda');
    
    if (!fs.existsSync(codaDir)) {
      fs.mkdirSync(codaDir, { recursive: true });
    }
    
    this.statePath = path.join(codaDir, 'state.json');
    
    if (fs.existsSync(this.statePath)) {
      try {
        const raw = fs.readFileSync(this.statePath, 'utf8');
        this.state = JSON.parse(raw);
      } catch {
        this.state = this.empty();
      }
    }
  }
  
  private persist() {
    if (!this.statePath) { return; }
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }
  
  lockLine(line: number) {
    if (!this.state.lockedLines.includes(line)) {
      this.state.lockedLines.push(line);
      this.persist();
    }
  }
  
  unlockLine(line: number) {
    this.state.lockedLines = this.state.lockedLines.filter(l => l !== line);
    this.persist();
  }
  
  markReviewed(lines: number[]) {
    for (const line of lines) {
      if (!this.state.reviewedLines.includes(line)) {
        this.state.reviewedLines.push(line);
      }
    }
    this.persist();
  }
  
  logChange(entry: ChangeLogEntry) {
    this.state.changeLog.push(entry);
    this.persist();
  }
  
  updatePreferences(entries: PreferenceEntry[]) {
    this.state.preferences = entries;
    this.persist();
  }
  
  getState(): CodaState {
    return this.state;
  }
  
  setEnvironment(pythonPath: string) {
    this.state.pythonPath = pythonPath;
    this.state.hasSelectedEnv = true;
    this.persist();
  }
  
  getEnvironment(): { pythonPath: string | null; hasSelectedEnv: boolean } {
    return {
      pythonPath: this.state.pythonPath,
      hasSelectedEnv: this.state.hasSelectedEnv,
    };
  }
}