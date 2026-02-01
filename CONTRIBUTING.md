# Contributing to PersonaPlex Voice Bot

First off, thank you for considering contributing to this project! It's people like you who make the open-source community such an amazing place to learn, inspire, and create.

## How Can I Contribute?

### Reporting Bugs
*   Check if the issue has already been reported in the [Issues](https://github.com/manustik/personaplex-voice-bot/issues) tab.
*   If not, create a new issue. Include as much detail as possible, such as your environment (OS, Node version, GPU), steps to reproduce, and any error logs.

### Suggesting Enhancements
*   Open an issue with the "enhancement" tag.
*   Explain why this feature would be useful and how it should work.

### Pull Requests
1.  Fork the repository.
2.  Create a new branch for your feature or fix (`feature/my-cool-feature` or `fix/issue-description`).
3.  Implement your changes.
4.  Ensure the code follows the existing style and matches the project's architecture.
5.  **Conventional Commits**: We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commit messages (e.g., `feat: Add support for WebRTC`, `fix: Handle WebSocket disconnection`).
6.  Submit a Pull Request and describe your changes in detail.

## Development Setup

### Technical Stack
*   **Core**: Node.js with TypeScript
*   **AI Engine**: Python (PersonaPlex/Moshi)
*   **Audio**: Opus encoding/decoding via `opusscript`
*   **Server**: Fastify

### Prerequisites
*   Follow the installation guide in the `README.md`.
*   You will need an NVIDIA GPU and an `HF_TOKEN` for full testing.

## Code Style
*   Use TypeScript for all new code.
*   Prioritize modularity and clear architecture.
*   Follow the project's existing linting and formatting rules (`npm run lint`).

## Community
By participating in this project, you agree to abide by our code of conduct. Let's build something awesome together!
