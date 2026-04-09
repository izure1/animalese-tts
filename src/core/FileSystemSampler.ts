import * as fs from 'node:fs/promises'
import { constants } from 'node:fs'
import { BaseSampler, SpriteMap } from './BaseSampler'

/**
 * Sample provider that fetches audio files from the local file system.
 */
export class FileSystemSampler extends BaseSampler {
  private readonly audioFilePath: string

  constructor(
    audioFilePath: string,
    sprites: SpriteMap | string[],
    options: {
      maxRetries?: number
      silenceThreshold?: number
      minSilenceDurationMs?: number
    } = {}
  ) {
    super(sprites, options)
    this.audioFilePath = audioFilePath
  }

  protected getCacheKey(phoneme: string): string {
    return `${this.audioFilePath}_${phoneme}`
  }

  protected async fetchBuffer(): Promise<Uint8Array> {
    try {
      await fs.access(this.audioFilePath, constants.R_OK)
    } catch {
      throw new Error(`[FileSystemSampler] 파일을 찾을 수 없거나 접근 불가능합니다: ${this.audioFilePath}`)
    }
    return fs.readFile(this.audioFilePath)
  }
}
