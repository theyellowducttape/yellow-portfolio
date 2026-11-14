import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const recipesDir = fileURLToPath(new URL('./recipes', import.meta.url))

/** In dev, rebuild public/data whenever a recipe file changes, then reload the page. */
function recipeData(): Plugin {
  return {
    name: 'kitchn-recipe-data',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(recipesDir)
      const rebuild = (file: string) => {
        if (!file.startsWith(recipesDir)) return
        execFile('node', ['scripts/build-data.mjs'], (err, stdout, stderr) => {
          if (err) server.config.logger.error(stderr || err.message)
          else {
            server.config.logger.info(stdout.trim())
            server.ws.send({ type: 'full-reload' })
          }
        })
      }
      server.watcher.on('change', rebuild)
      server.watcher.on('add', rebuild)
      server.watcher.on('unlink', rebuild)
    },
  }
}

// Built output is committed to ../kitchn and served by GitHub Pages at /kitchn/.
export default defineConfig({
  base: '/kitchn/',
  plugins: [react(), recipeData()],
  build: {
    outDir: '../kitchn',
    emptyOutDir: true,
    rollupOptions: {
      // GitHub Pages runs Jekyll, which drops files starting with "_". Keep names safe.
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
