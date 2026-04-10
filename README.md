# Vyom ki Saanp Seedhi

An online two-player Snakes and Ladders game with built-in room logic, a lightweight Node backend, and a mobile-friendly board UI.

## Features

- Create a room and share a 4-letter code with a friend
- Join from another phone or laptop and play live in the same room
- Server-authoritative turns, dice rolls, and snake/ladder movement
- Reconnect support with browser session storage
- Traditional board styling with `🐍` and `🪜` markers
- Responsive layout for desktop and mobile

## Run Locally

```bash
npm run dev
```

Then open [http://localhost:4173](http://localhost:4173).

To test with a friend online, deploy this full project to a host that can run Node.js. Static hosting alone will not run the room backend.

## How To Play

1. Player 1 opens the app and creates a room.
2. Share the 4-letter room code with Player 2.
3. Player 2 joins with the same code.
4. The server starts the match once both players are in.
5. Roll live from your own device and race to square 100.

## Deploy

This app needs a Node-capable host because the backend lives in `server.js`.

Good options:

- [Render](https://render.com/)
- [Railway](https://railway.com/)
- [Fly.io](https://fly.io/)

Recommended settings:

- Build command: none
- Start command: `npm start`
- Node version: current LTS

## Test

```bash
npm test
node --check server.js
node --check src/main.js
```

## Project Structure

- `server.js`: static file server plus multiplayer room API and SSE updates
- `src/game.js`: shared board rules and room-safe game logic
- `src/main.js`: browser lobby, room handling, and live board UI
- `index.html`: game layout
- `styles.css`: responsive visual design
- `tests/game.test.js`: room and rule tests
