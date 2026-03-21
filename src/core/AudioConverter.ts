export class AudioConverter {
  /**
   * 32-bit 부동소수점 오디오 배열을 16-bit PCM 정수형 배열로 변환합니다.
   * 값의 범위는 [-1.0, 1.0]에서 [-32768, 32767]로 스케일링됩니다.
   */
  public static float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return int16Array
  }

  /**
   * 16-bit PCM 정수형 배열을 32-bit 부동소수점 오디오 배열로 복원(역변환)합니다.
   * 값의 범위는 [-32768, 32767]에서 [-1.0, 1.0]으로 변환됩니다.
   */
  public static int16ToFloat32(int16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      const s = int16Array[i]
      float32Array[i] = s / (s < 0 ? 32768.0 : 32767.0)
    }
    return float32Array
  }
}
