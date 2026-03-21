/**
 * A lightweight 16-bit PCM WAV decoder implemented in pure TypeScript.
 * Parses audio buffers without relying on external ffmpeg libraries.
 */
export class WavDecoder {
  /**
   * Decodes a WAV buffer into a Float32Array and retrieves its sample rate.
   * @param buffer The input array buffer containing WAV data.
   * @returns An object containing the decoded Float32Array and sample rate.
   */
  public decode(buffer: ArrayBuffer | Uint8Array): { buffer: Float32Array, sampleRate: number } {
    let arrayBuffer = buffer instanceof Uint8Array ? buffer.buffer : buffer
    let byteOffset = buffer instanceof Uint8Array ? buffer.byteOffset : 0
    let byteLength = buffer.byteLength
    const dataView = new DataView(arrayBuffer, byteOffset, byteLength)
    const uint8Array = new Uint8Array(arrayBuffer, byteOffset, byteLength)

    let numChannels = 1
    let sampleRate = 44100
    let dataOffset = 44
    let dataSize = 0

    // WAV 기본 구조 탐색 (RIFF 헤더 이후 12바이트부터 청크 시작)
    let searchOffset = 12
    while (searchOffset < byteLength - 8) {
      let chunkId = ''
      for (let i = 0; i < 4; i++) chunkId += String.fromCharCode(uint8Array[searchOffset + i])
      const chunkSize = dataView.getUint32(searchOffset + 4, true)

      if (chunkId === 'fmt ') {
        // fmt 청크의 2바이트 위치가 채널 수 (1=Mono, 2=Stereo)
        numChannels = dataView.getUint16(searchOffset + 10, true)
        sampleRate = dataView.getUint32(searchOffset + 12, true)
      } else if (chunkId === 'data') {
        dataOffset = searchOffset + 8
        dataSize = chunkSize
        break // 오디오 데이터 청크를 찾았으므로 탐색 종료
      }

      searchOffset += 8 + chunkSize
    }

    // 대비책: data 청크를 스펙대로 못 찾았을 경우 기본값 적용
    if (dataSize === 0) {
      dataOffset = 44
      numChannels = dataView.getUint16(22, true)
      sampleRate = dataView.getUint32(24, true)
      dataSize = byteLength - 44
    }

    const numSamples = Math.floor(dataSize / (2 * numChannels))
    const floatArray = new Float32Array(numSamples)

    let offset = dataOffset
    for (let i = 0, len = numSamples; i < len; i++) {
      let sum = 0
      for (let ch = 0; ch < numChannels; ch++) {
        // 안전 장치: 버퍼 범위를 넘어가려 하면 중단
        if (offset >= byteLength - 1) break
        const int16 = dataView.getInt16(offset, true)
        sum += int16 < 0 ? int16 / 32768.0 : int16 / 32767.0
        offset += 2
      }
      floatArray[i] = sum / numChannels
    }

    return {
      buffer: this.trimSilence(floatArray),
      sampleRate
    }
  }

  /**
   * Trims trailing silence from the ends of the audio buffer to optimize playback delay.
   * @param buffer The audio buffer to trim.
   * @param threshold The noise threshold below which samples are considered silent.
   * @returns The trimmed Float32Array.
   */
  private trimSilence(buffer: Float32Array, threshold: number = 0.02): Float32Array {
    let start = 0
    while (start < buffer.length && Math.abs(buffer[start]) <= threshold) {
      start++
    }

    let end = buffer.length - 1
    while (end > start && Math.abs(buffer[end]) <= threshold) {
      end--
    }

    // 완전히 무음이거나 유효 샘플이 없는 경우 빈 버퍼 반환
    if (start >= end) {
      return new Float32Array(0)
    }

    return buffer.slice(start, end + 1)
  }
}
