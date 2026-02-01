import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: [], // Add setup file if needed later
        include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
        exclude: ['node_modules', 'dist', '.next', '.git', 'tests/e2e'],
        env: {
            TZ: 'America/Sao_Paulo',
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './'),
        },
    },
})
