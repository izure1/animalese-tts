import type { TextAnalyzer, PhonemeToken } from '../interfaces'

export class EnglishAnalyzer implements TextAnalyzer {
  public analyze(text: string): PhonemeToken[] {
    const phonemes: PhonemeToken[] = []

    // 1. 대소문자 정규화 (소문자로 통일)
    const normalizedText = text.toLowerCase()

    // 2. 문자 단위 파싱
    for (const char of normalizedText.split('')) {
      // 영문 알파벳(a-z)만 음소로 취급하며, 특수문자나 띄어쓰기는 배제합니다.
      // (필요에 따라 띄어쓰기를 묵음 버퍼용 'space' 등의 특수 음소로 뺄 수도 있습니다)
      if (/[a-z]/.test(char)) {
        phonemes.push({ phoneme: char, mergeWithNext: false })
      }
    }

    return phonemes
  }
}
