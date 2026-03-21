export interface PhonemeToken {
  phoneme: string;
  mergeWithNext: boolean;
}

export interface TextAnalyzer {
  analyze(text: string): PhonemeToken[]
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

export interface SynthesisOutput {
  phoneme: string;
  pitch: number;
  buffer: Float32Array;
}
