import type { AudioEffect } from '../interfaces'

export class GranularPitchShifter implements AudioEffect {
  constructor(private speedRatio: number = 1.0) { }

  public apply(buffer: Float32Array, pitchRatio: number): Float32Array {
    if (pitchRatio === 1.0 && this.speedRatio === 1.0) return buffer
    if (buffer.length === 0) return buffer

    // 1. 피치 시프팅 (단일 리샘플링)
    // 피치를 높이면 자연스럽게 재생 길이도 1/pitchRatio 만큼 압축됩니다.
    const pitchedLength = Math.floor(buffer.length / pitchRatio)
    const pitchedBuffer = new Float32Array(pitchedLength)

    for (let i = 0; i < pitchedLength; i++) {
      const srcIndex = i * pitchRatio
      const srcInt = Math.floor(srcIndex)
      const srcFrac = srcIndex - srcInt
      const v1 = buffer[srcInt] || 0
      const v2 = buffer[srcInt + 1] || 0
      pitchedBuffer[i] = v1 + srcFrac * (v2 - v1)
    }

    // 2. 재생 시간(Speed) 강제 조절 (Truncate / Pad)
    // 수학적 모순을 일으키지 않고 속도를 독립시키려면 '배열의 최종 길이를 물리적으로 지정'해야 합니다.
    // 타겟 길이를 지정한 후, 피치 변환된 샘플을 앞에서부터 채워 넣고 남으면 자르거나(Truncate), 모자라면 무음(Padding)을 추가합니다.
    const targetLength = Math.floor(buffer.length / this.speedRatio)
    const finalBuffer = new Float32Array(targetLength)

    for (let i = 0; i < targetLength; i++) {
      finalBuffer[i] = i < pitchedLength ? pitchedBuffer[i] : 0
    }

    // 3. 지지직(팝핑) 노이즈를 방지하기 위한 페이드 인/아웃 (Fade in/out) 엔벨로프
    // 잘라내거나 무음이 끝나는 실제 사운드 구간(endIdx)을 기준으로 부드럽게 감쇠시킵니다.
    const fadeSamples = Math.min(256, Math.floor(pitchedLength / 4))
    const endIdx = Math.min(targetLength, pitchedLength)

    for (let i = 0; i < fadeSamples; i++) {
      if (i < targetLength) {
        finalBuffer[i] *= (i / fadeSamples)
      }
      const outIdx = endIdx - 1 - i
      if (outIdx >= 0 && outIdx < targetLength) {
        finalBuffer[outIdx] *= (i / fadeSamples)
      }
    }

    return finalBuffer
  }
}
