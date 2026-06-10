const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const copyPythonPlugin = {
    name: 'copy-python-backend',
    setup(build) {
        build.onEnd(() => {
            const src = path.join(__dirname, 'src', 'python');
            const dest = path.join(__dirname, 'out', 'python');
            
            fs.cpSync(src, dest, { recursive: true, force: true });
            console.log('✅ Python backend copied to out/python');
        });
    },
};

// 1. Configuration for the Extension Host & the Node Sandbox (Target: Node)
const nodeConfig = {
    entryPoints: {
        'extension': 'src/extension.ts',
        'node/sandbox/bridge': 'src/node/sandbox/bridge.ts' // Our upcoming Node sandbox
    },
    bundle: true,
    outdir: 'out',
    format: 'cjs',
    platform: 'node',
    external: ['vscode', 'jsdom', 'canvas', 'vm2'],
    sourcemap: true,
    minify: production,
};

// 2. Configuration for your React Frontend (Target: Browser)
const webviewConfig = {
    entryPoints: ['src/webview/ui/index.tsx'],
    bundle: true,
    outfile: 'out/webview/index.js',
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    sourcemap: true,
    minify: production,
    plugins: [copyPythonPlugin], // Your plugin safely runs here
};

async function main() {
    if (watch) {
        const nodeCtx = await esbuild.context(nodeConfig);
        const webviewCtx = await esbuild.context(webviewConfig);
        
        await nodeCtx.watch();
        await webviewCtx.watch();
        console.log('👀 Watching extension, node sandbox, and webview...');
    } else {
        await esbuild.build(nodeConfig);
        await esbuild.build(webviewConfig);
        console.log('🚀 All environments built successfully');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});