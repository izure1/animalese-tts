# Animalese TTS

[![](https://data.jsdelivr.com/v1/package/npm/animalese-tts/badge)](https://www.jsdelivr.com/package/npm/animalese-tts)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

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
npm install animalese-tts
```

```html
<script type="module">
  import {
    AnimaleseEngine,
    KoreanAnalyzer,
    WebSampler,
    PitchManager,
    WebPlayer
  } from 'https://cdn.jsdelivr.net/npm/animalese-tts/+esm'
</script>
```

## Usage (Example)

### Browser (Web) Environment

In a browser environment, you use `WebSampler` to fetch samples via HTTP and `WebPlayer` to play audio using the Web Audio API.

```typescript
import {
  AnimaleseEngine,
  EnglishAnalyzer,
  WebSampler,
  PitchManager,
  WebPlayer
} from 'https://cdn.jsdelivr.net/npm/animalese-tts/+esm'

const sampleRate = 48000
const player = new WebPlayer(sampleRate)

const engine = new AnimaleseEngine({
  analyzer: new EnglishAnalyzer(),
  sampler: new WebSampler(
    'https://your-server.com/sounds/sprite.wav', 
    // Auto-slicing based on silence using string[] 
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'] 
  ),
  effect: new PitchManager({
    pitch: 1.5,
    speed: 4.0,
  })
})

// Wait for the engine to load (loads the sprite file, splits audio based on silence, and decodes it)
await engine.load()

async function speak(text: string) {
  const speaker = engine.synthesize(text)
  
  for await (const output of speaker.speak()) {
    await player.play(output.buffer)
  }
}

speak("Hello! This is a voice test in the browser.")
```

### Node.js Environment

In a Node.js environment, you use `FileSystemSampler` to read samples from the local disk and `FilePlayer` to play or save the audio.

```typescript
import {
  AnimaleseEngine,
  KoreanAnalyzer,
  FileSystemSampler,
  PitchManager,
  FilePlayer
} from 'animalese-tts'

const sampleRate = 48000

const player = new FilePlayer(sampleRate)

const engine = new AnimaleseEngine({
  analyzer: new KoreanAnalyzer(),
  sampler: new FileSystemSampler(
    './sounds/sprite.wav',
    // You can use an explicit SpriteMap object.
    {
      'ㄱ': { startMs: 0, durationMs: 100 },
      'ㄲ': { startMs: 100, durationMs: 80 },
      'ㄴ': { startMs: 180, durationMs: 95 },
      // ...
    }
  ),
  effect: new PitchManager({
    pitch: 0.8,
    speed: 3.5,
  })
})

await engine.load()

async function speak(text: string) {
  const speaker = engine.synthesize(text)
  
  for await (const output of speaker.speak()) {
    // FilePlayer exports the buffer to a temporary or specified .wav file/stream
    await player.play(output.buffer, './output_folder')
  }
}

speak("안녕하세요! Node.js에서의 목소리 테스트입니다.")
```

## Detailed Configuration Options (AnimalVoiceConfig)

| Option Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `analyzer` | `TextAnalyzer` | (Required) | Separates text into phonemes. You can select language-specific analyzers. |
| `sampler` | `Sampler` | (Required) | Supplies the original audio sample data corresponding to the phonemes. |
| `effect` | `AudioEffect` | (Required) | Handles pitch modulation and speed control effects. (Usually `PitchManager` is used) |
| `spaceDelay` | `number` | `0.03` | Silence delay inserted upon recognizing a space character (` `) (seconds). |
| `punctuationDelay` | `number` | `0.3` | Silence delay inserted upon recognizing punctuation (seconds). |
| `punctuations` | `string[]` | (Default set) | Array of characters to be considered as punctuation marks. |

### Sampler Configuration Audio File and Sprite Options

> [!IMPORTANT]
> For the default voice audio samples and SpriteMap sequence data, please refer [here (docs/sounds)](https://github.com/izure1/animalese-tts/tree/main/docs/sounds).

The Sampler's role is to load a single large audio sprite (`sprite.wav`) and slice it into individual phoneme units. The common parameters injected when initializing `WebSampler`, `FileSystemSampler`, and `MemorySampler` are as follows:

1. **Audio Original Source** (1st Arg):
   - `WebSampler`: URL of the audio sprite file.
   - `FileSystemSampler`: Path to the local audio sprite `.wav` file.
   - `MemorySampler`: Memory buffer (`ArrayBuffer` / `Uint8Array`) containing the audio data.

2. **sprites** (2nd Arg):
   Specifies how to slice the audio sprite and map it to each phoneme.
   
   - **Using a `SpriteMap` Object**:
     Explicitly specifies the start time (`startMs`) and section length (`durationMs`) for each phoneme.
     ```typescript
     const sprites = {
       'a': { startMs: 0, durationMs: 154 },
       'b': { startMs: 154, durationMs: 130 },
       'c': { startMs: 284, durationMs: 160 }
       // ...
     };
     ```
   
   - **Using a `string[]` Array**:
     Automatically splits the audio based on silence sections (auto-slicing), and automatically assigns them to phonemes in the order listed in the array.
     ```typescript
     const sprites = ['a', 'b', 'c', 'd', ...];
     ```
     - **How does it work?**: It reads the entire audio sprite, then finds all silence sections that meet the `silenceThreshold` (silence detection threshold) and `minSilenceDurationMs` (minimum duration recognized as silence) options. Then, using these found silence sections as boundaries, it splits the entire audio into multiple smaller audio clips.
     - **Array Mapping**: These split audio clips are mapped 1:1 sequentially with the items specified in the array (e.g., `['a', 'b', 'c']`).
     - **Trim Processing**: Each phoneme audio clip that has been sliced based on silence internally undergoes an additional `trim` process to completely remove any slight leading/trailing silence. This prevents unwanted empty noises during synthesis.

3. **options** (3rd Arg - Optional):
   - `maxRetries`: Maximum number of retries when loading the audio file. (Default: 3)
   - `silenceThreshold`: When using the `string[]` method, if the amplitude of the audio is below this value, it's considered silence (0.0~1.0). It also affects the trim process for the sliced audio clips front and back. (Default: `0.01`)
   - `minSilenceDurationMs`: When using the `string[]` method, this specifies how long (in milliseconds) the amplitude must stay equal to or below the `silenceThreshold` to be identified as an intact, fully-qualified silence section (splicing boundary point). Written in milliseconds. The default value is `20`. If the audio splits unexpectedly small or strange, it may be because a very short internal silence within a phoneme sound was incorrectly recognized as a slice boundary. In such cases, test by increasing this value (e.g., `50`). If it is a complex audio clip where adjusting values does not resolve the issue, we recommend using the `SpriteMap` approach to explicitly designate times.

### PitchManager Parameter Options (`PitchManagerOptions`)

- `pitch`: The base tone of the voice. Higher is thinner, lower is deeper. (Default: 1.5)
- `speed`: Speaking speed. Greater than 1.0 is faster, less than 1.0 is slower. (Default: 4.0)
- `randomness`: Amount of random pitch change applied to each character. (Default: 0.1)
- `melodyRate`: The rate at which the melody wave changes. Higher values make the pitch rise and fall faster. (Default: 0.05)
- `melodyAmplitude`: The amplitude of the melody wave. Higher values make the pitch difference more distinct. (Default: 0.1)

## Main Components Structure

### Analyzers

Analyzers separate text into the smallest phoneme structures tailored to the specific characteristics of the language.
- `KoreanAnalyzer`: Precisely separates Korean text into onset, nucleus, and coda. Handles double consonants and diphthongs smoothly.
- `EnglishAnalyzer`: Separates English text into alphabets ignoring case, and filters unsupported special characters.
- `JapaneseAnalyzer`: Analyzes hiragana and katakana and separates them into individual phonemes.

### Creating Custom Analyzers

You can easily create your own custom language analyzer by extending the exported base classes: `DecomposingAnalyzer` or `DictionaryAnalyzer`.

#### Using DecomposingAnalyzer (Character-by-character)

Ideal for languages where characters decompose mathematically into phonemes (like Korean).
```typescript
import { DecomposingAnalyzer, PhonemeToken } from 'animalese-tts';

export class MyCustomAnalyzer extends DecomposingAnalyzer {
  protected decompose(char: string): PhonemeToken[] {
    // Custom logic to convert a single character to phonemes
    return [{ phoneme: char.toLowerCase(), mergeWithNext: false }];
  }
}
```

#### Using DictionaryAnalyzer (Mapping-based)

Ideal for languages where specific character structures map 1:1 to specific phoneme arrays (like Japanese). 
Each string element of the array becomes a single continuous phoneme block.
For example, `['tai']` is played as a single continuous piece (combining t, a, i at once like one letter), while splitting it to `['ta', 'i']` plays as two independent pieces consecutively.

```typescript
import { DictionaryAnalyzer, PhonemeToken } from 'animalese-tts';

export class MyMappedAnalyzer extends DictionaryAnalyzer {
  protected dictionary: Record<string, string[]> = {
    // Single character pronunciation
    'あ': ['a'],
    // Combined pronunciation as one block
    'きゃ': ['kya'], 
    // Two distinct pronunciations merged together consecutively
    '大': ['ta', 'i'], 
  };
  
  // You can optionally override the `analyze` method to add complex language-specific rules (like sokuon, etc).
}
```

### Samplers

A Sampler loads a single audio sprite (`.wav`) file, decodes it, and slices it into individual phoneme buffer clips.
- `FileSystemSampler`: **Node.js only.** Reads a sprite `.wav` file from the local file system.
- `WebSampler`: **Browser only.** Fetches a sprite `.wav` file via HTTP.
- `MemorySampler`: Directly accepts an integrated `ArrayBuffer` or `Uint8Array` containing audio data to decode and slice. Ideal for environments where fetch/fs isn't available, or for using bespoke caching techniques.

### Playback Strategies (PlaybackStrategies)

Responsible for securely conveying the streamed audio data (`Float32Array`) generated by the `AnimaleseEngine`'s `AsyncGenerator` to the final user's environment.
- `FilePlayer`: Synthesizes audio in a Node.js environment and exports it as a `.wav` file to the local disk.
- `WebPlayer`: Immediately plays buffers in the browser using the Web Audio API (`AudioContext`).

## Project Structure

- `src/core`: Core logic including audio decoders, converters, and sample providers.
- `src/analyzers`: Language-specific text analysis algorithms (Korean/English/Japanese)
- `src/effects`: Audio effects processing such as pitch and speed adjustment
- `src/playback`: Platform-specific playback strategies (Browser/Node.js)
- `src/interfaces.ts`: Main interfaces and type definitions

## License

Please see the [LICENSE](LICENSE) file for details regarding the license of this project.
