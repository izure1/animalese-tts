import type { SampleProvider } from '../interfaces'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { WavDecoder } from './WavDecoder'

export class FileSystemSampleProvider implements SampleProvider {
  // 한 번 디스크에서 읽은 샘플을 다시 I/O 하지 않도록 메모리에 캐싱합니다.
  private cache: Map<string, Float32Array> = new Map()
  private decoder: WavDecoder = new WavDecoder()

  constructor(private samplesDirectory: string, private targetSampleRate: number = 44100) { }

  public getSample(phoneme: string): Float32Array | undefined {
    // 1. 메모리 캐시 1차 확인 (캐시 히트)
    if (this.cache.has(phoneme)) {
      return this.cache.get(phoneme)
    }

    // 2. 파일 시스템 조회 (예: /sounds/ㅏ.wav)
    const filePath = path.join(this.samplesDirectory, `${phoneme}.wav`)

    try {
      if (fs.existsSync(filePath)) {
        // 동기적으로 파일을 읽어옵니다. (엔진 합성 단계에서 일괄 읽기)
        const fileBuffer = fs.readFileSync(filePath)

        // 16-bit PCM WAV 바이너리를 -> Float32Array 로 자체 디코딩
        const { buffer: floatArray, sampleRate } = this.decoder.decode(fileBuffer)
        const finalArray = this.resample(floatArray, sampleRate, this.targetSampleRate)

        // 캐시에 적재 (Miss 후 히트 보장)
        this.cache.set(phoneme, finalArray)
        return finalArray
      }
    } catch (e) {
      console.warn(`[FileSystemSampleProvider] 샘플 로드 실패: ${phoneme}`, e)
    }

    return undefined
  }

  public loadSample(phoneme: string, buffer: Float32Array): void {
    // FileSystem 모드에서도 외부에서 강제로 모의(스터빙) 주입이 필요할 수 있으므로 지원합니다.
    this.cache.set(phoneme, buffer)
  }

  // 지정한 폴더 내의 모든 .wav 파일을 스캔하여 캐시에 일괄 적재(Preload)합니다.
  public loadDirectory(directoryPath: string = this.samplesDirectory): void {
    if (!fs.existsSync(directoryPath)) {
      console.warn(`[FileSystemSampleProvider] 디렉토리를 찾을 수 없습니다: ${directoryPath}`)
      return
    }

    const files = fs.readdirSync(directoryPath)
    for (const file of files) {
      if (file.toLowerCase().endsWith('.wav')) {
        const phoneme = path.basename(file, path.extname(file))
        const filePath = path.join(directoryPath, file)
        try {
          const fileBuffer = fs.readFileSync(filePath)
          const { buffer: floatArray, sampleRate } = this.decoder.decode(fileBuffer)
          const finalArray = this.resample(floatArray, sampleRate, this.targetSampleRate)
          this.cache.set(phoneme, finalArray)
        } catch (e) {
          console.warn(`[FileSystemSampleProvider] 파일 로드 실패: ${file}`, e)
        }
      }
    }
  }

  private resample(buffer: Float32Array, sourceRate: number, targetRate: number): Float32Array {
    if (sourceRate === targetRate) return buffer

    const targetLength = Math.floor(buffer.length * targetRate / sourceRate)
    const resampled = new Float32Array(targetLength)
    const ratio = sourceRate / targetRate

    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio
      const leftIndex = Math.floor(srcIndex)
      const rightIndex = Math.min(leftIndex + 1, buffer.length - 1)
      const fraction = srcIndex - leftIndex

      resampled[i] = buffer[leftIndex] * (1 - fraction) + buffer[rightIndex] * fraction
    }

    return resampled
  }
}
