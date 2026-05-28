import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';

export type LLMProvider = 'ollama' | 'claude' | 'openai' | 'custom';

export interface LLMConfig {
    provider: LLMProvider;
    baseUrl: string;
    apiKey?: string;
    mainModel: string;
    classifierModel: string;
}

export class LLMClient {
    private getConfig(): LLMConfig {
        const config = vscode.workspace.getConfiguration('coda');
        return {
            provider: config.get<LLMProvider>('llm.provider', 'ollama'),
            baseUrl: config.get<string>('llm.baseUrl', 'http://localhost:11434'),
            apiKey: config.get<string>('llm.apiKey', ''),
            mainModel: config.get<string>('llm.mainModel', 'qwen2.5-coder'),
            classifierModel: config.get<string>('llm.classifierModel', 'phi4-mini'),
        };
    }

    async generate(prompt: string): Promise<string> {
        const config = this.getConfig();
        return this.call(prompt, config.mainModel, config);
    }

    async classify(prompt: string): Promise<string> {
        const config = this.getConfig();
        return this.call(prompt, config.classifierModel, config);
    }

    private async call(prompt: string, model: string, config: LLMConfig): Promise<string> {
        try {
            switch (config.provider) {
                case 'ollama':
                    return await this.callOllama(prompt, model, config.baseUrl);
                case 'claude':
                    return await this.callClaude(prompt, model, config.apiKey ?? '');
                case 'openai':
                    return await this.callOpenAI(prompt, model, config.baseUrl, config.apiKey ?? '');
                case 'custom':
                    return await this.callOpenAI(prompt, model, config.baseUrl, config.apiKey ?? '');
                default:
                    throw new Error(`Unknown provider: ${config.provider}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`LLM call failed (${config.provider}): ${message}`);
        }
    }

    private async callOllama(prompt: string, model: string, baseUrl: string): Promise<string> {
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, stream: false }),
        });

        if (!response.ok) {
            throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
        }

        const data = await response.json() as { response: string };
        return data.response;
    }

    private async callClaude(prompt: string, model: string, apiKey: string): Promise<string> {
        const client = new Anthropic({ apiKey });
        const message = await client.messages.create({
            model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });
        const block = message.content[0];
        if (block.type !== 'text') {
            throw new Error('Unexpected response type from Claude');
        }
        return block.text;
    }

    private async callOpenAI(prompt: string, model: string, baseUrl: string, apiKey: string): Promise<string> {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI returned ${response.status}: ${await response.text()}`);
        }

        const data = await response.json() as { choices: { message: { content: string } }[] };
        return data.choices[0].message.content;
    }
}