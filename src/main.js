import { createInitialState, queueDirection, stepGame } from "./game.js";

const TICK_MS = 140;
const KEY_TO_DIRECTION = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  a: "left",
  A: "left",
  s: "down",
  S: "down",
  d: "right",
  D: "right"
};

const board = document.querySelector("#board");
const gameOverOverlay = document.querySelector("#game-over-overlay");
const scoreValue = document.querySelector("#score");
const statusValue = document.querySelector("#status");
const restartButton = document.querySelector("#restart-button");
const controlButtons = document.querySelectorAll("[data-direction]");

let state = createInitialState();
let tickHandle = null;

function getStatusLabel() {
  if (state.status === "game-over") {
    return "Game Over";
  }
  if (tickHandle === null) {
    return "Paused";
  }
  if (state.status === "ready") {
    return "Ready";
  }
  return "Running";
}

function render() {
  scoreValue.textContent = String(state.score);
  statusValue.textContent = getStatusLabel();
  gameOverOverlay.hidden = state.status !== "game-over";

  const snakeLookup = new Set(state.snake.map(({ x, y }) => `${x},${y}`));
  const headKey = `${state.snake[0].x},${state.snake[0].y}`;

  board.replaceChildren();
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      const cell = document.createElement("div");
      const key = `${x},${y}`;
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");

      if (state.food && state.food.x === x && state.food.y === y) {
        cell.classList.add("cell--food");
      }

      if (snakeLookup.has(key)) {
        cell.classList.add("cell--snake");
      }

      if (key === headKey) {
        cell.classList.add("cell--head");
      }

      board.append(cell);
    }
  }
}

function stopLoop() {
  if (tickHandle !== null) {
    window.clearInterval(tickHandle);
    tickHandle = null;
  }
}

function tick() {
  state = stepGame(state);
  if (state.status === "game-over") {
    stopLoop();
  }
  render();
}

function startLoop() {
  if (tickHandle !== null || state.status === "game-over") {
    render();
    return;
  }

  tickHandle = window.setInterval(tick, TICK_MS);
  render();
}

function restartGame() {
  stopLoop();
  state = createInitialState();
  render();
}

function handleDirection(nextDirection) {
  state = {
    ...state,
    queuedDirection: queueDirection(state, nextDirection)
  };

  if (state.status !== "game-over") {
    startLoop();
  }

  render();
}

document.addEventListener("keydown", (event) => {
  const direction = KEY_TO_DIRECTION[event.key];

  if (direction) {
    event.preventDefault();
    handleDirection(direction);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (state.status === "game-over") {
      restartGame();
      return;
    }

    if (tickHandle === null) {
      startLoop();
    } else {
      stopLoop();
      render();
    }
  }
});

restartButton.addEventListener("click", restartGame);
controlButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleDirection(button.dataset.direction);
  });
});

render();
