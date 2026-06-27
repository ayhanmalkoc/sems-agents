export function isAbsoluteFilePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('~/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\')
}

export function resolveChatFilePath(path: string, baseDir?: string | null): string {
  if (isAbsoluteFilePath(path)) return path
  if (!baseDir) return path
  const cleanedBase = baseDir.replace(/[\\/]+$/, '')
  const cleanedPath = path.replace(/^\.\//, '')
  return `${cleanedBase}/${cleanedPath}`
}