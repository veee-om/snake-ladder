export const GRID_SIZE = 16;
export const INITIAL_DIRECTION = "right";

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const OPPOSITE_DIRECTIONS = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

export function createInitialState(size = GRID_SIZE) {
  const center = Math.floor(size / 2);
  const snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center }
  ];

  return {
    size,
    snake,
    direction: INITIAL_DIRECTION,
    queuedDirection: INITIAL_DIRECTION,
    food: getRandomEmptyCell(size, snake, [0]),
    score: 0,
    status: "ready"
  };
}

export function queueDirection(state, nextDirection) {
  if (!DIRECTION_VECTORS[nextDirection]) {
    return state.queuedDirection;
  }

  const referenceDirection = state.status === "ready" ? state.direction : state.queuedDirection;
  if (OPPOSITE_DIRECTIONS[referenceDirection] === nextDirection) {
    return state.queuedDirection;
  }

  return nextDirection;
}

export function stepGame(state, randomValues = [Math.random()]) {
  if (state.status === "game-over") {
    return state;
  }

  const activeDirection = state.queuedDirection;
  const vector = DIRECTION_VECTORS[activeDirection];
  const nextHead = {
    x: wrapCoordinate(state.snake[0].x + vector.x, state.size),
    y: wrapCoordinate(state.snake[0].y + vector.y, state.size)
  };

  const grows = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const bodyToCheck = grows ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

  if (hitsSelf) {
    return {
      ...state,
      direction: activeDirection,
      queuedDirection: activeDirection,
      status: "game-over"
    };
  }

  const nextSnake = [nextHead, ...state.snake];
  if (!grows) {
    nextSnake.pop();
  }

  return {
    ...state,
    snake: nextSnake,
    direction: activeDirection,
    queuedDirection: activeDirection,
    food: grows ? getRandomEmptyCell(state.size, nextSnake, randomValues) : state.food,
    score: grows ? state.score + 1 : state.score,
    status: "running"
  };
}

export function getRandomEmptyCell(size, snake, randomValues = [Math.random()]) {
  const occupied = new Set(snake.map(({ x, y }) => `${x},${y}`));
  const emptyCells = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) {
    return null;
  }

  const source = randomValues.length > 0 ? randomValues[0] : Math.random();
  const index = Math.min(emptyCells.length - 1, Math.floor(source * emptyCells.length));
  return emptyCells[index];
}

function wrapCoordinate(value, size) {
  if (value < 0) {
    return size - 1;
  }

  if (value >= size) {
    return 0;
  }

  return value;
}
