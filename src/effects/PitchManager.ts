import type { AudioEffect } from '../interfaces'

export interface PitchManagerOptions {
  pitch?: number;
  speed?: number;
  randomness?: number;
  melodyRate?: number;
  melodyAmplitude?: number;
}

/**
 * Audio effect that manages pitch and speed adjustment for synthesized speech.
 */
export class PitchManager implements AudioEffect {
  public readonly pitch: number;
  public readonly speed: number;
  public readonly randomness: number;
  public readonly melodyRate: number;
  public readonly melodyAmplitude: number;

  constructor(options: PitchManagerOptions = {}) {
    this.pitch = options.pitch ?? 1.0;
    this.speed = options.speed ?? 1.0;
    this.randomness = options.randomness ?? 0.0;
    this.melodyRate = options.melodyRate ?? 0.05;
    this.melodyAmplitude = options.melodyAmplitude ?? 0.1;
  }

  public calculatePitch(charIndex: number): number {
    let currentPitch = this.pitch;

    const stepDegrees = 360 * this.melodyRate;
    const radianStep = stepDegrees * (Math.PI / 180);

    currentPitch += Math.sin(charIndex * radianStep) * this.melodyAmplitude;

    return currentPitch + (Math.random() - 0.5) * this.randomness;
  }

  public apply(buffer: Float32Array, pitchRatio: number): Float32Array {
    if (pitchRatio === 1.0 && this.speed === 1.0) return buffer
    if (buffer.length === 0) return buffer

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

    const targetLength = Math.floor(buffer.length / this.speed)
    const finalBuffer = new Float32Array(targetLength)

    for (let i = 0; i < targetLength; i++) {
      finalBuffer[i] = i < pitchedLength ? pitchedBuffer[i] : 0
    }

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
