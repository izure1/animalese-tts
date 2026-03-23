import type { PlaybackStrategy } from '../interfaces'

/**
 * Playback strategy for browser environments using the Web Audio API.
 */
export class BrowserPlayer implements PlaybackStrategy {
  private audioContext: AudioContext
  private sampleRate: number

  constructor(sampleRate: number) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) {
      throw new Error('이 브라우저는 Web Audio API를 지원하지 않습니다.')
    }

    this.audioContext = new AudioContextClass({ sampleRate })
    this.sampleRate = sampleRate
  }

  /**
   * Plays the provided audio buffer through the browser's AudioContext.
   * @param bufferData The audio data to play.
   */
  public async play(bufferData: Float32Array): Promise<void> {
    const audioBuffer = this.audioContext.createBuffer(1, bufferData.length, this.sampleRate)
    audioBuffer.copyToChannel(bufferData as any, 0)

    const sourceNode = this.audioContext.createBufferSource()
    sourceNode.buffer = audioBuffer
    sourceNode.playbackRate.value = 1.0
    sourceNode.connect(this.audioContext.destination)

    return new Promise((resolve) => {
      sourceNode.onended = () => resolve()
      sourceNode.start(0)
    })
  }

  /**
   * Merges multiple audio buffers into one and plays the result.
   * @param buffers Array of Float32Array audio chunks.
   */
  public async drainAndPlay(buffers: Float32Array[]): Promise<void> {
    const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
      merged.set(buf, offset)
      offset += buf.length
    }
    return this.play(merged)
  }
}
