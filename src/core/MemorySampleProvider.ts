import type { SampleProvider } from '../interfaces'

export class MemorySampleProvider implements SampleProvider {
  private storage: Map<string, Float32Array> = new Map()

  public getSample(phoneme: string): Float32Array | undefined {
    return this.storage.get(phoneme)
  }

  public loadSample(phoneme: string, buffer: Float32Array): void {
    this.storage.set(phoneme, buffer)
  }
}
