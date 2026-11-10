import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const at = (f) => fileURLToPath(new URL(f, import.meta.url));
const withIncludes = (html) => html.replace(/<!--\s*@include\s+([\w./-]+)\s*-->/g, (_, file) => readFileSync(at(file), 'utf8'));
export default defineConfig({
  root: at('.'),
  base: '/',
  publicDir: false,
  plugins: [{ name: 'inc', transformIndexHtml: { order: 'pre', handler: withIncludes } }],
  build: { outDir: 'dist-voice', emptyOutDir: true, assetsDir: 'landing-assets', rollupOptions: { input: { voice: at('voice/index.html') } } },
});
