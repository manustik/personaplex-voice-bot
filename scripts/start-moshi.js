import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Path to venv python
const VENV_PYTHON = path.join(ROOT_DIR, 'personaplex', '.venv', 'Scripts', 'python.exe');

console.log(`[Start-Moshi] Launching Moshi Server with Python: ${VENV_PYTHON}`);

if (!process.env.HF_TOKEN) {
    console.warn('[Start-Moshi] WARNING: HF_TOKEN not found in environment variables.');
}

// Arguments for moshi.server
const args = [
    '-m', 
    'moshi.server',
    '--hf-repo', 'nvidia/personaplex-7b-v1',
    '--port', '8998',
    // '--device', 'cpu', // Commented out to try GPU again (requires huge Pagefile)
    '--cpu-offload' // Safety flag for consumer GPUs
];

const child = spawn(VENV_PYTHON, args, {
    stdio: 'inherit',
    env: { ...process.env }
});

child.on('error', (err) => {
    console.error('[Start-Moshi] Failed to start process:', err);
});

child.on('exit', (code) => {
    console.log(`[Start-Moshi] Process exited with code ${code}`);
    process.exit(code ?? 1);
});
