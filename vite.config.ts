// vitest.config.ts (또는 vite.config.ts)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup/vitest.setup.ts'],
    coverage : {
      exclude: [
        'src/types/**',
        'test/lib/**',
        'test/mock/**',
        'test/setup/**',
      ]
    }
  },
})