import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, join, normalize, relative } from 'node:path'
import { getStudioDesignSystem, getStudioTemplate, listStudioDesignSystems, listStudioTemplates, readStudioComponentHtml, readStudioTemplateHtml } from './templates.ts'
import type { AddStudioComponentInput, AddStudioPageInput, AdoptStudioOutputInput, CreateStudioOutputInput, CreateStudioProjectInput, StudioComponentRecord, StudioExportFormat, StudioExportRecord, StudioOutputMetadata, StudioOutputRecord, StudioOutputType, UpdateStudioOutputInput } from './types.ts'

const SCHEMA = 'craft-studio-output/v1' as const
const ALLOWED_TYPES = new Set<StudioOutputType>(['prototype', 'landing-page', 'dashboard', 'deck', 'report', 'image-prompt', 'video-prompt'])

function nowIso(): string { return new Date().toISOString() }

export function slugifyStudioOutputId(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `studio-${Date.now()}`
}

function assertSafeSegment(value: string, label: string): string {
  if (!value || value.includes('..') || /[\\/]/.test(value)) throw new Error(`${label} must be a safe path segment`)
  return value
}

function ensureInside(root: string, target: string, message = 'Path escapes studio output directory'): string {
  const normalizedRoot = normalize(root)
  const normalizedTarget = normalize(target)
  const rel = relative(normalizedRoot, normalizedTarget)
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${'/'}`) || rel.includes(`..${'\\'}`)) throw new Error(message)
  return normalizedTarget
}

export function getStudioRoot(sessionPath: string): string { return join(sessionPath, 'data', 'studio') }
export function getStudioOutputDir(sessionPath: string, outputId: string): string { return join(getStudioRoot(sessionPath), assertSafeSegment(outputId, 'output id')) }
function metadataPath(outputDir: string): string { return join(outputDir, 'metadata.json') }
function readmePath(outputDir: string): string { return join(outputDir, 'README.md') }

export { getStudioDesignSystem, getStudioTemplate, listStudioDesignSystems, listStudioTemplates }

export function readStudioOutput(outputDir: string): StudioOutputRecord | null {
  const path = metadataPath(outputDir)
  if (!existsSync(path)) return null
  const metadata = JSON.parse(readFileSync(path, 'utf-8')) as StudioOutputMetadata
  if (metadata.schema !== SCHEMA) return null
  const entryPath = ensureInside(outputDir, join(outputDir, metadata.entryFile || 'index.html'))
  return { metadata, outputDir, entryPath }
}

export function listStudioOutputsForSession(sessionPath: string): StudioOutputRecord[] {
  const root = getStudioRoot(sessionPath)
  if (!existsSync(root)) return []
  return readdirSync(root).flatMap(id => {
    const dir = join(root, id)
    if (!statSync(dir).isDirectory()) return []
    const record = readStudioOutput(dir)
    return record ? [record] : []
  }).sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt))
}

export function listStudioOutputsForSessions(sessionPaths: string[]): StudioOutputRecord[] {
  return sessionPaths.flatMap(listStudioOutputsForSession).sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt))
}

function defaultHtml(title: string): string {
  const safeTitle = title.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c))
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>${safeTitle}</title>\n<style>body{font-family:Inter,ui-sans-serif,system-ui;margin:0;background:#0f172a;color:#e2e8f0}main{min-height:100vh;display:grid;place-items:center;padding:48px}section{max-width:860px}h1{font-size:56px;line-height:1;margin:0 0 16px}p{font-size:20px;color:#94a3b8}</style>\n</head>\n<body><main><section><h1>${safeTitle}</h1><p>Studio output ready. Refine this project with Studio skills and templates.</p></section></main></body>\n</html>\n`
}

function htmlForInput(input: CreateStudioOutputInput): string {
  const templateId = input.template ?? input.templateId
  if (input.html !== undefined) return input.html
  if (templateId) return readStudioTemplateHtml(templateId)
  return defaultHtml(input.title)
}

function writeMetadata(outputDir: string, metadata: StudioOutputMetadata): void {
  writeFileSync(metadataPath(outputDir), JSON.stringify(metadata, null, 2) + '\n', 'utf-8')
}

function ensureProjectDirs(outputDir: string): void {
  for (const dir of ['assets', 'exports', 'pages', 'components']) mkdirSync(join(outputDir, dir), { recursive: true })
}

