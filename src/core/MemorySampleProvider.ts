import { BaseSampleProvider } from './BaseSampleProvider'

/**
 * Sample provider that manages samples entirely in memory.
 */
export class MemorySampleProvider extends BaseSampleProvider {
  constructor(targetSampleRate: number, maxRetries: number = 3) {
    super(targetSampleRate, maxRetries)
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    return undefined
  }
}
