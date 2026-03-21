import type { PlaybackStrategy } from '../interfaces'

export class BrowserPlaybackStrategy implements PlaybackStrategy {
  private audioContext: AudioContext

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) {
      throw new Error('이 브라우저는 Web Audio API를 지원하지 않습니다.')
    }

    this.audioContext = new AudioContextClass()
  }

  public async play(bufferData: Float32Array): Promise<void> {
    const sampleRate = 44100
    const audioBuffer = this.audioContext.createBuffer(1, bufferData.length, sampleRate)
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
}
