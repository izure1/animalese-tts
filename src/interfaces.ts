export interface PhonemeToken {
  phoneme: string;
  mergeWithNext: boolean;
}

export interface TextAnalyzer {
  analyze(text: string): PhonemeToken[][]
}

export interface SampleProvider {
  getSample(phoneme: string): Promise<Float32Array | undefined>
  loadSample(phoneme: string, buffer: Float32Array, sampleRate: number): Promise<void>
}

export interface AudioEffect {
  apply(buffer: Float32Array, pitchRatio: number): Float32Array
}

export interface PlaybackStrategy {
  play(buffer: Float32Array): Promise<void>
}

export interface SynthesisOutput {
  char: string;
  phoneme: string;
  pitch: number;
  buffer: Float32Array | Int16Array;
}
