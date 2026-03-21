import * as fs from 'node:fs/promises'
import { constants } from 'node:fs'
import * as path from 'node:path'
import { WavDecoder } from './WavDecoder'
import { BaseSampler, SamplerOptions } from './BaseSampler'

export interface FileSystemSamplerOptions extends SamplerOptions {
  samplesDirectory: string;
}

/**
 * Sample provider that fetches audio files from the local file system.
 */
export class FileSystemSampler extends BaseSampler {
  private readonly decoder: WavDecoder = new WavDecoder()
  private readonly samplesDirectory: string;

  constructor(options: FileSystemSamplerOptions) {
    super(options)
    this.samplesDirectory = options.samplesDirectory;
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    const filePath = path.join(this.samplesDirectory, `${phoneme}.wav`)

    try {
      await fs.access(filePath, constants.R_OK)
      const fileBuffer = await fs.readFile(filePath)
      const { buffer: floatArray, sampleRate } = this.decoder.decode(fileBuffer)

      if (sampleRate !== this.sampleRate) {
        throw new Error(`[FileSystemSampler] 샘플레이트 불일치: 기대값 ${this.sampleRate}, 실제값 ${sampleRate} (${filePath})`)
      }

      // resample is still called just in case but we threw error if they don't match.
      // Doing resample doesn't hurt.
      const finalArray = this.resample(floatArray, sampleRate, this.sampleRate)
      return finalArray
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        return undefined
      }
      console.warn(`[FileSystemSampler] 샘플 로드 실패: ${phoneme}`, e)
      throw e
    }
  }

  /**
   * Scans the specified directory and preloads all .wav files into the cache.
   * @param directoryPath The path to the directory containing .wav files.
   */
  public async loadDirectory(directoryPath: string = this.samplesDirectory): Promise<void> {
    try {
      await fs.access(directoryPath, constants.R_OK)
    } catch (e) {
      console.warn(`[FileSystemSampler] 디렉토리를 찾을 수 없습니다: ${directoryPath}`)
      return
    }

    const files = await fs.readdir(directoryPath)

    for (const file of files) {
      if (file.toLowerCase().endsWith('.wav')) {
        const phoneme = path.basename(file, path.extname(file))
        const filePath = path.join(directoryPath, file)
        try {
          const fileBuffer = await fs.readFile(filePath)
          const { buffer: floatArray, sampleRate } = this.decoder.decode(fileBuffer)

          if (sampleRate !== this.sampleRate) {
            throw new Error(`[FileSystemSampler] 디렉토리 샘플레이트 불일치: 기대값 ${this.sampleRate}, 실제값 ${sampleRate} (${filePath})`)
          }

          const finalArray = this.resample(floatArray, sampleRate, this.sampleRate)
          await this.loadSample(phoneme, finalArray, sampleRate)
        } catch (e) {
          console.warn(`[FileSystemSampler] 파일 로드 실패: ${file}`, e)
          throw e
        }
      }
    }
  }
}