export function createStudioOutput(sessionPath: string, input: CreateStudioOutputInput, sessionId: string): StudioOutputRecord {
  if (!ALLOWED_TYPES.has(input.type)) throw new Error(`Unsupported Studio output type: ${input.type}`)
  const templateId = input.template ?? input.templateId
  const template = templateId ? getStudioTemplate(templateId) : undefined
  if (templateId && !template) throw new Error(`Studio template not found: ${templateId}`)
  const id = assertSafeSegment(input.id ? slugifyStudioOutputId(input.id) : slugifyStudioOutputId(input.title), 'output id')
  const outputDir = getStudioOutputDir(sessionPath, id)
  ensureProjectDirs(outputDir)
  const entryFile = input.entryFile ?? 'index.html'
  ensureInside(outputDir, join(outputDir, entryFile))
  const createdAt = nowIso()
  const metadata: StudioOutputMetadata = {
    schema: SCHEMA,
    id,
    title: input.title,
    type: input.type,
    entryFile,
    skill: input.skill ?? template?.skill,
    status: 'ready',
    sourcePrompt: input.sourcePrompt,
    createdAt,
    updatedAt: createdAt,
    designSystem: input.designSystem,
    exports: [],
    sessionId,
    project: { kind: 'single-page', title: input.title },
    templateId,
    pages: [{ id: 'home', title: 'Home', file: entryFile, createdAt, updatedAt: createdAt }],
    components: [],
    theme: input.theme,
  }
  writeFileSync(join(outputDir, entryFile), htmlForInput(input), 'utf-8')
  writeFileSync(readmePath(outputDir), input.readme ?? `# ${input.title}\n\nStudio project generated by Craft.\n`, 'utf-8')
  writeMetadata(outputDir, metadata)
  return { metadata, outputDir, entryPath: join(outputDir, entryFile) }
}

export function createStudioProject(sessionPath: string, input: CreateStudioProjectInput, sessionId: string): StudioOutputRecord {
  const record = createStudioOutput(sessionPath, input, sessionId)
  const metadata: StudioOutputMetadata = { ...record.metadata, project: { kind: input.kind ?? 'single-page', title: input.title } }
  writeMetadata(record.outputDir, metadata)
  return { ...record, metadata }
}

export function updateStudioOutput(sessionPath: string, outputId: string, input: UpdateStudioOutputInput): StudioOutputRecord {
  const outputDir = getStudioOutputDir(sessionPath, outputId)
  const record = readStudioOutput(outputDir)
  if (!record) throw new Error(`Studio output not found: ${outputId}`)
  const metadata = { ...record.metadata, ...input, updatedAt: nowIso() } as StudioOutputMetadata
  delete (metadata as { html?: string }).html
  delete (metadata as { readme?: string }).readme
  if (input.html !== undefined) writeFileSync(record.entryPath, input.html, 'utf-8')
  if (input.readme !== undefined) writeFileSync(readmePath(outputDir), input.readme, 'utf-8')
  writeMetadata(outputDir, metadata)
  return { metadata, outputDir, entryPath: record.entryPath }
}

export function addStudioPage(sessionPath: string, outputId: string, input: AddStudioPageInput): StudioOutputRecord {
  const outputDir = getStudioOutputDir(sessionPath, outputId)
  const record = readStudioOutput(outputDir)
  if (!record) throw new Error(`Studio output not found: ${outputId}`)
  const id = assertSafeSegment(input.id ? slugifyStudioOutputId(input.id) : slugifyStudioOutputId(input.title), 'page id')
  const file = `pages/${id}.html`
  const now = nowIso()
  writeFileSync(join(outputDir, file), input.html ?? defaultHtml(input.title), 'utf-8')
  const pages = [...(record.metadata.pages ?? [])].filter(page => page.id !== id)
  pages.push({ id, title: input.title, file, createdAt: now, updatedAt: now })
  const metadata: StudioOutputMetadata = { ...record.metadata, pages, updatedAt: now, project: { kind: 'multi-page', title: record.metadata.title } }
  writeMetadata(outputDir, metadata)
  return { metadata, outputDir, entryPath: record.entryPath }
}

