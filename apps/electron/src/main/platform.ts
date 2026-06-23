/**
 * Electron platform factory — creates PlatformServices from Electron APIs.
 *
 * Extracted from main/index.ts so it can be injected into bootstrapServer()
 * without duplicating construction logic.
 */

import type { PlatformServices } from '../runtime/platform'

export interface ElectronPlatformOptions {
  app: Electron.App
  nativeImage: typeof import('electron').nativeImage
  BrowserWindow: typeof import('electron').BrowserWindow
  shell: typeof import('electron').shell
  nativeTheme: typeof import('electron').nativeTheme
  logger: PlatformServices['logger']
  isDebugMode: boolean
  getLogFilePath?: () => string | undefined
  captureError?: (error: Error) => void
}

export function createElectronPlatform(opts: ElectronPlatformOptions): PlatformServices {
  const { app, nativeImage, shell, nativeTheme, logger, BrowserWindow } = opts

  return {
    appRootPath: app.isPackaged ? app.getAppPath() : process.cwd(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
    appVersion: app.getVersion(),
    openExternal: (url) => shell.openExternal(url),
    openPath: (p) => shell.openPath(p).then(() => {}),
    showItemInFolder: (p) => shell.showItemInFolder(p),
    quit: () => app.quit(),
    systemDarkMode: () => nativeTheme.shouldUseDarkColors,
    htmlToPdf: async ({ htmlPath, outputPath }) => {
      const window = new BrowserWindow({
        show: false,
        width: 1440,
        height: 1080,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      })
      try {
        await window.loadFile(htmlPath)
        const data = await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
        const { mkdir, writeFile } = await import('node:fs/promises')
        const { dirname } = await import('node:path')
        await mkdir(dirname(outputPath), { recursive: true })
        await writeFile(outputPath, data)
      } finally {
        if (!window.isDestroyed()) window.destroy()
      }
    },
    imageProcessor: {
      async getMetadata(buffer) {
        const img = nativeImage.createFromBuffer(buffer)
        if (img.isEmpty()) return null
        const { width, height } = img.getSize()
        return (width && height) ? { width, height } : null
      },
      async process(input, processOpts = {}) {
        const img = typeof input === 'string'
          ? nativeImage.createFromPath(input)
          : nativeImage.createFromBuffer(input)
        if (img.isEmpty()) throw new Error('Invalid image input')

        let result = img
        if (processOpts.resize) {
          const { width: tw, height: th } = processOpts.resize
          const fit = processOpts.fit ?? 'inside'
          if (fit === 'inside') {
            const { width: sw, height: sh } = result.getSize()
            const scale = Math.min(tw / sw, th / sh, 1)
            result = result.resize({
              width: Math.round(sw * scale),
              height: Math.round(sh * scale),
            })
          } else {
            result = result.resize({ width: tw, height: th })
          }
        }
        return (processOpts.format === 'jpeg')
          ? result.toJPEG(processOpts.quality ?? 90)
          : result.toPNG()
      },
    },
    logger,
    isDebugMode: opts.isDebugMode,
    getLogFilePath: opts.getLogFilePath,
    captureError: opts.captureError,
  }
}
