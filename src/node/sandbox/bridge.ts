import { VM } from 'vm2';
import { JSDOM } from 'jsdom';

/**
 * Coda Node Sandbox Bridge
 * This script runs in a separate Node process to execute JS/TS snippets.
 */

async function executeNodeSnippet(snippet: string) {
    // 1. Setup a virtual browser environment
    const dom = new JSDOM(`<!DOCTYPE html><div id="root"></div>`);
    const { window } = dom;

    const logs: string[] = [];
    const steps: any[] = [];

    // 2. Define the sandbox globals
    const sandbox = {
        window: window,
        document: window.document,
        navigator: window.navigator,
        console: {
            log: (...args: any[]) => logs.push(args.join(' ')),
            error: (...args: any[]) => logs.push(`ERROR: ${args.join(' ')}`),
        },
        // Hook for deep-dive variable tracking
        __coda_trace: (line: number, vars: any) => {
            steps.push({ line, vars: JSON.parse(JSON.stringify(vars)) });
        }
    };

    const vm = new VM({
        timeout: 2000, // Safety: Kill infinite loops
        sandbox: sandbox,
    });

    try {
        // 3. Wrap snippet in an async IIFE to handle 'await'
        const wrappedCode = `
            (async () => {
                try {
                    ${snippet}
                } catch (e) {
                    console.error(e.message);
                }
            })()
        `;
        
        await vm.run(wrappedCode);

        return {
            success: true,
            logs,
            steps,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            logs,
        };
    }
}

// Communication with the Extension Host (Runner.ts)
process.stdin.on('data', async (data) => {
    try {
        const { snippet } = JSON.parse(data.toString());
        const result = await executeNodeSnippet(snippet);
        process.stdout.write(JSON.stringify(result));
    } catch (err: any) {
        process.stderr.write(JSON.stringify({ success: false, error: err.message }));
    }
});