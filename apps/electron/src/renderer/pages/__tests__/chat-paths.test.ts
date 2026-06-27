import { describe, expect, it } from 'bun:test'
import { isAbsoluteFilePath, resolveChatFilePath } from '../chat-paths'

describe('chat file path resolution', () => {
  it('treats Windows drive paths as absolute', () => {
    expect(isAbsoluteFilePath('C:/Users/malko/file.wav')).toBe(true)
    expect(isAbsoluteFilePath('C:\\Users\\malko\\file.wav')).toBe(true)
  })

  it('does not prefix Windows absolute paths with workspace root', () => {
    expect(resolveChatFilePath('C:/Users/malko/file.wav', 'C:/Users/malko/.craft-agent/workspaces/my-workspace')).toBe('C:/Users/malko/file.wav')
  })

  it('resolves relative paths against the base directory', () => {
    expect(resolveChatFilePath('data/file.txt', 'C:/repo')).toBe('C:/repo/data/file.txt')
  })
})