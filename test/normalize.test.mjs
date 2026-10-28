import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFootball, normalizeBasketball, normalizeVolleyball } from '../worker/src/normalize.js';
import { footballItem, basketballItem, volleyballItem } from './fixtures.mjs';

test('football: scheduled match has no score', () => {
  const m = normalizeFootball(footballItem());
  assert.equal(m.state, 'scheduled');
  assert.equal(m.score, null);
  assert.equal(m.id, 'fb1001');
  assert.equal(m.league.key, 'football:39');
  assert.equal(m.league.country, 'England');
  assert.equal(m.start, Date.parse('2026-10-26T15:00:00Z'));
});

test('football: live first half shows the minute', () => {
  const m = normalizeFootball(footballItem({ short: '1H', elapsed: 23, gh: 1, ga: 0 }));
  assert.equal(m.state, 'live');
  assert.equal(m.label, "23'");
  assert.deepEqual(m.score, [1, 0]);
  assert.deepEqual(m.periods, []);
});

test('football: added time is shown as 45+2', () => {
  const m = normalizeFootball(footballItem({ short: '1H', elapsed: 45, extra: 2, gh: 0, ga: 0 }));
  assert.equal(m.label, "45+2'");
});

test('football: half time keeps the first-half score', () => {
  const m = normalizeFootball(footballItem({ short: 'HT', elapsed: 45, gh: 1, ga: 1, hth: 1, hta: 1 }));
  assert.equal(m.state, 'live');
  assert.equal(m.label, 'HT');
  assert.deepEqual(m.periods, [{ h: 1, a: 1 }]);
});

test('football: finished match splits halves', () => {
  const m = normalizeFootball(footballItem({ short: 'FT', elapsed: 90, gh: 3, ga: 1, hth: 1, hta: 0, fth: 3, fta: 1 }));
  assert.equal(m.state, 'finished');
  assert.equal(m.label, 'FT');
  assert.deepEqual(m.score, [3, 1]);
  assert.deepEqual(m.periods, [{ h: 1, a: 0 }, { h: 2, a: 1 }]);
});

test('football: postponed, cancelled and unknown codes', () => {
  assert.equal(normalizeFootball(footballItem({ short: 'PST' })).state, 'postponed');
  assert.equal(normalizeFootball(footballItem({ short: 'CANC' })).state, 'cancelled');
  const odd = normalizeFootball(footballItem({ short: 'ZZZ' }));
  assert.equal(odd.state, 'interrupted');
  assert.equal(odd.label, 'ZZZ');
});

test('football: rows without an id or start are dropped', () => {
  assert.equal(normalizeFootball({}), null);
  const bad = footballItem();
  bad.fixture.timestamp = null;
  bad.fixture.date = 'not a date';
  assert.equal(normalizeFootball(bad), null);
});

test('basketball: live third quarter sums the periods when total is missing', () => {
  const m = normalizeBasketball(basketballItem({ short: 'Q3', h: [28, 30, 12], a: [25, 27, 14] }));
  assert.equal(m.state, 'live');
  assert.equal(m.label, 'Q3');
  assert.deepEqual(m.score, [70, 66]);
  assert.equal(m.periods.length, 3);
  assert.equal(m.periods[2].live, true);
});

test('basketball: final with overtime', () => {
  const m = normalizeBasketball(basketballItem({ short: 'AOT', h: [25, 25, 25, 25, 10], a: [25, 25, 25, 25, 8], ht: 110, at: 108 }));
  assert.equal(m.state, 'finished');
  assert.equal(m.label, 'Final OT');
  assert.deepEqual(m.score, [110, 108]);
  assert.equal(m.periods.length, 5);
});

test('volleyball: live fourth set, sets won as score', () => {
  const m = normalizeVolleyball(volleyballItem({ short: 'S4', sh: 2, sa: 1, p: [[25, 20], [22, 25], [25, 23], [10, 8]] }));
  assert.equal(m.state, 'live');
  assert.equal(m.label, 'Set 4');
  assert.deepEqual(m.score, [2, 1]);
  assert.equal(m.periods.length, 4);
  assert.equal(m.periods[3].live, true);
});

test('volleyball: finished 3-0', () => {
  const m = normalizeVolleyball(volleyballItem({ short: 'FT', sh: 3, sa: 0, p: [[25, 20], [25, 22], [25, 23]] }));
  assert.equal(m.state, 'finished');
  assert.deepEqual(m.score, [3, 0]);
  assert.ok(!m.periods.some((p) => p.live));
});
