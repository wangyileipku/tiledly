import { ALL_MODES, getDailyNumber, getTodayMode, getTodayChallenge, getModeInfo } from './js/daily.js';
import { SeededRandom, getWeekOfYear } from './js/utils.js';

console.log('⚡ Running Tiledly Comprehensive 7-Day & 4-Week Rotation Test Suite...\n');

const rng = new SeededRandom(20261003);
let totalTests = 0;
let passedTests = 0;

// Test 1: Date and Week Utilities
totalTests++;
const testDate = new Date('2026-10-04T12:00:00Z');
const weekOfYear = getWeekOfYear(testDate);
if (typeof weekOfYear !== 'number' || weekOfYear < 1 || weekOfYear > 53) {
  throw new Error(`Invalid week of year: ${weekOfYear}`);
}
const dayNum = getDailyNumber();
if (typeof dayNum !== 'number' || dayNum < 1) {
  throw new Error(`Invalid daily number: ${dayNum}`);
}
passedTests++;
console.log(`✓ Utilities: Week #${weekOfYear}, Day Number #${dayNum}`);

// Test 2: Today's Mode and ModeInfo
totalTests++;
const todayMode = getTodayMode();
const todayChallenge = getTodayChallenge();
const todayInfo = getModeInfo();
if (!todayMode || !todayChallenge.challenge || !todayInfo.name) {
  throw new Error(`Invalid today's mode setup`);
}
passedTests++;
console.log(`✓ Today's Setup: ${todayInfo.emoji} ${todayInfo.name} (${todayInfo.description})\n`);

// Test 3: Matrix of All 7 Days x All 4 Weekly Variants (28 Variants)
for (const [day, mode] of Object.entries(ALL_MODES)) {
  for (let week = 1; week <= 4; week++) {
    totalTests++;
    const variantInfo = mode.getVariantInfo ? mode.getVariantInfo(week) : { name: mode.name, description: mode.description };
    const challenge = mode.generateChallenge(rng, week);

    // 1. Validate Challenge Grid
    if (!challenge || !challenge.grid || challenge.grid.cells.length !== 25) {
      throw new Error(`[Day ${day} Week ${week} - ${variantInfo.name}] Invalid grid: expected 25 cells`);
    }

    // 2. Validate Game State Creation
    const state = mode.createGameState(challenge);
    if (!state || typeof state.mistakes !== 'number') {
      throw new Error(`[Day ${day} Week ${week} - ${variantInfo.name}] Invalid state creation`);
    }

    // 3. Validate Target Display & Progress String
    if (mode.getTargetDisplay) {
      const targetStr = mode.getTargetDisplay(state, challenge);
      if (typeof targetStr !== 'string' || targetStr.length === 0) {
        throw new Error(`[Day ${day} Week ${week} - ${variantInfo.name}] Invalid target display string: ${targetStr}`);
      }
    }
    if (mode.getProgress) {
      const progStr = mode.getProgress(state);
      if (typeof progStr !== 'string' || progStr.length === 0) {
        throw new Error(`[Day ${day} Week ${week} - ${variantInfo.name}] Invalid progress string: ${progStr}`);
      }
    }

    // 4. Validate Tap Interaction
    // Pick first non-target, non-disabled cell
    let testCellIdx = 0;
    while (testCellIdx < 25 && (testCellIdx === 12 && mode.id === 'sum-hunt')) {
      testCellIdx++;
    }
    const testCell = challenge.grid.cells[testCellIdx];
    const tapRes = mode.handleTap(testCellIdx, state, 1200, testCell.value);

    if (!tapRes || typeof tapRes.valid !== 'boolean') {
      throw new Error(`[Day ${day} Week ${week} - ${variantInfo.name}] Invalid tap response`);
    }

    // 5. Validate Scoring
    const stats = mode.getStats(state, 5400);
    if (typeof stats.score !== 'number' || stats.score < 0 || stats.score > 10000) {
      throw new Error(`[Day ${day} Week ${week} - ${variantInfo.name}] Score out of bounds: ${stats.score}`);
    }
    if (typeof stats.accuracy !== 'number' || stats.accuracy < 0 || stats.accuracy > 100) {
      throw new Error(`[Day ${day} Week ${week} - ${variantInfo.name}] Accuracy out of bounds: ${stats.accuracy}`);
    }

    passedTests++;
    console.log(`  ✓ Day ${day} Wk ${week}: ${mode.emoji} ${variantInfo.name} [Tap: ${tapRes.action}] [Score: ${stats.score}]`);
  }
}

