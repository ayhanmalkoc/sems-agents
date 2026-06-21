export type StudioOutputType = 'prototype' | 'landing-page' | 'dashboard' | 'deck' | 'report' | 'image-prompt' | 'video-prompt'
export type StudioOutputStatus = 'draft' | 'ready' | 'exported'
export type StudioExportFormat = 'html' | 'zip' | 'pdf'

export interface StudioExportRecord {
  format: StudioExportFormat
  path: string
  createdAt: string
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
}

export interface UpdateStudioOutputInput {
  title?: string
  status?: StudioOutputStatus
  skill?: string
  sourcePrompt?: string
  html?: string
  readme?: string
  designSystem?: { source: string; name?: string }
}

export interface StudioOutputRecord {
  metadata: StudioOutputMetadata
  outputDir: string
  entryPath: string
}
