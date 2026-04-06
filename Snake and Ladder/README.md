# Vyom ki Saanp Seedhi

A lightweight two-player Snakes and Ladders game with a small Node backend for room-based multiplayer.

## Features

- Create a room and share the 4-character code
- Join as player two from another browser tab or device
- In-memory room state with turn-based validation on the backend
- Live room updates over Server-Sent Events
- Exact-roll finish rule and extra turn on a 6
- Visual board with marked snake and ladder squares

## Run Locally

```bash
npm run dev
```

Then open [http://localhost:4173](http://localhost:4173).

## How To Play

1. Player one creates a room and shares the code.
2. Player two joins using the same code.
3. Players take turns rolling the dice.
4. Landing on a ladder moves you up. Landing on a snake sends you down.
5. You must land exactly on square 100 to win.

## Test

```bash
npm test
```

## Project Structure

- `server.js`: Node server, room API, SSE updates, static file serving
- `src/game.js`: shared Snakes and Ladders rules and board helpers
- `src/main.js`: browser UI and multiplayer room flow
- `index.html`: game layout
- `styles.css`: responsive visual design
- `tests/game.test.js`: game-rule tests