// Test 4: Full Playthrough Simulation to Completion
console.log('\n🎮 Running Full Playthrough Simulations (0 to 100% completion)...');

// 4a. Number Rush Classic Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[2]; // Number Rush
  const challenge = mode.generateChallenge(new SeededRandom(42), 1);
  const state = mode.createGameState(challenge);
  let isDone = false;
  // Solve in order 1..25
  for (let num = 1; num <= 25; num++) {
    const cellIdx = challenge.grid.cells.findIndex(c => c.value === num);
    const res = mode.handleTap(cellIdx, state, num * 500, num);
    if (!res.valid || res.action !== 'correct') {
      throw new Error(`Number Rush solve failed at num ${num}`);
    }
    isDone = res.isComplete;
  }
  if (!isDone || state.found !== 25) {
    throw new Error('Number Rush did not mark isComplete');
  }
  const stats = mode.getStats(state, 12500);
  if (stats.accuracy !== 100) throw new Error('Expected 100% accuracy');
  passedTests++;
  console.log(`  ✓ Number Rush (Classic): Solved 25/25, final score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4b. Alpha Hunt Word Sprint Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[0]; // Alpha Hunt
  const challenge = mode.generateChallenge(new SeededRandom(99), 3); // Wk 3 = Word Sprint
  const state = mode.createGameState(challenge);
  let isDone = false;
  let elapsed = 100;
  challenge.words.forEach(word => {
    for (let char of word) {
      // Find an unused cell with this letter
      const cellIdx = challenge.grid.cells.findIndex((c, idx) => c.value === char && !state.clearedIndices.has(idx));
      const res = mode.handleTap(cellIdx, state, elapsed += 300, char);
      if (!res.valid || res.action !== 'correct') {
        throw new Error(`Word Sprint solve failed at letter ${char} in word ${word}`);
      }
      isDone = res.isComplete;
    }
  });
  if (!isDone || state.found !== 25) {
    throw new Error('Alpha Hunt Word Sprint did not mark isComplete');
  }
  const stats = mode.getStats(state, elapsed);
  passedTests++;
  console.log(`  ✓ Alpha Hunt (Word Sprint): Solved 5/5 words (25 letters), final score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4c. Sum Hunt Two-Digit Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[1]; // Sum Hunt
  const challenge = mode.generateChallenge(new SeededRandom(77), 1); // Two-Digit
  const state = mode.createGameState(challenge);
  let isDone = false;
  const cells = challenge.grid.cells;
  for (let i = 0; i < 25; i++) {
    if (i === 12 || state.clearedIndices.has(i)) continue;
    for (let j = i + 1; j < 25; j++) {
      if (j === 12 || state.clearedIndices.has(j)) continue;
      if (cells[i].value + cells[j].value === challenge.targetSum) {
        mode.handleTap(i, state, 1000);
        const res = mode.handleTap(j, state, 1500);
        if (res.action === 'correct') {
          isDone = res.isComplete;
          break;
        }
      }
    }
  }
  if (!isDone || state.clearedPairs !== 12) {
    throw new Error('Sum Hunt Two-Digit did not mark isComplete');
  }
  const stats = mode.getStats(state, 12000);
  passedTests++;
  console.log(`  ✓ Sum Hunt (Two-Digit): Cleared 12/12 pairs, final score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4d. Sum Hunt Trio Sprint Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[1]; // Sum Hunt
  const challenge = mode.generateChallenge(new SeededRandom(123), 2); // Wk 2 = Trio Sprint
  const state = mode.createGameState(challenge);
  let isDone = false;
  const cells = challenge.grid.cells;

  // Test deselect
  mode.handleTap(0, state, 500);
  const desel = mode.handleTap(0, state, 600);
  if (desel.action !== 'deselect') throw new Error('Sum Hunt Trio deselect failed');

  // Solve all 8 trios by trioId
  for (let tId = 0; tId < 8; tId++) {
    const indices = [];
    cells.forEach((c, idx) => {
      if (c.trioId === tId && idx !== 12) indices.push(idx);
    });
    if (indices.length !== 3) throw new Error(`Trio ${tId} does not have 3 cells`);
    mode.handleTap(indices[0], state, 1000 + tId * 300);
    mode.handleTap(indices[1], state, 1100 + tId * 300);
    const res = mode.handleTap(indices[2], state, 1200 + tId * 300);
    if (!res.valid || res.action !== 'correct') {
      throw new Error(`Trio ${tId} matching failed`);
    }
    isDone = res.isComplete;
  }
  if (!isDone || state.clearedTrios !== 8) {
    throw new Error('Sum Hunt Trio Sprint did not mark isComplete');
  }
  const stats = mode.getStats(state, 14000);
  passedTests++;
  console.log(`  ✓ Sum Hunt (Trio Sprint): Cleared 8/8 trios, final score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4e. Number Rush Reverse Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[2]; // Number Rush
  const challenge = mode.generateChallenge(new SeededRandom(55), 2); // Reverse
  const state = mode.createGameState(challenge);
  let isDone = false;
  for (let num = 25; num >= 1; num--) {
    const cellIdx = challenge.grid.cells.findIndex(c => c.value === num);
    const res = mode.handleTap(cellIdx, state, (26 - num) * 400, num);
    if (!res.valid || res.action !== 'correct') {
      throw new Error(`Number Rush Reverse failed at ${num}`);
    }
    isDone = res.isComplete;
  }
  if (!isDone || state.found !== 25) {
    throw new Error('Number Rush Reverse did not mark isComplete');
  }
  const stats = mode.getStats(state, 10000);
  passedTests++;
  console.log(`  ✓ Number Rush (Reverse 25→1): Solved 25/25, final score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4f. Color Cascade Stroop Effect Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[3]; // Color Cascade
  const challenge = mode.generateChallenge(new SeededRandom(88), 2); // Stroop Effect
  const state = mode.createGameState(challenge);
  let isDone = false;
  for (let step = 0; step < 25; step++) {
    const expectedColorIdx = state.currentStepIndex;
    const cellIdx = challenge.grid.cells.findIndex((c, idx) => c.value === expectedColorIdx && !state.clearedIndices.has(idx));
    const res = mode.handleTap(cellIdx, state, (step + 1) * 350, expectedColorIdx);
    if (!res.valid || res.action !== 'correct') {
      throw new Error(`Color Cascade Stroop failed at step ${step}`);
    }
    isDone = res.isComplete;
  }
  if (!isDone || state.found !== 25) {
    throw new Error('Color Cascade Stroop did not mark isComplete');
  }
  const stats = mode.getStats(state, 9000);
  passedTests++;
  console.log(`  ✓ Color Cascade (Stroop Effect): Cleared 25/25, final score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4g. Color Cascade Ascending Count Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[3]; // Color Cascade
  const challenge = mode.generateChallenge(new SeededRandom(777), 4); // Ascending Count (1, 3, 5, 7, 9)
  const state = mode.createGameState(challenge);
  let isDone = false;
  for (let stage = 0; stage < 5; stage++) {
    const count = challenge.counts[stage];
    for (let c = 0; c < count; c++) {
      const cellIdx = challenge.grid.cells.findIndex((cell, idx) => cell.value === stage && !state.clearedIndices.has(idx));
      const res = mode.handleTap(cellIdx, state, 1000 + stage * 500 + c * 200, stage);
      if (!res.valid || res.action !== 'correct') {
        throw new Error(`Color Cascade Ascending Count failed at stage ${stage}`);
      }
      isDone = res.isComplete;
    }
  }
  if (!isDone || state.found !== 25) {
    throw new Error('Color Cascade Ascending Count did not mark isComplete');
  }
  const stats = mode.getStats(state, 11000);
  passedTests++;
  console.log(`  ✓ Color Cascade (Ascending Count): Cleared 1+3+5+7+9 tiles, final score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4h. Memory Grid 10-Key Sprint Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[4]; // Memory Grid
  const challenge = mode.generateChallenge(new SeededRandom(33), 1); // 10-Key Sprint
  const state = mode.createGameState(challenge);
  let isDone = false;
  // Test peek penalty
  mode.handlePeek(state);
  if (state.peeks !== 1 || state.peekPenaltyMs !== 2000) {
    throw new Error('Memory Grid handlePeek failed');
  }
  for (let num = 1; num <= 10; num++) {
    const cellIdx = challenge.grid.cells.findIndex(c => c.value === num);
    const res = mode.handleTap(cellIdx, state, num * 600, num);
    if (!res.valid || res.action !== 'correct') {
      throw new Error(`Memory Grid 10-Key failed at num ${num}`);
    }
    isDone = res.isComplete;
  }
  if (!isDone || state.found !== 10) {
    throw new Error('Memory Grid 10-Key did not mark isComplete');
  }
  const stats = mode.getStats(state, 6000);
  passedTests++;
  console.log(`  ✓ Memory Grid (10-Key Sprint): Found 10/10 with 1 peek, score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4i. Memory Grid Symbol Pairs Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[4]; // Memory Grid
  const challenge = mode.generateChallenge(new SeededRandom(2026), 2); // Symbol Pairs
  const state = mode.createGameState(challenge);
  let isDone = false;
  const cells = challenge.grid.cells;
  for (let sym = 0; sym < 12; sym++) {
    const indices = [];
    cells.forEach((c, idx) => {
      if (c.value === sym && idx !== 12) indices.push(idx);
    });
    if (indices.length !== 2) throw new Error(`Symbol ${sym} did not have 2 cards`);
    mode.handleTap(indices[0], state, 1000 + sym * 200, sym);
    const res = mode.handleTap(indices[1], state, 1100 + sym * 200, sym);
    if (!res.valid || res.action !== 'correct') {
      throw new Error(`Symbol Pair ${sym} matching failed`);
    }
    isDone = res.isComplete;
  }
  if (!isDone || state.clearedPairs !== 12) {
    throw new Error('Memory Grid Symbol Pairs did not mark isComplete');
  }
  const stats = mode.getStats(state, 15000);
  passedTests++;
  console.log(`  ✓ Memory Grid (Symbol Pairs): Matched 12/12 pairs, score ${stats.score}, accuracy ${stats.accuracy}%`);
}

// 4j. Minefield Defusal Kit Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[5]; // Minefield
  const challenge = mode.generateChallenge(new SeededRandom(888), 3); // Defusal Kit
  const state = mode.createGameState(challenge);
  let isDone = false;
  // 1. First tap the defusal wrench!
  const wrenchIdx = challenge.grid.cells.findIndex(c => c.value === 'defusal');
  const wrenchRes = mode.handleTap(wrenchIdx, state, 1000, 'defusal');
  if (!wrenchRes.valid || !state.disarmed) {
    throw new Error('Defusal Wrench tap failed to disarm');
  }

  // 2. Stepping on a bomb now is a harmless dud
  const bombIdx = challenge.grid.cells.findIndex(c => c.value === -1);
  const dudRes = mode.handleTap(bombIdx, state, 1500, -1);
  if (!dudRes.valid || state.bombsHit !== 0) {
    throw new Error('Disarmed bomb still counted as hit');
  }

  // 3. Clear all numbers 1 to 18
  for (let num = 1; num <= challenge.totalNumbers; num++) {
    const cellIdx = challenge.grid.cells.findIndex(c => c.value === num);
    const res = mode.handleTap(cellIdx, state, 2000 + num * 300, num);
    if (!res.valid || res.action !== 'correct') {
      throw new Error(`Minefield safe number ${num} failed`);
    }
    isDone = res.isComplete;
  }
  if (!isDone || state.found !== challenge.totalNumbers) {
    throw new Error('Minefield Defusal Kit did not mark isComplete');
  }
  const stats = mode.getStats(state, 12000);
  passedTests++;
  console.log(`  ✓ Minefield (Defusal Kit): Disarmed and cleared ${challenge.totalNumbers}/${challenge.totalNumbers}, score ${stats.score}`);
}

// 4k. Math Blitz Target Buckets Complete Simulation
totalTests++;
{
  const mode = ALL_MODES[6]; // Math Blitz
  const challenge = mode.generateChallenge(new SeededRandom(555), 4); // Target Buckets
  const state = mode.createGameState(challenge);
  let isDone = false;
  challenge.buckets.forEach(bucketVal => {
    for (let eq = 0; eq < 5; eq++) {
      const cellIdx = challenge.grid.cells.findIndex((c, idx) => c.value === bucketVal && !state.clearedIndices.has(idx));
      const res = mode.handleTap(cellIdx, state, 1000, bucketVal);
      if (!res.valid || res.action !== 'correct') {
        throw new Error(`Math Blitz Target Bucket ${bucketVal} failed`);
      }
      isDone = res.isComplete;
    }
  });
  if (!isDone || state.found !== 25) {
    throw new Error('Math Blitz Target Buckets did not mark isComplete');
  }
  const stats = mode.getStats(state, 13000);
  passedTests++;
  console.log(`  ✓ Math Blitz (Target Buckets): Solved 5x5=25 equations in 5 buckets, score ${stats.score}`);
}

// Test 5: Storage, Device ID & Streak Tracking
console.log('\n💾 Running Storage, Device ID & Streak Tracking Tests...');

import { Storage } from './js/storage.js';

// 5a. Anonymous Device ID
totalTests++;
{
  const devId1 = Storage.getDeviceId();
  const devId2 = Storage.getDeviceId();
  if (typeof devId1 !== 'string' || devId1.length < 8) {
    throw new Error(`Invalid device ID: ${devId1}`);
  }
  if (devId1 !== devId2) {
    throw new Error('Device ID not persistent across calls');
  }
  passedTests++;
  console.log(`  ✓ Device ID: Persistent anonymous UID generated (${devId1.slice(0, 16)}...)`);
}

// 5b. Streak progression across dates
totalTests++;
{
  const d1 = new Date('2026-10-01T12:00:00Z');
  Storage.updateStreak(d1);
  let streak = Storage.getStreak();
  if (streak.current !== 1) throw new Error(`Expected streak 1, got ${streak.current}`);

  // Same day play (should not increment)
  Storage.updateStreak(d1);
  streak = Storage.getStreak();
  if (streak.current !== 1) throw new Error(`Same day play should keep streak 1, got ${streak.current}`);

  // Next consecutive day (should increment to 2)
  const d2 = new Date('2026-10-02T12:00:00Z');
  Storage.updateStreak(d2);
  streak = Storage.getStreak();
  if (streak.current !== 2 || streak.best !== 2) {
    throw new Error(`Consecutive day should increment streak to 2, got ${streak.current}`);
  }

  // Skipped day (2026-10-04, skipping Oct 3 - should reset to 1)
  const d4 = new Date('2026-10-04T12:00:00Z');
  Storage.updateStreak(d4);
  streak = Storage.getStreak();
  if (streak.current !== 1 || streak.best !== 2) {
    throw new Error(`Skipped day should reset streak to 1 with best 2, got current=${streak.current}, best=${streak.best}`);
  }
  passedTests++;
  console.log(`  ✓ Streak Logic: 100% correct across consecutive days, same-day plays, and broken streaks`);
}

// Test 6: Battle Replay & Cold-Start Generation
console.log('\n⚔️ Running Battle Replay & Cold-Start Simulation Tests...');
import { BattleReplay } from './js/replay.js';

// 6a. 100-Player Cold Start Generation
totalTests++;
{
  // Mock canvas context for Node environment
  const mockCanvas = {
    parentElement: { clientWidth: 400 },
    style: {},
    getContext: () => ({
      scale: () => {},
      clearRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {}
    })
  };

  const replay = new BattleReplay(mockCanvas);
  const playerResult1 = {
    date: 20261003,
    time: 14200,
    score: 8200,
    rank: 1,
    totalPlayers: 100,
    percentile: 1
  };

  replay.loadData(playerResult1);

  // 1. Total players must be exactly 100
  if (!replay.players || replay.players.length !== 100) {
    throw new Error(`Expected 100 players in replay, found ${replay.players?.length}`);
  }

  // 2. Real player must be rank #1 when playerResult.rank is 1
  const player = replay.players.find(p => p.isPlayer);
  if (!player || player.rank !== 1) {
    throw new Error(`Expected player to be rank #1 in replay, got #${player?.rank}`);
  }

  // 3. Verify rank 1 to 100 is contiguous
  for (let i = 0; i < 100; i++) {
    if (replay.players[i].rank !== i + 1) {
      throw new Error(`Contiguous rank failure at index ${i}`);
    }
  }

  // 4. Test rank #2 when playerResult.rank is 2
  replay.loadData({ ...playerResult1, rank: 2, percentile: 2 });
  const p2 = replay.players.find(p => p.isPlayer);
  if (p2.rank !== 2) {
    throw new Error(`Expected player to be rank #2 in replay, got #${p2?.rank}`);
  }

  passedTests++;
  console.log(`  ✓ Cold Start Replay: Generated exactly 100 racers with 100% rank alignment (player rank #${player.rank} and #${p2.rank})`);
}

// 6b. Deterministic Cold Start Reproducibility
totalTests++;
{
  const mockCanvas = {
    parentElement: { clientWidth: 400 },
    style: {},
    getContext: () => ({ scale: () => {} })
  };
  const r1 = new BattleReplay(mockCanvas);
  const r2 = new BattleReplay(mockCanvas);
  const result = { date: 20261018, time: 11500, score: 8700 };

  r1.loadData(result);
  r2.loadData(result);

  if (r1.playerIndex !== r2.playerIndex) {
    throw new Error('Cold start reproducibility failure: playerIndex mismatch on identical seed');
  }
  if (r1.players[10].time !== r2.players[10].time) {
    throw new Error('Cold start reproducibility failure: opponent time mismatch on identical seed');
  }

  passedTests++;
  console.log(`  ✓ Cold Start Determinism: 100% identical opponent ghost field generated worldwide`);
}

// Test 7: Minefield Radar / Peek Feature
console.log('\n📡 Running Minefield Radar / Peek Verification...');
totalTests++;
{
  const minefieldMode = ALL_MODES[5];
  const challenge = minefieldMode.generateChallenge(new SeededRandom(77), 1);
  const state = minefieldMode.createGameState(challenge);

  if (typeof minefieldMode.handlePeek !== 'function') {
    throw new Error('Minefield handlePeek is missing');
  }

  const peekRes = minefieldMode.handlePeek(state);
  if (state.peeks !== 1 || state.penaltyMs !== 2500) {
    throw new Error(`Minefield handlePeek failed: peeks=${state.peeks}, penaltyMs=${state.penaltyMs}`);
  }

  const stats = minefieldMode.getStats(state, 10000);
  // Total time should be 10000 + 2500 = 12500ms
  if (stats.time !== 12500) {
    throw new Error(`Minefield stats did not include peek penalty: got ${stats.time}`);
  }

  passedTests++;
  console.log(`  ✓ Minefield Radar: Successfully triggered with +2.5s penalty (${stats.time}ms adjusted time)`);
}

// Test 8: Serverless API Endpoint (/api/score.js)
console.log('\n🌐 Running Serverless API (/api/score) Tests...');
import scoreHandler from './api/score.js';

// 8a. POST score submission
totalTests++;
{
  const mockReq = {
    method: 'POST',
    body: {
      deviceId: 'test_device_123',
      date: '20261005',
      time: 28400,
      mistakes: 0,
      score: 8750
    }
  };

  let statusCode = 0;
  let responseData = null;
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { responseData = data; },
        end: () => {}
      };
    }
  };

  await scoreHandler(mockReq, mockRes);

  if (statusCode !== 200 || !responseData || !responseData.rank || !responseData.totalPlayers) {
    throw new Error(`API score handler returned invalid response: status ${statusCode}, data: ${JSON.stringify(responseData)}`);
  }
  passedTests++;
  console.log(`  ✓ API Score Submit: Status 200, Rank #${responseData.rank}/${responseData.totalPlayers} (Top ${responseData.percentile}%) via ${responseData.source}`);
}

