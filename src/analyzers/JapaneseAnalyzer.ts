import type { TextAnalyzer, PhonemeToken } from '../interfaces'

export class JapaneseAnalyzer implements TextAnalyzer {
  public analyze(text: string): PhonemeToken[][] {
    const phonemes: PhonemeToken[][] = []

    for (const char of text.split('')) {
      if (/[\u3040-\u309F\u30A0-\u30FF]/.test(char)) {
        phonemes.push([{ phoneme: char, mergeWithNext: false }])
      } else if (/[a-zA-Z]/.test(char)) {
        phonemes.push([{ phoneme: char.toLowerCase(), mergeWithNext: false }])
      }
    }

    return phonemes
  }
}
