# Snake

A small classic Snake game built as a lightweight static web app.

## Features

- Grid-based snake movement
- Food spawning and snake growth
- Score tracking
- Wraparound movement across board edges
- Game over on self-collision
- Keyboard controls and on-screen mobile controls
- Restart and pause support

## Run Locally

```bash
npm run dev
```

Then open [http://localhost:4173](http://localhost:4173).

## Controls

- Arrow keys: move
- `W`, `A`, `S`, `D`: move
- `Space`: pause or resume
- `Restart`: reset the game

## Test

```bash
npm test
```

## Manual Verification

- The snake starts moving when you press an arrow key or `WASD`.
- The snake wraps to the opposite side when crossing an edge.
- Eating food increases both score and snake length.
- The game ends only when the snake collides with itself.
- The red game-over overlay appears after self-collision.
- `Space` pauses and resumes the game.
- `Restart` resets the board, score, and snake position.

## Project Structure

- `index.html`: game shell
- `styles.css`: minimal styling
- `src/game.js`: core game logic
- `src/main.js`: rendering and input handling
- `tests/game.test.js`: logic tests
