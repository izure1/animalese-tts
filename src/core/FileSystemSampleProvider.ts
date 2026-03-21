import type { SampleProvider } from '../interfaces'
import * as fs from 'node:fs'
import * as path from 'node:path'

export class FileSystemSampleProvider implements SampleProvider {
  // 한 번 디스크에서 읽은 샘플을 다시 I/O 하지 않도록 메모리에 캐싱합니다.
  private cache: Map<string, Float32Array> = new Map()

  constructor(private samplesDirectory: string) { }

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
        const floatArray = this.decodeWAV(fileBuffer)

        // 캐시에 적재 (Miss 후 히트 보장)
        this.cache.set(phoneme, floatArray)
        return floatArray
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
          const floatArray = this.decodeWAV(fileBuffer)
          this.cache.set(phoneme, floatArray)
        } catch (e) {
          console.warn(`[FileSystemSampleProvider] 파일 로드 실패: ${file}`, e)
        }
      }
    }
  }

  // 외부 파서(ffmpeg 등) 없이 순수 타입스크립트로 16-bit PCM 파싱
  private decodeWAV(buffer: Buffer): Float32Array {
    let numChannels = 1
    let dataOffset = 44
    let dataSize = 0

    // WAV 기본 구조 탐색 (RIFF 헤더 이후 12바이트부터 청크 시작)
    let searchOffset = 12
    while (searchOffset < buffer.length - 8) {
      const chunkId = buffer.toString('ascii', searchOffset, searchOffset + 4)
      const chunkSize = buffer.readUInt32LE(searchOffset + 4)

      if (chunkId === 'fmt ') {
        // fmt 청크의 2바이트 위치가 채널 수 (1=Mono, 2=Stereo)
        numChannels = buffer.readUInt16LE(searchOffset + 10)
      } else if (chunkId === 'data') {
        dataOffset = searchOffset + 8
        dataSize = chunkSize
        break // 오디오 데이터 청크를 찾았으므로 탐색 종료
      }

      searchOffset += 8 + chunkSize
    }

    // 대비책: data 청크를 스펙대로 못 찾았을 경우 기본값 적용
    if (dataSize === 0) {
      dataOffset = 44
      numChannels = buffer.readUInt16LE(22)
      dataSize = buffer.length - 44
    }

    const numSamples = Math.floor(dataSize / (2 * numChannels))
    const floatArray = new Float32Array(numSamples)

    let offset = dataOffset
    for (let i = 0, len = numSamples; i < len; i++) {
      let sum = 0
      for (let ch = 0; ch < numChannels; ch++) {
        // 안전 장치: 버퍼 범위를 넘어가려 하면 중단
        if (offset >= buffer.length - 1) break
        const int16 = buffer.readInt16LE(offset)
        sum += int16 < 0 ? int16 / 32768.0 : int16 / 32767.0
        offset += 2
      }
      floatArray[i] = sum / numChannels
    }

    return floatArray
  }
}
