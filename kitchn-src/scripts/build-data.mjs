// Validates every recipe in recipes/ and writes the data the app fetches:
//   public/data/index.json            summaries for the library and search
//   public/data/recipes/<id>.json     full recipes
// Fails the build if any recipe is malformed.
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'recipes')
const outDir = join(root, 'public', 'data')

const errors = []
const fail = (file, msg) => errors.push(`${file}: ${msg}`)
const isMeasure = (m) => m && typeof m.amount === 'number' && m.amount > 0 && typeof m.unit === 'string'

function validate(file, r) {
  for (const key of ['id', 'title']) if (typeof r[key] !== 'string' || !r[key]) fail(file, `missing "${key}"`)
  if (r.id && `${r.id}.json` !== file) fail(file, `id "${r.id}" must match the file name`)
  if (r.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) fail(file, `id must be lowercase-with-dashes`)
  if (!['us', 'metric'].includes(r.writtenIn)) fail(file, `"writtenIn" must be "us" or "metric"`)
  if (!Array.isArray(r.tags)) fail(file, `"tags" must be an array`)
  if (!Array.isArray(r.ingredients) || !r.ingredients.length) return fail(file, 'needs ingredients')
  if (!Array.isArray(r.operations) || !r.operations.length) return fail(file, 'needs operations')

  const ids = new Set()
  const claim = (id, what) => {
    if (ids.has(id)) fail(file, `duplicate id "${id}" (${what})`)
    ids.add(id)
  }

  for (const ing of r.ingredients) {
    claim(ing.id, 'ingredient')
    if (!ing.name) fail(file, `ingredient "${ing.id}" needs a name`)
    for (const k of ['us', 'metric', 'count']) {
      if (ing[k] !== undefined && !isMeasure(ing[k])) fail(file, `ingredient "${ing.id}" has an invalid "${k}" measure`)
    }
    if (!ing.us && !ing.metric && !ing.count && !ing.amountText) fail(file, `ingredient "${ing.id}" needs an amount or amountText`)
    if (ing.estimate !== undefined && !['us', 'metric'].includes(ing.estimate)) fail(file, `ingredient "${ing.id}": "estimate" must be "us" or "metric"`)
    if (ing.estimate && !ing[ing.estimate]) fail(file, `ingredient "${ing.id}" marks its ${ing.estimate} value as an estimate but has none`)
  }

  // Each input must already exist (ingredients, or an earlier operation) and be used exactly once,
  // which makes the recipe a tree that the overview table can draw.
  const used = new Set()
  const seenOps = new Set()
  const ingredientIds = new Set(r.ingredients.map((i) => i.id))
  for (const op of r.operations) {
    claim(op.id, 'operation')
    if (!op.label || !op.text) fail(file, `operation "${op.id}" needs a label and text`)
    if (!Array.isArray(op.inputs) || !op.inputs.length) fail(file, `operation "${op.id}" needs inputs`)
    for (const input of op.inputs ?? []) {
      if (!ingredientIds.has(input) && !seenOps.has(input)) fail(file, `operation "${op.id}" uses "${input}" before it exists`)
      if (used.has(input)) fail(file, `"${input}" is used by more than one operation`)
      used.add(input)
    }
    if (op.timer !== undefined && !(op.timer > 0)) fail(file, `operation "${op.id}" has an invalid timer`)
    seenOps.add(op.id)
  }
  for (const ing of r.ingredients) if (!used.has(ing.id)) fail(file, `ingredient "${ing.id}" is never used`)
  const ops = r.operations
  for (const op of ops.slice(0, -1)) if (!used.has(op.id)) fail(file, `operation "${op.id}" is never used by a later step`)

  for (const s of r.setup ?? []) {
    claim(s.id, 'setup')
    if (!s.text) fail(file, `setup "${s.id}" needs text`)
    if (s.after && !seenOps.has(s.after)) fail(file, `setup "${s.id}" comes after unknown operation "${s.after}"`)
  }
}

const files = (await readdir(srcDir)).filter((f) => f.endsWith('.json')).sort()
const recipes = []
for (const file of files) {
  let recipe
  try {
    recipe = JSON.parse(await readFile(join(srcDir, file), 'utf8'))
  } catch (e) {
    fail(file, `invalid JSON: ${e.message}`)
    continue
  }
  validate(file, recipe)
  recipes.push(recipe)
}

if (errors.length) {
  console.error(`\nRecipe data has ${errors.length} problem(s):\n  ${errors.join('\n  ')}\n`)
  process.exit(1)
}

await rm(outDir, { recursive: true, force: true })
await mkdir(join(outDir, 'recipes'), { recursive: true })

const index = recipes
  .map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    tags: r.tags,
    ingredientNames: r.ingredients.map((i) => i.name),
    ingredientCount: r.ingredients.length,
    stepCount: r.operations.length + (r.setup?.length ?? 0),
  }))
  .sort((a, b) => a.title.localeCompare(b.title))

await writeFile(join(outDir, 'index.json'), JSON.stringify(index))
for (const r of recipes) await writeFile(join(outDir, 'recipes', `${r.id}.json`), JSON.stringify(r))

console.log(`kitchn: ${recipes.length} recipe(s) OK`)
