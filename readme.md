# Animalese TTS

Animalese TTS is an Animal Crossing style Voice Synthesis (TTS) engine. It analyzes text to synthesize audio samples corresponding to each phoneme, and applies pitch adjustments and melody variations to generate a cute and unique voice.

👉 **[Go to Test Page (Demo)](https://animalese-tts.izure.org)**

## Key Features

- **Multi-language Support**: Supports Korean (separated into onset/nucleus/coda), English, and Japanese (hiragana, katakana) analyzers.
- **Cross-environment Support**: Works perfectly in both browser environments using the Web Audio API and Node.js environments using the file system.
- **Real-time Synthesis**: Enables real-time synthesis character-by-character using `AsyncGenerator`.
- **Rich Audio Effects**:
  - **Base Pitch & Randomness**: Adjust the pitch of the voice and the variation range that changes every time.
  - **Melody Variation**: Create a singing-like effect through sine wave-based pitch changes.
  - **Playback Speed Control**: Adjust the playback speed independently of the pitch.
  - **Punctuation & Space Delay**: Set natural pauses for periods, commas, spaces, etc.

## Installation and Build

```bash
# Install dependencies
npm install

# Build the project (creates the dist folder)
npm run build

# Run tests
npm test
```

## Usage (Example)

### AnimaleseEngine Configuration

```typescript
import { AnimaleseEngine, KoreanAnalyzer, FileSystemSampler, PitchManager } from 'animalese-tts'

const engine = new AnimaleseEngine({
  analyzer: new KoreanAnalyzer(),
  sampler: new FileSystemSampler({
    sampleRate: 44100,    // Sample rate of the original sample data (Hz)
    maxRetries: 3,        // Maximum number of retries when loading missing phoneme files
    samplesDirectory: './samples' // Directory where the original sample data is stored
  }),
  effect: new PitchManager({
    pitch: 1.5,           // Pitch slightly higher than the default
    speed: 4.0,           // Playback speed
    randomness: 0.1,      // Random pitch variation range per character
    melodyRate: 0.05,     // Melody variation rate
    melodyAmplitude: 0.1  // Melody variation amplitude
  }),
  spaceDelay: 0.1,        // Silence delay inserted upon recognizing a space character (seconds)
  punctuationDelay: 0.3   // Silence delay inserted upon recognizing punctuation (seconds)
})

// Synthesis and Output Example
async function speak(text: string) {
  const speaker = engine.synthesize(text)
  
  speaker.on('loading', () => console.log('Loading missing audio samples...'))
  speaker.on('completed', () => console.log('All samples loaded!'))
  
  await speaker.load()
  
  for await (const output of speaker.speak()) {
    console.log(`Synthesizing character: ${output.char}`)
    // Play output.buffer (Float32Array) or save it to a file
  }
}

speak("Hello! This is an Animal Crossing voice test.")
```

## Detailed Configuration Options (AnimalVoiceConfig)

| Option Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `analyzer` | `TextAnalyzer` | (Required) | Separates text into phonemes. You can select language-specific analyzers. |
| `sampler` | `Sampler` | (Required) | Supplies the original audio sample data corresponding to the phonemes. |
| `effect` | `AudioEffect` | (Required) | Handles pitch modulation and speed control effects. (Usually `PitchManager` is used) |
| `spaceDelay` | `number` | `0` | Silence delay inserted upon recognizing a space character (` `) (seconds). |
| `punctuationDelay` | `number` | `0` | Silence delay inserted upon recognizing punctuation (seconds). |
| `punctuations` | `string[]` | (Default set) | Array of characters to be considered as punctuation marks. |

### Sampler Parameter Options (`SamplerOptions`)

- `sampleRate`: The sample rate of the original sample data in Hz. (e.g., 44100)
- `maxRetries`: (Optional) Maximum number of retries when loading missing phoneme files.

### Environment-Specific Sampler Options

Depending on the environment, you must use a specific `Sampler` implementation and provide its required property to locate the audio sample data:

- **Node.js (`FileSystemSampler`)**: 
  - `samplesDirectory`: The absolute or relative path to the local directory containing the `.wav` sample files.
- **Browser (`WebSampler`)**: 
  - `baseUrl`: The URL path where the `.wav` sample files are hosted on the web server.

### Phoneme Audio Data Structure

The audio sample files must be provided as `.wav` format files. Each file must be named exactly after the corresponding phoneme analyzed by the `TextAnalyzer`. All files must be placed flatly within the `samplesDirectory` or `baseUrl` folder.

For example, if you are using the `KoreanAnalyzer`, the text is broken down into onset, nucleus, and coda (e.g., "안" -> `ㅇ`, `ㅏ`, `ㄴ`). Thus, your `samplesDirectory` or `baseUrl` directory should contain files named like:
- `ㅇ.wav`
- `ㅏ.wav`
- `ㄴ.wav`

For English (`EnglishAnalyzer`) and Japanese (`JapaneseAnalyzer`), the text is converted internally into alphabetical phonemes (e.g., romaji or lowercase English). Thus, the required files are simply alphabetical:
- `a.wav`
- `b.wav`
- `k.wav`

> **Note**: If a corresponding phoneme audio file (`.wav`) is missing or fails to load from the `samplesDirectory` or `baseUrl`, that specific character will be treated as silence (muted) during synthesis.

### PitchManager Parameter Options (`PitchManagerOptions`)

- `pitch`: The base tone of the voice. 1.0 is standard; higher is thinner, lower is deeper. 
- `speed`: Speaking speed. Greater than 1.0 is faster, less than 1.0 is slower.
- `randomness`: Amount of random pitch change applied to each character.
- `melodyRate`: The rate at which the melody changes. Higher values make the pitch rise and fall faster. (Default 0.05)
- `melodyAmplitude`: The amplitude of the melody change. Higher values make the pitch difference more distinct. (Default 0.1)

## Main Components

### Analyzers
Analyzers separate text into the smallest phoneme structures tailored to the specific characteristics of the language.
- `KoreanAnalyzer`: Precisely separates Korean text into onset, nucleus, and coda. Handles double consonants naturally.
- `EnglishAnalyzer`: Separates English text into alphabets ignoring case, and filters unsupported special characters.
- `JapaneseAnalyzer`: Analyzes hiragana and katakana and separates them into individual phonemes.

### Samplers
Samplers fetch and cache actual `.wav` audio samples corresponding to the analyzed phonemes.
- `FileSystemSampler`: **Node.js only.** Reads audio files from a local directory (`samplesDirectory`).
- `WebSampler`: **Browser only.** Fetches samples dynamically via HTTP requests from a remote server (`baseUrl`).
- `MemorySampler`: Loads audio buffers directly into memory. Ideal for custom environments or testing.

### Playback Strategies (PlaybackStrategies)
Responsible for delivering the stream audio data (`Float32Array`) generated by the `AnimaleseEngine`'s `AsyncGenerator` effectively to the end user.
- `NodePlaybackStrategy`: Saves (Exports) the synthesized audio in chunk forms to `.wav` files on the local disk in a Node.js environment.
- `BrowserPlaybackStrategy`: Plays the buffer immediately in a web browser using the Web Audio API (`AudioContext`).

## Project Structure

- `src/core`: Core logic including audio decoders, converters, and sample providers.
- `src/analyzers`: Language-specific text analysis algorithms (Korean/English/Japanese)
- `src/effects`: Audio effects processing such as pitch and speed adjustment
- `src/playback`: Platform-specific playback strategies (Browser/Node)
- `src/interfaces.ts`: Main interfaces and type definitions

## License

Please see the [LICENSE](LICENSE) file for details regarding the license of this project.
