import test from "node:test";
import assert from "node:assert/strict";

import { addPlayer, buildBoardCells, canPlayerRoll, createRoomState, rollDice, serializeRoomForPlayer } from "../src/game.js";

test("starts the match when the second player joins", () => {
  let room = createRoomState("AB12");
  room = addPlayer(room, "Asha", "player-1");
  room = addPlayer(room, "Rohan", "player-2");

  assert.equal(room.status, "playing");
  assert.equal(room.players.length, 2);
  assert.equal(room.players[0].position, 1);
});

test("prevents rolling before both players are in the room", () => {
  let room = createRoomState("AB12");
  room = addPlayer(room, "Asha", "player-1");

  assert.equal(canPlayerRoll(room, "player-1"), false);
});

test("moves a player forward and hands over the turn", () => {
  let room = createRoomState("AB12");
  room = addPlayer(room, "Asha", "player-1");
  room = addPlayer(room, "Rohan", "player-2");

  const nextRoom = rollDice(room, "player-1", 0.33);

  assert.equal(nextRoom.players[0].position, 3);
  assert.equal(nextRoom.currentTurn, 1);
  assert.equal(nextRoom.lastRoll.dice, 2);
});

test("grants another turn on a roll of six", () => {
  let room = createRoomState("AB12");
  room = addPlayer(room, "Asha", "player-1");
  room = addPlayer(room, "Rohan", "player-2");

  const nextRoom = rollDice(room, "player-1", 0.99);

  assert.equal(nextRoom.players[0].position, 7);
  assert.equal(nextRoom.currentTurn, 0);
  assert.equal(nextRoom.lastRoll.keepsTurn, true);
});

test("applies ladders and snakes", () => {
  let room = createRoomState("AB12");
  room = addPlayer(room, "Asha", "player-1");
  room = addPlayer(room, "Rohan", "player-2");

  const ladderRoom = rollDice(room, "player-1", 0.34);
  assert.equal(ladderRoom.players[0].position, 14);
  assert.equal(ladderRoom.lastRoll.movementType, "ladder");

  const snakeReady = {
    ...ladderRoom,
    currentTurn: 0,
    players: ladderRoom.players.map((player, index) =>
      index === 0 ? { ...player, position: 16 } : player
    )
  };
  const snakeRoom = rollDice(snakeReady, "player-1", 0);

  assert.equal(snakeRoom.players[0].position, 7);
  assert.equal(snakeRoom.lastRoll.movementType, "snake");
});

test("requires an exact roll to finish", () => {
  let room = createRoomState("AB12");
  room = addPlayer(room, "Asha", "player-1");
  room = addPlayer(room, "Rohan", "player-2");
  room = {
    ...room,
    players: room.players.map((player, index) =>
      index === 0 ? { ...player, position: 98 } : player
    )
  };

  const overshootRoom = rollDice(room, "player-1", 0.66);
  assert.equal(overshootRoom.players[0].position, 98);

  const winningRoom = rollDice(
    {
      ...room,
      players: room.players.map((player, index) =>
        index === 0 ? { ...player, position: 94 } : player
      )
    },
    "player-1",
    0.99
  );

  assert.equal(winningRoom.players[0].position, 100);
  assert.equal(winningRoom.status, "finished");
  assert.equal(winningRoom.winnerId, "player-1");
});

test("serializes room state for the current player", () => {
  let room = createRoomState("AB12");
  room = addPlayer(room, "Asha", "player-1");
  room = addPlayer(room, "Rohan", "player-2");

  const view = serializeRoomForPlayer(room, "player-2");

  assert.equal(view.you.name, "Rohan");
  assert.equal(view.currentTurnPlayerId, "player-1");
});

test("builds a 10 by 10 serpentine board", () => {
  const cells = buildBoardCells();
  const start = cells.find((cell) => cell.value === 1);
  const end = cells.find((cell) => cell.value === 100);

  assert.equal(cells.length, 100);
  assert.deepEqual(start, { value: 1, row: 0, column: 0, destination: null });
  assert.deepEqual(end, { value: 100, row: 9, column: 0, destination: null });
});
