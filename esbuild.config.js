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

const ctx = esbuild.context({
    entryPoints: ['src/webview/ui/index.tsx'],
    bundle: true,
    outfile: 'out/webview/index.js',
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    sourcemap: true,
    minify: false,
    plugins: [copyPythonPlugin],
});

ctx.then(async (context) => {
    if (watch) {
        await context.watch();
        console.log('Watching webview...');
    } else {
        await context.rebuild();
        await context.dispose();
        console.log('Webview built');
    }
}).catch(() => process.exit(1));