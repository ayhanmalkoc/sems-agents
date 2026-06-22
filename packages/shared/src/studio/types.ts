export type StudioOutputType = 'prototype' | 'landing-page' | 'dashboard' | 'deck' | 'report' | 'image-prompt' | 'video-prompt'
export type StudioOutputStatus = 'draft' | 'ready' | 'exported'
export type StudioExportFormat = 'html' | 'zip'

export interface StudioExportRecord {
  format: StudioExportFormat
  path: string
  createdAt: string
}

export interface StudioPageRecord {
  id: string
  title: string
  file: string
  createdAt: string
  updatedAt: string
}

export interface StudioComponentRecord {
  id: string
  title: string
  preset?: string
  file: string
  createdAt: string
  updatedAt: string
}

export interface StudioThemeRecord {
  name?: string
  tokens?: Record<string, string>
}

export interface StudioQualityCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface StudioQualityReport {
  checkedAt: string
  score: number
  checks: StudioQualityCheck[]
}

export interface StudioOutputMetadata {
  schema: 'craft-studio-output/v1'
  id: string
  title: string
  type: StudioOutputType
  entryFile: string
  skill?: string
  status: StudioOutputStatus
  sourcePrompt?: string
  createdAt: string
  updatedAt: string
  designSystem?: { source: string; name?: string }
  exports: StudioExportRecord[]
  sessionId: string
  project?: { kind: 'single-page' | 'multi-page'; title: string }
  templateId?: string
  pages?: StudioPageRecord[]
  components?: StudioComponentRecord[]
  theme?: StudioThemeRecord
  quality?: StudioQualityReport
}

export interface CreateStudioOutputInput {
  id?: string
  title: string
  type: StudioOutputType
  entryFile?: string
  skill?: string
  sourcePrompt?: string
  html?: string
  readme?: string
  designSystem?: { source: string; name?: string }
  template?: string
  templateId?: string
  theme?: StudioThemeRecord
}

export interface UpdateStudioOutputInput {
  title?: string
  status?: StudioOutputStatus
  skill?: string
  sourcePrompt?: string
  html?: string
  readme?: string
  designSystem?: { source: string; name?: string }
  theme?: StudioThemeRecord
}

export interface AdoptStudioOutputInput {
  id?: string
  title: string
  type: StudioOutputType
  skill?: string
  sourcePrompt?: string
  readme?: string
  designSystem?: { source: string; name?: string }
  theme?: StudioThemeRecord
}

export interface CreateStudioProjectInput extends CreateStudioOutputInput {
  kind?: 'single-page' | 'multi-page'
}

export interface AddStudioPageInput {
  id?: string
  title: string
  html?: string
}

export interface AddStudioComponentInput {
  id?: string
  title: string
  preset?: string
  html?: string
}

export interface StudioTemplateDefinition {
  id: string
  title: string
  description: string
  type: StudioOutputType
  skill: string
  templatePath: string
  componentPaths: string[]
  tags: string[]
}

export interface StudioOutputRecord {
  metadata: StudioOutputMetadata
  outputDir: string
  entryPath: string
}