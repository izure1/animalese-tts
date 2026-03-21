import { BaseSampleProvider } from './BaseSampleProvider'

export class MemorySampleProvider extends BaseSampleProvider {
  constructor(targetSampleRate: number) {
    super(targetSampleRate)
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    return undefined
  }
}
