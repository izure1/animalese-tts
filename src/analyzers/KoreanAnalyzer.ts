import type { PhonemeToken } from '../interfaces'
import { DecomposingAnalyzer } from './DecomposingAnalyzer'

/**
 * Text analyzer implementation for the Korean language.
 * Decomposes Korean characters into their constituent phonemes.
 */
export class KoreanAnalyzer extends DecomposingAnalyzer {
  private readonly CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
  private readonly JUNGSEONG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
  private readonly JONGSEONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

  protected decompose(char: string): PhonemeToken[] {
    const code = char.charCodeAt(0) - 0xAC00
    if (code < 0 || code > 11171) {
      return [{ phoneme: char, mergeWithNext: false }]
    }

    const jongIndex = code % 28
    const jungIndex = ((code - jongIndex) / 28) % 21
    const choIndex = Math.floor((code - jongIndex) / 28 / 21)

    const result: PhonemeToken[] = []

    if (this.CHOSEONG[choIndex] !== 'ㅇ') {
      result.push({ phoneme: this.CHOSEONG[choIndex], mergeWithNext: true })
    }

    if (this.JONGSEONG[jongIndex] !== '') {
      result.push({ phoneme: this.JUNGSEONG[jungIndex], mergeWithNext: true })
      result.push({ phoneme: this.JONGSEONG[jongIndex], mergeWithNext: false })
    } else {
      result.push({ phoneme: this.JUNGSEONG[jungIndex], mergeWithNext: false })
    }

    return result
  }
}
