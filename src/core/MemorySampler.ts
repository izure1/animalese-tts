import { BaseSampler, SamplerOptions } from './BaseSampler'

/**
 * Sample provider that manages samples entirely in memory.
 */
export class MemorySampler extends BaseSampler {
  constructor(options: SamplerOptions) {
    super(options)
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    return undefined
  }
}