export function addStudioComponent(sessionPath: string, outputId: string, input: AddStudioComponentInput): StudioOutputRecord {
  const outputDir = getStudioOutputDir(sessionPath, outputId)
  const record = readStudioOutput(outputDir)
  if (!record) throw new Error(`Studio output not found: ${outputId}`)
  const id = assertSafeSegment(input.id ? slugifyStudioOutputId(input.id) : slugifyStudioOutputId(input.title), 'component id')
  const file = `components/${id}.html`
  const now = nowIso()
  const presetHtml = input.preset ? readStudioComponentHtml(record.metadata.skill ?? 'studio-prototype', input.preset) : undefined
  writeFileSync(join(outputDir, file), input.html ?? presetHtml ?? `<section data-studio-component="${id}"><h2>${input.title}</h2></section>\n`, 'utf-8')
  const components = [...(record.metadata.components ?? [])].filter(component => component.id !== id)
  components.push({ id, title: input.title, preset: input.preset, file, createdAt: now, updatedAt: now } satisfies StudioComponentRecord)
  const metadata: StudioOutputMetadata = { ...record.metadata, components, updatedAt: now }
  writeMetadata(outputDir, metadata)
  return { metadata, outputDir, entryPath: record.entryPath }
}

export function runStudioQuality(sessionPath: string, outputId: string): StudioOutputRecord {
  const outputDir = getStudioOutputDir(sessionPath, outputId)
  const record = readStudioOutput(outputDir)
  if (!record) throw new Error(`Studio output not found: ${outputId}`)
  const html = existsSync(record.entryPath) ? readFileSync(record.entryPath, 'utf-8') : ''
  const hasEmptyAction = /<(button|a)\b[^>]*>\s*<\/\1>/i.test(html)
  const hasAction = /<(button|a)\b[^>]*>\s*[^<\s][\s\S]*?<\/\1>/i.test(html)
  const hasResponsiveLayout = /@media|clamp\(|grid|flex/i.test(html)
  const hasUnsafeAsset = /(?:src|href)=["'](?:https?:)?\/\//i.test(html)
  const hasPlaceholder = /lorem ipsum|todo|placeholder|primary action|explore flow|studio output ready/i.test(html)
  const hasDesignSystem = Boolean(record.metadata.designSystem?.source || record.metadata.designSystem?.name || record.metadata.theme?.name)
  const checks = [
    { id: 'viewport', label: 'Responsive viewport', status: html.includes('name="viewport"') ? 'pass' : 'fail', detail: 'Page should include a responsive viewport meta tag.' },
    { id: 'semantic', label: 'Semantic structure', status: /<main\b/i.test(html) && /<(section|article)\b/i.test(html) ? 'pass' : 'warn', detail: 'Use main plus section/article regions for readable project structure.' },
    { id: 'headings', label: 'Heading hierarchy', status: /<h1\b/i.test(html) && /<h2\b/i.test(html) ? 'pass' : 'warn', detail: 'Include one clear H1 and supporting section headings.' },
    { id: 'actions', label: 'Action labels', status: hasEmptyAction ? 'fail' : hasAction ? 'pass' : 'warn', detail: 'Buttons and links should have visible labels and a clear CTA path.' },
    { id: 'responsive-layout', label: 'Responsive layout', status: hasResponsiveLayout ? 'pass' : 'warn', detail: 'Use responsive grid, flex, clamp, or media queries for multiple viewports.' },
    { id: 'placeholder-copy', label: 'Production copy', status: hasPlaceholder ? 'fail' : 'pass', detail: 'Avoid placeholder, TODO, generic CTA, or slop copy.' },
    { id: 'asset-safety', label: 'Relative assets', status: hasUnsafeAsset ? 'warn' : 'pass', detail: 'Prefer local relative assets for export-safe Studio outputs.' },
    { id: 'design-system', label: 'Design system metadata', status: hasDesignSystem ? 'pass' : 'warn', detail: 'Attach a design system or theme metadata for consistent Studio outputs.' },
  ] as const
  const passCount = checks.filter(check => check.status === 'pass').length
  const now = nowIso()
  const metadata: StudioOutputMetadata = { ...record.metadata, updatedAt: now, quality: { checkedAt: now, score: Math.round((passCount / checks.length) * 100), checks: checks.map(check => ({ ...check })) } }
  writeMetadata(outputDir, metadata)
  return { metadata, outputDir, entryPath: record.entryPath }
}

export function adoptStudioOutput(sessionPath: string, htmlPath: string, input: AdoptStudioOutputInput, sessionId: string): StudioOutputRecord {
  if (!ALLOWED_TYPES.has(input.type)) throw new Error(`Unsupported Studio output type: ${input.type}`)
  const dataRoot = join(sessionPath, 'data')
  const sourcePath = ensureInside(dataRoot, htmlPath, 'Adopt path must stay inside session data')
  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) throw new Error(`Adopt source not found: ${htmlPath}`)
  if (!/\.html?$/i.test(sourcePath)) throw new Error('Adopt source must be an HTML file')
  const id = assertSafeSegment(input.id ? slugifyStudioOutputId(input.id) : slugifyStudioOutputId(input.title), 'output id')
  const outputDir = getStudioOutputDir(sessionPath, id)
  ensureProjectDirs(outputDir)
  const createdAt = nowIso()
  const metadata: StudioOutputMetadata = {
    schema: SCHEMA,
    id,
    title: input.title,
    type: input.type,
    entryFile: 'index.html',
    skill: input.skill,
    status: 'ready',
    sourcePrompt: input.sourcePrompt ?? `Adopted from ${basename(sourcePath)}`,
    createdAt,
    updatedAt: createdAt,
    designSystem: input.designSystem,
    exports: [],
    sessionId,
    project: { kind: 'single-page', title: input.title },
    pages: [{ id: 'home', title: 'Home', file: 'index.html', createdAt, updatedAt: createdAt }],
    components: [],
    theme: input.theme,
  }
  copyFileSync(sourcePath, join(outputDir, 'index.html'))
  writeFileSync(readmePath(outputDir), input.readme ?? `# ${input.title}\n\nStudio output adopted from ${basename(sourcePath)}.\n`, 'utf-8')
  writeMetadata(outputDir, metadata)
  return { metadata, outputDir, entryPath: join(outputDir, 'index.html') }
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  return c >>> 0
})
function crc32(buf: Buffer): number { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function dosTime(date = new Date()): { time: number; date: number } { return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() } }
function makeZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0; const dt = dosTime()
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/\\/g, '/'))
    const crc = crc32(file.data)
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8); local.writeUInt16LE(dt.time, 10); local.writeUInt16LE(dt.date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(file.data.length, 18); local.writeUInt32LE(file.data.length, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30)
    locals.push(local, file.data)
    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10); central.writeUInt16LE(dt.time, 12); central.writeUInt16LE(dt.date, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(file.data.length, 20); central.writeUInt32LE(file.data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46)
    centrals.push(central); offset += local.length + file.data.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}
