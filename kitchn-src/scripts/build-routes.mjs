// GitHub Pages can't rewrite URLs, so give every recipe a real folder:
// /kitchn/r/<id>/index.html is a copy of the app shell, which then reads the URL.
import { readFile, mkdir, copyFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'kitchn')
const index = JSON.parse(await readFile(join(out, 'data', 'index.json'), 'utf8'))

for (const { id } of index) {
  const dir = join(out, 'r', id)
  await mkdir(dir, { recursive: true })
  await copyFile(join(out, 'index.html'), join(dir, 'index.html'))
}
console.log(`kitchn: wrote ${index.length} recipe route(s)`)
