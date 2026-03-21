import type { AudioEffect } from '../interfaces'

export class GranularPitchShifter implements AudioEffect {
  constructor(private speedRatio: number = 1.0) { }

  public apply(buffer: Float32Array, pitchRatio: number): Float32Array {
    if (pitchRatio === 1.0 && this.speedRatio === 1.0) return buffer

    // 1. 피치 시프팅 (리샘플링)
    const resampledLength = Math.floor(buffer.length / pitchRatio)
    const resampled = new Float32Array(resampledLength)

    for (let i = 0; i < resampledLength; i++) {
      const srcIndex = i * pitchRatio
      const srcInt = Math.floor(srcIndex)
      const srcFrac = srcIndex - srcInt
      const v1 = buffer[srcInt] || 0
      const v2 = buffer[srcInt + 1] || 0
      resampled[i] = v1 + srcFrac * (v2 - v1)
    }

    // 2. 재생 시간(Speed) 조절 — 리샘플된 유효 데이터 기준으로 출력 길이 결정
    const outLength = Math.floor(resampledLength / this.speedRatio)
    const finalBuffer = new Float32Array(outLength)

    for (let i = 0; i < outLength; i++) {
      const srcIndex = i * this.speedRatio
      const srcInt = Math.floor(srcIndex)
      const srcFrac = srcIndex - srcInt
      const v1 = resampled[srcInt] || 0
      const v2 = resampled[srcInt + 1] || 0
      finalBuffer[i] = v1 + srcFrac * (v2 - v1)
    }

    // 3. 지지직(팝핑) 노이즈를 방지하기 위한 페이드 인/아웃 (Fade in/out) 엔벨로프
    const fadeSamples = Math.min(256, Math.floor(outLength / 4))

    for (let i = 0; i < fadeSamples; i++) {
      const fadeVol = i / fadeSamples
      finalBuffer[i] *= fadeVol
      finalBuffer[outLength - 1 - i] *= fadeVol
    }

    return finalBuffer
  }
}
