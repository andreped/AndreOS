import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 3000,
        // No COEP needed on localhost — Chrome/Edge allow SharedArrayBuffer there
        // without cross-origin isolation. Removing it restores iframe compatibility.
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
        },
    },
    preview: {
        port: 4173,
        // Production preview still needs credentialless for SharedArrayBuffer.
        // NOTE: test iframe compatibility on your chosen host after deploying.
        headers: {
            'Cross-Origin-Opener-Policy':   'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
        },
    },
});
