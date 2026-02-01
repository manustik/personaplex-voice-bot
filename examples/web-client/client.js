import { encode, decode } from './mulaw.js';

// Configuration
const WS_URL = `ws://${window.location.host}/media-stream`;
const SAMPLE_RATE = 8000;
const BUFFER_SIZE = 2048; // ScriptProcessor buffer size

// State
let ws = null;
let audioContext = null;
let scriptProcessor = null;
let mediaStream = null;
let isConnected = false;
let streamSid = null;

// UI Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const indicator = document.getElementById('connIndicator');
const statusText = document.getElementById('statusText');
const logs = document.getElementById('logs');

// Audio Queue for playback
const audioQueue = [];
let nextStartTime = 0;

// Init UI
startBtn.addEventListener('click', startCall);
stopBtn.addEventListener('click', stopCall);

function log(msg, type = 'info') {
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.prepend(div);
}

function updateStatus(status, type = 'neutral') {
    statusText.innerText = status;
    indicator.className = 'indicator ' + type;
}

async function startCall() {
    try {
        startBtn.disabled = true;
        updateStatus('Connecting...', 'pending');
        log('Starting call...');

        // 1. Initialize Audio Context (must be user initiated)
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE, // Try to request 8000Hz
        });
        
        await audioContext.resume();
        log(`AudioContext started at ${audioContext.sampleRate}Hz`);

        // 2. Request Microphone
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log('Microphone access granted');

        // 3. Connect WebSocket
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            log('WebSocket connected');
            isConnected = true;
            stopBtn.disabled = false;
            updateStatus('Connected', 'active');
            
            // Simulate Twilio 'start' event
            streamSid = 'test-stream-' + Date.now();
            sendJson({
                event: 'start',
                streamSid: streamSid,
                start: {
                    streamSid: streamSid,
                    mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 }
                }
            });

            // Start Audio Processing Pipeline
            startAudioPipeline();
        };

        ws.onmessage = handleMessage;
        
        ws.onerror = (e) => {
            log('WebSocket Error', 'error');
            stopCall();
        };
        
        ws.onclose = () => {
            log('WebSocket Disconnected');
            stopCall();
        };

    } catch (err) {
        log(`Error: ${err.message}`, 'error');
        startBtn.disabled = false;
        updateStatus('Error', 'error');
    }
}

function handleMessage(event) {
    try {
        const msg = JSON.parse(event.data);
        
        if (msg.event === 'media') {
            // Decode payload (Base64 -> mulaw -> Float32)
            const raw = atob(msg.media.payload);
            const uint8 = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) {
                uint8[i] = raw.charCodeAt(i);
            }
            
            const pcm = decode(uint8);
            playAudio(pcm);
            indicator.classList.add('talking');
            setTimeout(() => indicator.classList.remove('talking'), 100);
        } else if (msg.event === 'mark') {
            log('Received Mark');
        }
    } catch (err) {
        log(`Parse Error: ${err}`, 'error');
    }
}

function sendJson(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function startAudioPipeline() {
    // Microphone Source
    const source = audioContext.createMediaStreamSource(mediaStream);
    
    // ScriptProcessor (Deprecated but easiest for raw access)
    // Buffer size 2048 @ 8kHz = ~256ms latency. 
    // Ideally we'd use AudioWorklet but that requires HTTPS or localhost + separate file
    scriptProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    
    scriptProcessor.onaudioprocess = (e) => {
        if (!isConnected) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample if context is not 8kHz (likely 44.1 or 48k)
        // Simple decimation for testing
        let processData = inputData;
        
        // If the context is running at a higher rate, we rely on the browser's 
        // internal resampling somewhat or just naive decimation.
        // But wait: AudioContext was created with sampleRate: 8000.
        // Browsers *should* respect this or resample the mic input automatically.
        // Let's assume inputData is at audioContext.sampleRate.
        
        // Encode to mu-law
        const encoded = encode(processData);
        
        // Convert to binary string for btoa
        let binary = '';
        const len = encoded.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(encoded[i]);
        }
        
        // Send 'media' event
        sendJson({
            event: 'media',
            streamSid: streamSid,
            media: {
                payload: btoa(binary),
                timestamp: Date.now()
            }
        });
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination); // Needed for Chrome to fire events
}

function playAudio(pcmData) {
    if (!audioContext) return;
    
    const buffer = audioContext.createBuffer(1, pcmData.length, SAMPLE_RATE);
    buffer.copyToChannel(pcmData, 0);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    // Minimal scheduler to prevent gaps
    const now = audioContext.currentTime;
    // Slight buffer (100ms) for stability
    const startTime = Math.max(now, nextStartTime);
    
    source.start(startTime);
    nextStartTime = startTime + buffer.duration;
}

function stopCall() {
    if (!isConnected) return;
    isConnected = false;
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    updateStatus('Disconnected', 'neutral');
    log('Call ended');
}
