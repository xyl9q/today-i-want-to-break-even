import assert from 'node:assert/strict';
import test from 'node:test';
import { CAREER_KEY, clearCareer, loadCareer, parseCareer, parseSettings, storeCareer, type KeyValueStorage } from '../src/persistence.ts';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

test('career saves survive a storage round trip', () => {
  const storage = new MemoryStorage();
  const save = { version: 1 as const, nextDay: 2, cash: 95200, tokens: 7, checkInStreak: 3, positions: [{ symbol: 'MFCM' as const, shares: 200, averageCost: 18.5, lastPrice: 19.2 }], cumulativeCaught: 1, bestAssets: 101200, updatedAt: '2026-11-25T00:00:00.000Z' };
  storeCareer(storage, save);
  assert.deepEqual(loadCareer(storage), save);
  clearCareer(storage);
  assert.equal(storage.getItem(CAREER_KEY), null);
});

test('invalid or corrupt career data is ignored', () => {
  assert.equal(parseCareer('{broken'), null);
  assert.equal(parseCareer(JSON.stringify({ version: 1, nextDay: 0, cash: -1, positions: [] })), null);
});

test('settings fall back safely while preserving valid choices', () => {
  assert.deepEqual(parseSettings(null), { version: 1, speed: 2, sound: true, vibration: true, autoSave: true });
  assert.deepEqual(parseSettings(JSON.stringify({ speed: 3, sound: false, vibration: false, autoSave: false })), { version: 1, speed: 3, sound: false, vibration: false, autoSave: false });
});