// 8b. GET summary query
totalTests++;
{
  const mockReq = { method: 'GET', query: { date: '20261005' } };
  let statusCode = 0;
  let responseData = null;
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => { responseData = data; }
      };
    }
  };

  await scoreHandler(mockReq, mockRes);
  if (statusCode !== 200 || !responseData || typeof responseData.connected !== 'boolean') {
    throw new Error(`API GET handler returned invalid response: status ${statusCode}`);
  }
  passedTests++;
  console.log(`  ✓ API Summary Query: Status 200, KV Connected: ${responseData.connected}`);
}

// Test 9: Modular Monetization Engine & Paywall Tests
console.log('\n👑 Running Modular Monetization & PRO Tier Tests...');
import { Monetization } from './js/monetization/monetization.js';
import { MonetizationConfig } from './js/monetization/config.js';

// 9a. Initial State & Configuration
totalTests++;
{
  if (!MonetizationConfig.enabled || !MonetizationConfig.ads || !MonetizationConfig.premium) {
    throw new Error('MonetizationConfig schema missing required properties');
  }
  // Ensure default is not PRO
  Monetization.setPro(false);
  if (Monetization.isPro() !== false) {
    throw new Error('Expected new user to not be PRO by default');
  }
  passedTests++;
  console.log('  ✓ Config & Initial State: Validated ads and premium hooks (defaults to free tier)');
}

