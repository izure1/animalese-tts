export interface TextAnalyzer {
  analyze(text: string): string[]
}

export interface SampleProvider {
  getSample(phoneme: string): Float32Array | undefined
  loadSample(phoneme: string, buffer: Float32Array): void
}

export interface AudioEffect {
  apply(buffer: Float32Array, pitchRatio: number): Float32Array
}

export interface PlaybackStrategy {
  play(buffer: Float32Array): Promise<void>
}
