/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
// stamped onto every data file, so an update is never played with last week's models
const V = (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 8);
export default defineConfig({ base: './', define: { __V__: JSON.stringify(V) }, build: { target: 'es2022', chunkSizeWarningLimit: 1500 }, server: { port: 5173 }, test: { exclude: ['**/node_modules/**', '.claude/**'] } });
