import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState, getRandomEmptyCell, queueDirection, stepGame } from "../src/game.js";

test("moves the snake one cell in the queued direction", () => {
  const state = createInitialState(8);
  const nextState = stepGame(state);

  assert.deepEqual(nextState.snake[0], { x: 5, y: 4 });
  assert.equal(nextState.status, "running");
});

test("prevents reversing direction into the snake body", () => {
  const state = createInitialState(8);
  const queuedDirection = queueDirection(state, "left");

  assert.equal(queuedDirection, "right");
});

test("grows and increases score when food is eaten", () => {
  const state = {
    ...createInitialState(8),
    food: { x: 5, y: 4 }
  };

  const nextState = stepGame(state, [0]);

  assert.equal(nextState.score, 1);
  assert.equal(nextState.snake.length, 4);
  assert.notDeepEqual(nextState.food, { x: 5, y: 4 });
});

test("wraps the snake to the opposite side when it crosses a wall", () => {
  const state = {
    ...createInitialState(4),
    snake: [{ x: 3, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 1 }],
    direction: "right",
    queuedDirection: "right",
    food: { x: 0, y: 0 },
    status: "running"
  };

  const nextState = stepGame(state);

  assert.equal(nextState.status, "running");
  assert.deepEqual(nextState.snake[0], { x: 0, y: 1 });
});

test("ends the game when the snake runs into itself", () => {
  const state = {
    ...createInitialState(6),
    snake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ],
    direction: "left",
    queuedDirection: "left",
    food: { x: 5, y: 5 },
    status: "running"
  };

  const nextState = stepGame(state);

  assert.equal(nextState.status, "game-over");
});

test("places food only on empty cells", () => {
  const food = getRandomEmptyCell(
    3,
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 }
    ],
    [0]
  );

  assert.deepEqual(food, { x: 2, y: 2 });
});
