# Voice Bot Module

A modular TypeScript library for integrating [PersonaPlex](https://github.com/NVIDIA/personaplex) (NVIDIA's full-duplex speech-to-speech model) with [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams) to create real-time voice conversation bots.

## Features

- 🎙️ **Real-time voice conversations** - Full-duplex speech-to-speech using NVIDIA PersonaPlex
- 📞 **Twilio integration** - Works with Twilio phone calls via Media Streams
- � **Opus Codec Support** - Built-in encoding/decoding for 24kHz audio
- 🎯 **TypeScript first** - Full type safety and modular architecture
- ⚡ **Performance optimized** - Support for GPU acceleration and CPU offloading

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│   Phone ──▶ Twilio ──▶ Bridge Server (TypeScript) ──▶ PersonaPlex  │
│                              │                         (Python)     │
│                         Audio Processing                            │
│                         - mulaw ↔ PCM                               │
│                         - Resampling 8kHz ↔ 24kHz                   │
│                         - Opus encoding/decoding                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Node.js 20+**
2. **NVIDIA GPU** (recommended) or enough RAM for CPU offloading
3. **HuggingFace Token** (with access to `nvidia/personaplex-7b-v1`)
4. **Twilio account** (for phone integration)

## Installation

```bash
# Clone the repository
cd voice-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings
```

## Quick Start

### 1. Configure Environment
Copy `.env.example` to `.env` and add your `HF_TOKEN`.

### 2. Start Everything

You can start both the AI and the Bridge server with a single command:

```bash
# Start AI (PersonaPlex) + Bridge Server
npm run dev:ai
```

Or start them separately:

**Option A: Real PersonaPlex (Python Server)**
```bash
# Starts the model with CPU offloading enabled by default
tsx scripts/start-moshi.js
```

**Option B: Mock Server (Simulation)**
```bash
npm run mock-server
```

### 3. Test Local Connection
```bash
npm run test:local
```
This will record received audio to `test_output.pcm`. Hear it by importing into Audacity as **Raw Data** (Float32, 24kHz).

### 4. Direct Bridge (for Twilio)
```bash
npm run dev
```
By default, it uses the PersonaPlex URL from your `.env`. Expose it with `ngrok http 3000` and point your Twilio webhook to `https://your-url.ngrok.io/twiml`.

## Configuration

Configuration is loaded from environment variables (`.env` file):

| Variable | Description | Default |
|----------|-------------|---------|
| `PERSONAPLEX_URL` | PersonaPlex WebSocket URL | `wss://localhost:8998/api/chat` |
| `PERSONAPLEX_VOICE_PROMPT` | Voice to use (NATF0-3, NATM0-3, etc.) | `NATF2.pt` |
| `PERSONAPLEX_TEXT_PROMPT` | System prompt for the AI | `You enjoy having a good conversation.` |
| `SERVER_PORT` | Bridge server port | `3000` |
| `SERVER_HOST` | Bridge server host | `0.0.0.0` |
| `LOG_LEVEL` | Logging level | `info` |

### Available Voices

| Voice ID | Description |
|----------|-------------|
| `NATF0` - `NATF3` | Natural female voices |
| `NATM0` - `NATM3` | Natural male voices |
| `VARF0` - `VARF4` | Variety female voices |
| `VARM0` - `VARM4` | Variety male voices |

## API Usage

### As a Module

```typescript
import { VoiceBot, VoiceBotConfig, PersonaPlexClient } from '@manus/voice-bot';

// Create config
const config: VoiceBotConfig = {
  personaplex: {
    url: 'wss://localhost:8998/api/chat',
    voicePrompt: 'NATF2.pt',
    textPrompt: 'You are a helpful assistant.',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  logLevel: 'info',
};

// Create bot
const bot = new VoiceBot(config);

bot.on('text', (text) => {
  console.log('Bot said:', text);
});

bot.on('audio', (pcm) => {
  // Handle audio response
});

await bot.startSession();
```

### Direct PersonaPlex Client

```typescript
import { PersonaPlexClient } from '@manus/voice-bot';

const client = new PersonaPlexClient({
  config: {
    url: 'wss://localhost:8998/api/chat',
    voicePrompt: 'NATM1.pt',
    textPrompt: 'You are a restaurant booking assistant.',
  },
});

client.on('audio', (data) => {
  // Opus encoded audio from AI
});

client.on('text', (text) => {
  console.log('AI:', text);
});

await client.connect();
```

## Project Structure

```
voice-bot/
├── src/
│   ├── index.ts              # Main exports
│   ├── config.ts             # Configuration
│   ├── voice-bot.ts          # VoiceBot orchestrator
│   ├── audio/                # Audio processing
│   │   ├── converter.ts      # mulaw ↔ PCM
│   │   ├── resampler.ts      # Sample rate conversion
│   │   └── buffer.ts         # Audio buffering
│   ├── personaplex/          # PersonaPlex client
│   │   ├── client.ts         # WebSocket client
│   │   └── protocol.ts       # Message encoding
│   ├── twilio/               # Twilio integration
│   │   ├── media-streams.ts  # Media Streams handler
│   │   └── twiml.ts          # TwiML generators
│   ├── server/               # Bridge server
│   │   └── app.ts            # Fastify application
│   └── utils/                # Utilities
│       └── logger.ts         # Logging
├── examples/
│   ├── local-test.ts         # Test without Twilio
│   └── simple-bot.ts         # Full bot example
├── personaplex/              # PersonaPlex Engine (Python)
└── package.json
```

## Development

```bash
# Run in development mode (auto-reload)
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build

# Run production build
npm start
```

## Known Limitations

1. **GPU/Memory requirement** - PersonaPlex is a 7B model. Even with `--cpu-offload`, it needs significant system memory (VRAM + System RAM).
2. **Single session** - The current implementation handles one conversation at a time per PersonaPlex instance.

## Roadmap

- [ ] Complete Opus encoding/decoding integration
- [ ] Add Microphone support for local testing
- [ ] Add WebRTC support (browser-based calls)
- [ ] Multi-session support with session management
- [ ] Docker deployment configuration

## License

MIT

## Credits

- [PersonaPlex](https://github.com/NVIDIA/personaplex) - NVIDIA's full-duplex speech model
- [Moshi](https://kyutai.org/moshi) - Base architecture by Kyutai
- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams) - Real-time audio streaming