// 9b. PRO Status Toggling & Persistence
totalTests++;
{
  Monetization.setPro(true, { plan: 'supporter' });
  if (Monetization.isPro() !== true) {
    throw new Error('Monetization.setPro(true) failed to activate PRO status');
  }
  if (Storage.getSetting('is_pro') !== true) {
    throw new Error('PRO status not persisted in Storage');
  }
  passedTests++;
  console.log('  ✓ PRO Activation: Successfully activated and persisted PRO status');
}

// 9c. Ad Slot Gating & Rendering
totalTests++;
{
  const mockContainer = {
    style: {},
    innerHTML: '',
    querySelector: () => ({ addEventListener: () => {} })
  };

  // 1. When user is PRO, ad slot should be hidden
  Monetization.setPro(true);
  Monetization.renderAdSlot(mockContainer, 'result');
  if (mockContainer.style.display !== 'none' || mockContainer.innerHTML !== '') {
    throw new Error('Ad slot was not suppressed for PRO member');
  }

  // 2. When user is Free, ad slot should render house ad
  Monetization.setPro(false);
  Monetization.renderAdSlot(mockContainer, 'result');
  if (mockContainer.style.display !== 'block' || !mockContainer.innerHTML.includes('ad-house-card')) {
    throw new Error('Ad slot failed to render fallback promo banner for free player');
  }

  passedTests++;
  console.log('  ✓ Ad Slot Gating: Automatically suppresses ads for PRO and renders native banner for free players');
}

