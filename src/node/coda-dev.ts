// coda-dev.ts
// Drop this file into your Streamlit component's frontend src/ folder.
// Import it once at the top of your index.tsx: import './coda-dev';
// Remove before shipping to production.

if (process.env.NODE_ENV === 'development') {
    // --- Console bridge ---
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    const post = (level: 'log' | 'warn' | 'error', args: unknown[]) => {
        window.parent.postMessage({ type: 'coda:log', level, args }, '*');
    };
    
    console.log = (...args: unknown[]) => {
        originalLog(...args);
        post('log', args);
    };
    
    console.warn = (...args: unknown[]) => {
        originalWarn(...args);
        post('warn', args);
    };
    
    console.error = (...args: unknown[]) => {
        originalError(...args);
        post('error', args);
    };
    
    // --- State bridge ---
    // Call this anywhere in your component to stream state to Coda:
    // codaInspect({ myState, myOtherState }, props);
    (window as unknown as Record<string, unknown>).codaInspect = (
        state: unknown,
        props?: unknown
    ) => {
        window.parent.postMessage({
            type: 'coda:state',
            state,
            props: props ?? null,
        }, '*');
    };
}