function collectFiles(root: string, dir = root): Array<{ name: string; data: Buffer }> {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    const rel = relative(root, path).replace(/\\/g, '/')
    if (statSync(path).isDirectory()) return entry === 'exports' ? [] : collectFiles(root, path)
    return [{ name: rel, data: readFileSync(path) }]
  })
}

export function exportStudioOutput(sessionPath: string, outputId: string, format: StudioExportFormat): StudioOutputRecord {
  const outputDir = getStudioOutputDir(sessionPath, outputId)
  const record = readStudioOutput(outputDir)
  if (!record) throw new Error(`Studio output not found: ${outputId}`)
  const exportsDir = join(outputDir, 'exports')
  mkdirSync(exportsDir, { recursive: true })
  let exportPath: string
  if (format === 'html') {
    exportPath = join(exportsDir, `${outputId}.html`)
    copyFileSync(record.entryPath, exportPath)
  } else if (format === 'zip') {
    exportPath = join(exportsDir, `${outputId}.zip`)
    writeFileSync(exportPath, makeZip(collectFiles(outputDir)))
  } else {
    throw new Error(`Unsupported export format: ${format}`)
  }
  const exportRecord: StudioExportRecord = { format, path: relative(outputDir, exportPath).replace(/\\/g, '/'), createdAt: nowIso() }
  const metadata: StudioOutputMetadata = { ...record.metadata, status: 'exported', updatedAt: nowIso(), exports: [...record.metadata.exports, exportRecord] }
  writeMetadata(outputDir, metadata)
  return { metadata, outputDir, entryPath: record.entryPath }
}