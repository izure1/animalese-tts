import { BaseSampleProvider } from './BaseSampleProvider'
import { WavDecoder } from './WavDecoder'

export class WebSampleProvider extends BaseSampleProvider {
  private readonly decoder: WavDecoder = new WavDecoder()

  /**
   * @param baseUrl 웹 음원 폴더 주소 (예: "https://example.com/sounds")
   * @param targetSampleRate 목표 샘플레이트
   */
  constructor(private baseUrl: string, targetSampleRate: number) {
    super(targetSampleRate)
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(phoneme)}.wav`
    return this.fetchFromUrl(url)
  }

  /**
   * 특정 URL에서 WAV 파일을 가져와 특정 음소로 캐싱합니다.
   * @param phoneme 등록할 음소 기호
   * @param url WAV 파일의 웹 주소 경로
   */
  public async loadSampleFromUrl(phoneme: string, url: string): Promise<void> {
    const floatArray = await this.fetchFromUrl(url)
    if (floatArray) {
      // fetchFromUrl 내부에서 targetSampleRate 검증 및 리샘플링을 거쳤으므로,
      // loadSample 호출 시에는 타겟 샘플레이트를 함께 전달하여 추가 에러가 발생하지 않도록 합니다.
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
      const fileBuffer = Buffer.from(arrayBuffer)

      const { buffer: floatArray, sampleRate } = this.decoder.decode(fileBuffer)

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
