import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
export const aliases = Object.fromEntries(Object.entries({
  '@louisultra/dsh-verymath/core': './src/core/index.ts',
  '@louisultra/dsh-verymath/tool': './src/tool/index.ts',
}).map(([name, path]) => [name, fileURLToPath(new URL(path, import.meta.url))]))
export default defineConfig({ resolve: { alias: aliases }, test: { include: ['tests/**/*.spec.ts'] } })
