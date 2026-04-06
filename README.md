# Vyom ki Saanp Seedhi

A local pass-and-play Snakes and Ladders game for 2 to 4 players, designed to work nicely on both desktop and mobile screens.

## Features

- Local pass-and-play mode on one device
- Supports 2, 3, or 4 players
- Mobile-friendly and desktop-friendly board layout
- Exact-roll finish rule and extra turn on a 6
- Visual snake and ladder markers on the board
- Lightweight local server for development

## Run Locally

```bash
npm run dev
```

Then open [http://localhost:4173](http://localhost:4173).

## How To Play

1. Choose 2 to 4 players.
2. Enter player names.
3. Start the game and roll the dice.
4. Pass the device to the next player after each turn.
5. Land exactly on square 100 to win.

## Test

```bash
npm test
```

## Project Structure

- `server.js`: simple local static server
- `src/game.js`: pass-and-play game rules and board helpers
- `src/main.js`: browser UI and local turn flow
- `index.html`: game layout
- `styles.css`: responsive visual design
- `tests/game.test.js`: game-rule tests
