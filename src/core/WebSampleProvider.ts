import { BaseSampleProvider } from './BaseSampleProvider'
import { WavDecoder } from './WavDecoder'

/**
 * Sample provider that fetches audio files over HTTP/HTTPS.
 */
export class WebSampleProvider extends BaseSampleProvider {
  private readonly decoder: WavDecoder = new WavDecoder()

  /**
   * @param baseUrl 웹 음원 폴더 주소 (예: "https://example.com/sounds")
   * @param targetSampleRate 목표 샘플레이트
   * @param maxRetries 최대 실패 재시도 횟수
   */
  constructor(private baseUrl: string, targetSampleRate: number, maxRetries: number = 3) {
    super(targetSampleRate, maxRetries)
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(phoneme)}.wav`
    return this.fetchFromUrl(url)
  }

  /**
   * Fetches a WAV file from a specific URL and caches it for the given phoneme.
   * @param phoneme The phoneme to associate with the loaded audio.
   * @param url The URL path to the WAV file.
   */
  public async loadSampleFromUrl(phoneme: string, url: string): Promise<void> {
    const floatArray = await this.fetchFromUrl(url)
    if (floatArray) {
      await this.loadSample(phoneme, floatArray, this.targetSampleRate)
    }
  }

  private async fetchFromUrl(url: string): Promise<Float32Array | undefined> {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 404) {
          return undefined
        }
        throw new Error(`[WebSampleProvider] HTTP 에러: ${response.status} ${response.statusText} (${url})`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const { buffer: floatArray, sampleRate } = this.decoder.decode(arrayBuffer)

      if (sampleRate !== this.targetSampleRate) {
        throw new Error(`[WebSampleProvider] 샘플레이트 불일치: 기대값 ${this.targetSampleRate}, 실제값 ${sampleRate} (${url})`)
      }

      const finalArray = this.resample(floatArray, sampleRate, this.targetSampleRate)
      return finalArray
    } catch (e) {
      console.warn(`[WebSampleProvider] 샘플 로드 실패: ${url}`, e)
      throw e
    }
  }
}