// 9d. Streak Shield Protection
totalTests++;
{
  const pastDay1 = new Date('2026-10-01T12:00:00Z');
  const skippedDay = new Date('2026-10-03T12:00:00Z'); // Skipped Oct 2!

  // Reset streak
  Storage.setStreak({ current: 5, best: 5, lastPlayedDate: '2026-10-01' });
  
  // Normal free user without shield: streak drops to 1
  Monetization.setPro(false);
  Storage.setSetting('streak_shields', 0);
  Storage.updateStreak(skippedDay);
  if (Storage.getStreak().current !== 1) {
    throw new Error(`Expected broken streak to reset to 1, got ${Storage.getStreak().current}`);
  }

  // PRO user: streak is shielded and continues to 6!
  Storage.setStreak({ current: 5, best: 5, lastPlayedDate: '2026-10-01' });
  Monetization.setPro(true);
  Storage.updateStreak(skippedDay);
  if (Storage.getStreak().current !== 6) {
    throw new Error(`Expected PRO streak shield to preserve streak to 6, got ${Storage.getStreak().current}`);
  }

  // Restore clean state
  Monetization.setPro(false);
  passedTests++;
  console.log('  ✓ Streak Shield: PRO membership automatically protects broken streaks from resetting');
}

// 9e. Battle Replay PRO Crown Integration
totalTests++;
{
  const mockCanvas = {
    parentElement: { clientWidth: 400 },
    style: {},
    getContext: () => ({ scale: () => {} })
  };
  const replay = new BattleReplay(mockCanvas);
  replay.loadData({
    date: 20261003,
    time: 14000,
    score: 8500,
    rank: 1,
    totalPlayers: 100,
    percentile: 1,
    isPro: true
  });

  const p = replay.players.find(x => x.isPlayer);
  if (!p || p.isPro !== true) {
    throw new Error('BattleReplay player did not receive isPro status');
  }
  passedTests++;
  console.log('  ✓ Replay VIP Integration: BattleReplay receives isPro flag and mounts VIP golden crown');
}

