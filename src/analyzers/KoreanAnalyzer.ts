import type { TextAnalyzer } from '../interfaces'

export class KoreanAnalyzer implements TextAnalyzer {
  private readonly CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
  private readonly JUNGSEONG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
  private readonly JONGSEONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

  public analyze(text: string): string[] {
    const phonemes: string[] = []
    for (const char of text.split('')) {
      phonemes.push(...this.decompose(char))
    }
    return phonemes
  }

  private decompose(char: string): string[] {
    const code = char.charCodeAt(0) - 0xAC00
    if (code < 0 || code > 11171) {
      return [char]
    }

    const jongIndex = code % 28
    const jungIndex = ((code - jongIndex) / 28) % 21
    const choIndex = Math.floor((code - jongIndex) / 28 / 21)

    const result: string[] = []

    if (this.CHOSEONG[choIndex] !== 'ㅇ') {
      result.push(this.CHOSEONG[choIndex])
    }

    result.push(this.JUNGSEONG[jungIndex])

    if (this.JONGSEONG[jongIndex] !== '') {
      result.push(this.JONGSEONG[jongIndex])
    }

    return result
  }
}
