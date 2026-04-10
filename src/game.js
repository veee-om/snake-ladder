export const BOARD_SIZE = 100;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 2;
export const STARTING_POSITION = 1;

export const TRANSPORTS = {
  4: 14,
  9: 31,
  17: 7,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  54: 34,
  62: 19,
  63: 81,
  64: 60,
  71: 91,
  87: 24,
  93: 73,
  95: 75,
  99: 78
};

const PLAYER_COLORS = ["sun", "leaf"];
const PLAYER_TOKENS = ["A", "B"];

export function createRoomGame(hostName, options = {}) {
  const idFactory = options.idFactory ?? defaultIdFactory;
  const host = createPlayer(hostName, 0, idFactory);

  return {
    status: "waiting",
    players: [host],
    currentTurn: 0,
    lastRoll: null,
    winnerId: null
  };
}

export function addPlayerToGame(gameState, playerName, options = {}) {
  validateGameState(gameState);
  const cleanedName = sanitizePlayerName(playerName);
  const idFactory = options.idFactory ?? defaultIdFactory;

  if (gameState.players.length >= MAX_PLAYERS) {
    throw new Error("This room is already full.");
  }

  const joiningPlayer = createPlayer(cleanedName, gameState.players.length, idFactory);
  const players = [...gameState.players, joiningPlayer];

  return {
    ...gameState,
    players,
    status: players.length === MIN_PLAYERS ? "playing" : "waiting",
    currentTurn: 0,
    lastRoll: null,
    winnerId: null
  };
}

export function rollForPlayer(gameState, playerId, randomValue = Math.random()) {
  validateGameState(gameState);

  if (gameState.status === "waiting") {
    throw new Error("Waiting for another player to join.");
  }

  if (gameState.status === "finished") {
    throw new Error("This game is already finished.");
  }

  const activePlayer = gameState.players[gameState.currentTurn];
  if (!activePlayer || activePlayer.id !== playerId) {
    throw new Error("It is not your turn yet.");
  }

  const dice = Math.max(1, Math.min(6, Math.floor(randomValue * 6) + 1));
  const attemptedPosition = activePlayer.position + dice;
  const landedPosition = attemptedPosition <= BOARD_SIZE ? attemptedPosition : activePlayer.position;
  const transportTarget = TRANSPORTS[landedPosition] ?? landedPosition;
  const movementType =
    transportTarget > landedPosition ? "ladder" : transportTarget < landedPosition ? "snake" : "move";
  const didWin = transportTarget === BOARD_SIZE;
  const keepsTurn = dice === 6 && !didWin;

  const players = gameState.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          position: transportTarget
        }
      : player
  );

  return {
    ...gameState,
    players,
    currentTurn: didWin ? gameState.currentTurn : keepsTurn ? gameState.currentTurn : getNextTurn(gameState),
    lastRoll: {
      playerId,
      dice,
      from: activePlayer.position,
      to: transportTarget,
      attempted: attemptedPosition,
      movementType,
      keepsTurn
    },
    status: didWin ? "finished" : "playing",
    winnerId: didWin ? playerId : null
  };
}

export function restartRoomGame(gameState) {
  validateGameState(gameState);

  if (gameState.players.length < MIN_PLAYERS) {
    throw new Error("Waiting for another player to join.");
  }

  return {
    status: "playing",
    players: gameState.players.map((player) => ({
      ...player,
      position: STARTING_POSITION
    })),
    currentTurn: 0,
    lastRoll: null,
    winnerId: null
  };
}

export function serializeGameForPlayer(gameState, playerId) {
  validateGameState(gameState);

  return {
    ...gameState,
    players: gameState.players.map((player) => ({
      ...player,
      isSelf: player.id === playerId
    })),
    selfPlayerId: playerId
  };
}

export function buildBoardCells(size = BOARD_SIZE) {
  return Array.from({ length: size }, (_, index) => {
    const value = size - index;
    const row = Math.floor((value - 1) / 10);
    const columnOffset = (value - 1) % 10;
    const column = row % 2 === 0 ? columnOffset : 9 - columnOffset;

    return {
      value,
      row,
      column,
      destination: TRANSPORTS[value] ?? null
    };
  });
}

function createPlayer(name, index, idFactory) {
  return {
    id: idFactory(),
    name: sanitizePlayerName(name),
    position: STARTING_POSITION,
    token: PLAYER_TOKENS[index],
    color: PLAYER_COLORS[index]
  };
}

function sanitizePlayerName(name) {
  const cleanedName = String(name || "").trim().slice(0, 20);

  if (!cleanedName) {
    throw new Error("Player name is required.");
  }

  return cleanedName;
}

function validateGameState(gameState) {
  if (!gameState || !Array.isArray(gameState.players)) {
    throw new Error("Game state is invalid.");
  }
}

function getNextTurn(gameState) {
  return (gameState.currentTurn + 1) % gameState.players.length;
}

function defaultIdFactory() {
  return Math.random().toString(36).slice(2, 10);
}