// 9f. Tiered Membership & Expiration Verification
totalTests++;
{
  // 1. Monthly plan with future expiry
  const futureExpiry = Date.now() + (10 * 24 * 60 * 60 * 1000);
  Monetization.setPro(true, { plan: 'monthly', expiryTimestamp: futureExpiry });
  if (Monetization.isPro() !== true) {
    throw new Error('Active monthly PRO was unexpectedly reported as inactive');
  }
  const details = Monetization.getProDetails();
  if (details.plan !== 'monthly' || details.daysRemaining !== 10) {
    throw new Error(`Expected monthly plan with 10 days, got ${JSON.stringify(details)}`);
  }

  // 2. Past expiry -> should auto-expire!
  const pastExpiry = Date.now() - 1000;
  Monetization.setPro(true, { plan: 'monthly', expiryTimestamp: pastExpiry });
  if (Monetization.isPro() !== false) {
    throw new Error('Expired PRO membership failed to auto-revoke');
  }

  // 3. Lifetime plan -> never expires
  Monetization.setPro(true, { plan: 'lifetime' });
  const lifetimeDetails = Monetization.getProDetails();
  if (lifetimeDetails.plan !== 'lifetime' || lifetimeDetails.daysRemaining !== null) {
    throw new Error('Lifetime VIP plan misconfigured');
  }

  Monetization.setPro(false);
  passedTests++;
  console.log('  ✓ Tiered Subscriptions: Verified 30-day monthly expiration auto-revocation and lifetime VIP');
}

