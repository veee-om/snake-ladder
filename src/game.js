export const BOARD_SIZE = 100;
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

const PLAYER_TOKENS = ["A", "B"];
const PLAYER_COLORS = ["sun", "leaf"];

export function createRoomState(roomId) {
  return {
    roomId,
    status: "waiting",
    players: [],
    currentTurn: 0,
    lastRoll: null,
    winnerId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function addPlayer(roomState, playerName, playerId) {
  const normalizedName = String(playerName || "").trim();
  if (!normalizedName) {
    throw new Error("Player name is required.");
  }

  const existingPlayer = roomState.players.find((player) => player.id === playerId);
  if (existingPlayer) {
    return roomState;
  }

  if (roomState.players.length >= MAX_PLAYERS) {
    throw new Error("This room already has two players.");
  }

  const nextPlayers = [
    ...roomState.players,
    {
      id: playerId,
      name: normalizedName.slice(0, 20),
      position: STARTING_POSITION,
      token: PLAYER_TOKENS[roomState.players.length],
      color: PLAYER_COLORS[roomState.players.length]
    }
  ];

  return {
    ...roomState,
    players: nextPlayers,
    status: nextPlayers.length === MAX_PLAYERS ? "playing" : "waiting",
    updatedAt: Date.now()
  };
}

export function getPlayerIndex(roomState, playerId) {
  return roomState.players.findIndex((player) => player.id === playerId);
}

export function canPlayerRoll(roomState, playerId) {
  if (roomState.status !== "playing") {
    return false;
  }

  return roomState.players[roomState.currentTurn]?.id === playerId;
}

export function rollDice(roomState, playerId, randomValue = Math.random()) {
  const playerIndex = getPlayerIndex(roomState, playerId);
  if (playerIndex === -1) {
    throw new Error("You are not part of this room.");
  }

  if (roomState.status === "waiting") {
    throw new Error("Waiting for the second player to join.");
  }

  if (roomState.status === "finished") {
    throw new Error("This match is already finished.");
  }

  if (playerIndex !== roomState.currentTurn) {
    throw new Error("It is not your turn yet.");
  }

  const dice = Math.max(1, Math.min(6, Math.floor(randomValue * 6) + 1));
  const player = roomState.players[playerIndex];
  const attemptedPosition = player.position + dice;
  const landedPosition = attemptedPosition <= BOARD_SIZE ? attemptedPosition : player.position;
  const transportTarget = TRANSPORTS[landedPosition] ?? landedPosition;
  const movementType = transportTarget > landedPosition ? "ladder" : transportTarget < landedPosition ? "snake" : "move";
  const didWin = transportTarget === BOARD_SIZE;
  const keepsTurn = dice === 6 && !didWin;

  const nextPlayers = roomState.players.map((entry, index) =>
    index === playerIndex
      ? {
          ...entry,
          position: transportTarget
        }
      : entry
  );

  return {
    ...roomState,
    players: nextPlayers,
    currentTurn: didWin ? roomState.currentTurn : keepsTurn ? roomState.currentTurn : (roomState.currentTurn + 1) % roomState.players.length,
    lastRoll: {
      playerId,
      dice,
      from: player.position,
      to: transportTarget,
      attempted: attemptedPosition,
      movementType,
      keepsTurn
    },
    status: didWin ? "finished" : roomState.status,
    winnerId: didWin ? playerId : null,
    updatedAt: Date.now()
  };
}

export function serializeRoomForPlayer(roomState, playerId) {
  const playerIndex = getPlayerIndex(roomState, playerId);
  const currentPlayer = playerIndex >= 0 ? roomState.players[playerIndex] : null;

  return {
    roomId: roomState.roomId,
    status: roomState.status,
    players: roomState.players,
    currentTurn: roomState.currentTurn,
    currentTurnPlayerId: roomState.players[roomState.currentTurn]?.id ?? null,
    winnerId: roomState.winnerId,
    lastRoll: roomState.lastRoll,
    you: currentPlayer,
    boardSize: BOARD_SIZE,
    transports: TRANSPORTS
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
