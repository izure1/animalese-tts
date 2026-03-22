import { BaseSampler, SamplerOptions } from './BaseSampler'
import { WavDecoder } from './WavDecoder'

export interface WebSamplerOptions extends SamplerOptions {
  baseUrl: string;
}

/**
 * Sample provider that fetches audio files over HTTP/HTTPS.
 */
export class WebSampler extends BaseSampler {
  private readonly decoder: WavDecoder = new WavDecoder()
  private readonly baseUrl: string;

  /**
   * @param options 샘플 프로바이더 옵션 (baseUrl 포함)
   */
  constructor(options: WebSamplerOptions) {
    super(options)
    this.baseUrl = options.baseUrl;
  }

  protected getCacheKey(phoneme: string): string {
    return `${this.baseUrl}_${phoneme}`;
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
      await this.loadSample(phoneme, floatArray, this.sampleRate)
    }
  }

  private async fetchFromUrl(url: string): Promise<Float32Array | undefined> {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 404) {
          return undefined
        }
        throw new Error(`[WebSampler] HTTP 에러: ${response.status} ${response.statusText} (${url})`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const { buffer: floatArray, sampleRate } = this.decoder.decode(arrayBuffer)

      if (sampleRate !== this.sampleRate) {
        throw new Error(`[WebSampler] 샘플레이트 불일치: 기대값 ${this.sampleRate}, 실제값 ${sampleRate} (${url})`)
      }

      const finalArray = this.resample(floatArray, sampleRate, this.sampleRate)
      return finalArray
    } catch (e) {
      console.warn(`[WebSampler] 샘플 로드 실패: ${url}`, e)
      throw e
    }
  }
}