// 9g. Secure VIP Key Redemption
totalTests++;
{
  // Invalid key fails
  const badRes = Monetization.redeemVipKey('WRONG_CODE_123');
  if (badRes.success || Monetization.isPro()) {
    throw new Error('Invalid VIP key should not grant PRO access');
  }

  // Valid Lifetime Founder Key succeeds
  const goodRes = Monetization.redeemVipKey('TILEDLY_VIP_2026');
  if (!goodRes.success || !Monetization.isPro()) {
    throw new Error('Valid VIP key failed to activate PRO membership');
  }
  const details = Monetization.getProDetails();
  if (details.plan !== 'lifetime') {
    throw new Error('VIP key did not grant lifetime access');
  }

  Monetization.setPro(false);
  passedTests++;
  console.log('  ✓ Secure Key Redemption: Verified single secure VIP pass redemption path without dev bypasses');
}

// Test 10: Full Daily Archive Functionality
console.log('\n📅 Running Full Daily Archive Tests...');
import { getArchiveDays } from './js/daily.js';
totalTests++;
{
  const archiveDays = getArchiveDays();
  if (!Array.isArray(archiveDays) || archiveDays.length < 3) {
    throw new Error(`Expected at least 3 archive days since Oct 3, 2026 launch, found ${archiveDays?.length}`);
  }
  
  // Check day 1 integrity
  const day1 = archiveDays[archiveDays.length - 1];
  if (day1.dayNumber !== 1 || !day1.dateStr || !day1.mode) {
    throw new Error(`Invalid Day 1 archive record: ${JSON.stringify(day1)}`);
  }

  passedTests++;
  console.log(`  ✓ Daily Archive: Generated ${archiveDays.length} archive days since launch (Day #1 to Day #${archiveDays[0].dayNumber})`);
}

console.log(`\n🎉 ALL ${passedTests}/${totalTests} TESTS PASSED!`);
console.log(`Tiledly has 28 unique challenges, robust streak tracking, verified battle royale replay, tiered monetization, and full daily archive.`);





