# Voice Bot Module - Implementation Plan (TypeScript)

## Objetivo

Crear un módulo TypeScript/Node.js reutilizable (`voice-bot`) que integre **PersonaPlex** con **Twilio Media Streams** para crear bots de llamadas telefónicas con respuestas de voz en tiempo real.

> **NOTA:** PersonaPlex server se mantiene en Python (es el modelo de NVIDIA), pero todo el bridge será TypeScript.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Teléfono ──▶ Twilio ──▶ Bridge (TypeScript) ──▶ PersonaPlex     │
│                              │                      (Python)        │
│                         Fastify +                                   │
│                         WebSocket                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Estructura del Proyecto

```
voice-bot/
├── personaplex/                    # (existente) Repo de PersonaPlex (Python)
├── src/                            # Código fuente TypeScript
│   ├── index.ts                    # Exports públicos del módulo
│   ├── config.ts                   # Configuración centralizada
│   ├── audio/                      # Conversión de audio
│   │   ├── index.ts
│   │   ├── converter.ts            # PCM ↔ mulaw ↔ Opus
│   │   └── resampler.ts            # Cambio de sample rate
│   ├── personaplex/                # Cliente PersonaPlex
│   │   ├── index.ts
│   │   ├── client.ts               # WebSocket client async
│   │   └── protocol.ts             # Encoder/decoder de mensajes
│   ├── twilio/                     # Integración Twilio
│   │   ├── index.ts
│   │   ├── media-streams.ts        # Handler de Media Streams
│   │   └── twiml.ts                # Generador de TwiML
│   ├── server/                     # Servidor bridge
│   │   ├── index.ts
│   │   └── routes.ts               # Rutas HTTP y WebSocket
│   └── utils/                      # Utilidades
│       ├── index.ts
│       ├── logger.ts               # Logging con pino
│       └── buffer.ts               # Buffer manager para audio
├── examples/                       # Ejemplos de uso
│   ├── local-test.ts               # Test con audio local
│   ├── simple-bot.ts               # Bot básico
│   └── custom-persona.ts           # Bot con persona personalizada
├── tests/                          # Tests
│   └── ...
├── package.json                    # Configuración npm
├── tsconfig.json                   # Configuración TypeScript
├── .env.example                    # Variables de entorno ejemplo
└── README.md                       # Documentación
```

---

## Progreso de Implementación

### Fase 1: Setup del Proyecto ✅
- [x] package.json
- [x] tsconfig.json
- [x] .env.example
- [x] src/index.ts
- [x] src/config.ts

### Fase 2: Audio Conversion ✅
- [x] src/audio/index.ts
- [x] src/audio/converter.ts (mulaw ↔ PCM)
- [x] src/audio/resampler.ts (8kHz ↔ 24kHz)
- [x] src/audio/buffer.ts (buffer manager)
- [ ] Opus encode/decode (pendiente - necesita librería nativa)

### Fase 3: PersonaPlex Client ✅
- [x] src/personaplex/index.ts
- [x] src/personaplex/protocol.ts
- [x] src/personaplex/client.ts

### Fase 4: Twilio Integration ✅
- [x] src/twilio/index.ts
- [x] src/twilio/twiml.ts
- [x] src/twilio/media-streams.ts

### Fase 5: Bridge Server ✅
- [x] src/server/index.ts
- [x] src/server/app.ts
- [x] src/voice-bot.ts

### Fase 6: Utilities ✅
- [x] src/utils/index.ts
- [x] src/utils/logger.ts

### Fase 7: Examples & Docs ✅
- [x] examples/local-test.ts
- [x] examples/simple-bot.ts
- [x] README.md

### Pendiente para completar la integración
- [ ] Opus codec integration (encode audio for PersonaPlex)
- [ ] Opus decoder (decode audio from PersonaPlex)
- [ ] Test end-to-end con PersonaPlex funcionando
- [ ] Test con Twilio en producción

---

## Dependencias

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/websocket": "^11.0.0",
    "ws": "^8.16.0",
    "twilio": "^5.0.0",
    "pino": "^9.0.0",
    "dotenv": "^16.4.0",
    "@discordjs/opus": "^0.9.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.11.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.7.0",
    "vitest": "^1.2.0"
  }
}
```

---

## Flujo de Datos

```
Twilio WS ────▶ TwilioMediaHandler ────▶ AudioConverter
    │                    │                      │
    │          JSON+base64→mulaw           mulaw→PCM
    │                    │                      │
    │                    ▼                      ▼
    │              BufferManager ◀───── resample 8k→24k
    │                    │
    │               PCM→Opus
    │                    ▼
    │           PersonaPlexClient ──────▶ PersonaPlex Server
    │                    ▲                   (Python)
    │                    │◀─────────────────────┘
    │               Opus→PCM
    │                    │
    │           resample 24k→8k
    │                    │
    │               PCM→mulaw
    │                    │
    │           mulaw→base64+JSON
    ◀────────────────────┘
```

---

## Comandos de Verificación

```bash
# Instalar dependencias
npm install

# Iniciar PersonaPlex (en otra terminal)
cd personaplex && python -m moshi.server --ssl "$SSL_DIR" --cpu-offload

# Desarrollo
npm run dev

# Test local sin Twilio
npx tsx examples/local-test.ts

# Exponer con ngrok para Twilio
ngrok http 3000
```

---

## Notas

- PersonaPlex requiere GPU NVIDIA (GTX 1650 con --cpu-offload para pruebas)
- Twilio trial tiene $15 USD gratis
- Para producción se recomienda GPU cloud (RunPod, Vast.ai, AWS g5)
