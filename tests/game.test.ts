import assert from 'node:assert/strict';
import test from 'node:test';
import { DeskTraderGame, formatGameTime } from '../src/game.ts';

test('starts with a deterministic fictional market', () => {
  const first = new DeskTraderGame(7);
  const second = new DeskTraderGame(7);
  assert.equal(first.state.cash, 100000);
  assert.equal(first.state.stocks.length, 5);
  assert.deepEqual(first.state.stocks, second.state.stocks);
  assert.equal(first.isMarketOpen(), false);
});

test('market orders change cash and positions', () => {
  const game = new DeskTraderGame(3);
  game.advance(10);
  const price = game.getStock().price;
  assert.equal(game.placeOrder('buy', 200, price), true);
  assert.equal(game.getStock().shares, 200);
  assert.equal(game.state.cash, Math.round((100000 - price * 200) * 100) / 100);
  assert.equal(game.placeOrder('sell', 100, 0), true);
  assert.equal(game.getStock().shares, 100);
});

test('unmarketable limit orders wait and can be cancelled', () => {
  const game = new DeskTraderGame(4);
  game.advance(10);
  assert.equal(game.placeOrder('buy', 100, 1), true);
  assert.equal(game.state.orders.length, 1);
  game.cancelOrder(game.state.orders[0].id);
  assert.equal(game.state.orders.length, 0);
});

test('work tasks reduce exposure and improve progress', () => {
  const game = new DeskTraderGame(5);
  game.state.suspicion = 40;
  assert.equal(game.completeTask(1), true);
  assert.equal(game.state.tasks[0].completed, true);
  assert.equal(game.state.workProgress, 27);
  assert.equal(game.state.suspicion, 30);
});

test('panic key protects the player during a boss check', () => {
  const safe = new DeskTraderGame(6);
  safe.advance(44);
  assert.equal(safe.state.bossState, 'approaching');
  assert.equal(safe.bossCountdown(), 5);
  safe.panic();
  safe.advance(5);
  assert.equal(safe.state.bossState, 'checking');
  assert.equal(safe.state.caughtCount, 0);

  const caught = new DeskTraderGame(6);
  caught.advance(49);
  assert.equal(caught.state.caughtCount, 1);
});

test('career start carries cash, tokens, holdings and previous closes', () => {
  const game = new DeskTraderGame(13, {
    day: 3,
    cash: 81234.56,
    tokens: 9,
    checkInStreak: 4,
    positions: [{ symbol: 'CASH', shares: 400, averageCost: 30.5, lastPrice: 34.2 }],
  });
  assert.equal(game.state.day, 3);
  assert.equal(game.state.cash, 81234.56);
  assert.equal(game.state.tokens, 9);
  assert.equal(game.state.checkInStreak, 4);
  assert.equal(game.getStock('CASH').shares, 400);
  assert.equal(game.getStock('CASH').averageCost, 30.5);
  assert.equal(game.getStock('CASH').previousClose, 34.2);
  assert.equal(game.getStock('CASH').price, 34.2);
  assert.deepEqual(game.getStock('CASH').history, [34.2]);
  assert.equal(game.state.initialAssets, game.totalAssets());
});

test('daily news rotates and check-in streak increments', () => {
  const first = new DeskTraderGame(21);
  const second = new DeskTraderGame(21, { day: 2, cash: 100000, tokens: 2, checkInStreak: 1, positions: [] });
  assert.notDeepEqual(first.state.news.map((item) => item.title), second.state.news.map((item) => item.title));
  second.checkIn();
  assert.equal(second.state.checkInStreak, 2);
});

test('station requires check-in and a correct color sequence', () => {
  const game = new DeskTraderGame(9);
  game.switchApp('ide');
  game.advance(140);
  game.switchApp('station');
  assert.equal(game.state.time, 700);
  assert.equal(game.startClaim(), false);
  game.checkIn();
  assert.equal(game.startClaim(), true);
  const sequence = [...game.state.claimSequence];
  for (const color of sequence) assert.equal(game.submitClaimColor(color), true);
  assert.equal(game.state.claimUsed, true);
  assert.ok(game.state.tokens >= 7);
});

test('perks spend tokens and apply their effects', () => {
  const game = new DeskTraderGame(11);
  game.state.tokens = 10;
  game.state.suspicion = 50;
  assert.equal(game.buyPerk('coffee'), true);
  assert.equal(game.state.tokens, 7);
  assert.equal(game.state.suspicion, 26);
  assert.equal(game.buyPerk('radar'), true);
  assert.ok(game.state.radarUntil > game.state.time);
});

test('the day ends at market close', () => {
  const game = new DeskTraderGame(12);
  game.switchApp('ide');
  game.advance(400);
  assert.equal(game.state.time, 900);
  assert.equal(game.state.ended, true);
  assert.equal(formatGameTime(game.state.time), '15:00');
});
