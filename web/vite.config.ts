import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

// Support floor: old Android Chrome and Safari 15. Relative base so the same
// build works on the server, inside the desktop shell and inside the Android app.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    target: ['es2019', 'chrome72', 'safari15'],
    cssTarget: ['chrome72', 'safari15'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
