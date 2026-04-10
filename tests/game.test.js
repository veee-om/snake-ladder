import test from "node:test";
import assert from "node:assert/strict";

import {
  addPlayerToGame,
  buildBoardCells,
  createRoomGame,
  restartRoomGame,
  rollForPlayer
} from "../src/game.js";

test("creates a waiting room with the host player", () => {
  const game = createRoomGame("Vyom", {
    idFactory: sequenceIds(["host-1"])
  });

  assert.equal(game.status, "waiting");
  assert.equal(game.players.length, 1);
  assert.equal(game.players[0].name, "Vyom");
  assert.equal(game.players[0].token, "A");
});

test("joining the second player starts the match", () => {
  const waitingGame = createRoomGame("Vyom", {
    idFactory: sequenceIds(["host-1"])
  });
  const game = addPlayerToGame(waitingGame, "Asha", {
    idFactory: sequenceIds(["guest-2"])
  });

  assert.equal(game.status, "playing");
  assert.equal(game.players.length, 2);
  assert.equal(game.players[1].name, "Asha");
  assert.equal(game.players[1].token, "B");
});

test("rejects joining a full room", () => {
  const waitingGame = createRoomGame("Vyom", {
    idFactory: sequenceIds(["host-1"])
  });
  const fullGame = addPlayerToGame(waitingGame, "Asha", {
    idFactory: sequenceIds(["guest-2"])
  });

  assert.throws(
    () => addPlayerToGame(fullGame, "Rohan", { idFactory: sequenceIds(["guest-3"]) }),
    /already full/
  );
});

test("prevents rolling until both players have joined", () => {
  const game = createRoomGame("Vyom", {
    idFactory: sequenceIds(["host-1"])
  });

  assert.throws(() => rollForPlayer(game, "host-1", 0.4), /Waiting for another player to join/);
});

test("only the active player can roll", () => {
  const playingGame = addPlayerToGame(
    createRoomGame("Vyom", {
      idFactory: sequenceIds(["host-1"])
    }),
    "Asha",
    { idFactory: sequenceIds(["guest-2"]) }
  );

  assert.throws(() => rollForPlayer(playingGame, "guest-2", 0.4), /not your turn/);
});

test("moves the active player forward and passes the turn", () => {
  const game = addPlayerToGame(
    createRoomGame("Vyom", {
      idFactory: sequenceIds(["host-1"])
    }),
    "Asha",
    { idFactory: sequenceIds(["guest-2"]) }
  );
  const nextGame = rollForPlayer(game, "host-1", 0.33);

  assert.equal(nextGame.players[0].position, 3);
  assert.equal(nextGame.currentTurn, 1);
  assert.equal(nextGame.lastRoll.dice, 2);
});

test("grants another turn on a roll of six", () => {
  const game = addPlayerToGame(
    createRoomGame("Vyom", {
      idFactory: sequenceIds(["host-1"])
    }),
    "Asha",
    { idFactory: sequenceIds(["guest-2"]) }
  );
  const nextGame = rollForPlayer(game, "host-1", 0.99);

  assert.equal(nextGame.players[0].position, 7);
  assert.equal(nextGame.currentTurn, 0);
  assert.equal(nextGame.lastRoll.keepsTurn, true);
});

test("applies ladders and snakes", () => {
  const game = addPlayerToGame(
    createRoomGame("Vyom", {
      idFactory: sequenceIds(["host-1"])
    }),
    "Asha",
    { idFactory: sequenceIds(["guest-2"]) }
  );
  const ladderGame = rollForPlayer(game, "host-1", 0.34);

  assert.equal(ladderGame.players[0].position, 14);
  assert.equal(ladderGame.lastRoll.movementType, "ladder");

  const snakeReady = {
    ...ladderGame,
    currentTurn: 0,
    players: ladderGame.players.map((player) =>
      player.id === "host-1" ? { ...player, position: 16 } : player
    )
  };
  const snakeGame = rollForPlayer(snakeReady, "host-1", 0);

  assert.equal(snakeGame.players[0].position, 7);
  assert.equal(snakeGame.lastRoll.movementType, "snake");
});

test("requires an exact roll to finish", () => {
  const game = addPlayerToGame(
    createRoomGame("Vyom", {
      idFactory: sequenceIds(["host-1"])
    }),
    "Asha",
    { idFactory: sequenceIds(["guest-2"]) }
  );
  const overshootReady = {
    ...game,
    players: game.players.map((player) =>
      player.id === "host-1" ? { ...player, position: 98 } : player
    )
  };
  const overshootGame = rollForPlayer(overshootReady, "host-1", 0.66);

  assert.equal(overshootGame.players[0].position, 98);

  const winningReady = {
    ...game,
    players: game.players.map((player) =>
      player.id === "host-1" ? { ...player, position: 94 } : player
    )
  };
  const winningGame = rollForPlayer(winningReady, "host-1", 0.99);

  assert.equal(winningGame.players[0].position, 100);
  assert.equal(winningGame.status, "finished");
  assert.equal(winningGame.winnerId, "host-1");
});

test("restart keeps both players and resets the board", () => {
  const game = addPlayerToGame(
    createRoomGame("Vyom", {
      idFactory: sequenceIds(["host-1"])
    }),
    "Asha",
    { idFactory: sequenceIds(["guest-2"]) }
  );
  const progressed = {
    ...game,
    currentTurn: 1,
    players: game.players.map((player, index) => ({
      ...player,
      position: 50 + index
    })),
    lastRoll: { dice: 3 }
  };
  const restarted = restartRoomGame(progressed);

  assert.equal(restarted.status, "playing");
  assert.equal(restarted.currentTurn, 0);
  assert.equal(restarted.lastRoll, null);
  assert.deepEqual(
    restarted.players.map((player) => player.position),
    [1, 1]
  );
});

test("builds a 10 by 10 serpentine board", () => {
  const cells = buildBoardCells();
  const start = cells.find((cell) => cell.value === 1);
  const end = cells.find((cell) => cell.value === 100);

  assert.equal(cells.length, 100);
  assert.deepEqual(start, { value: 1, row: 0, column: 0, destination: null });
  assert.deepEqual(end, { value: 100, row: 9, column: 0, destination: null });
});

function sequenceIds(ids) {
  let index = 0;

  return () => {
    const value = ids[index];
    index += 1;
    return value;
  };
}
