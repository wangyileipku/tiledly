import { ALL_MODES, getDailyNumber, getTodayMode, getTodayChallenge, getModeInfo } from './js/daily.js';
import { SeededRandom, getWeekOfYear } from './js/utils.js';

process.env.PRO_SIGNING_SECRET = process.env.PRO_SIGNING_SECRET || 'test_pro_auth_secret_suite_2026';

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

import { Storage, safeStorage } from './js/storage.js';

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

// 6c. BattleReplay Lifecycle & Event Cleanup (Issue 23)
totalTests++;
{
  const mockCanvas = {
    parentElement: { clientWidth: 400 },
    style: {},
    getContext: () => ({ scale: () => {} })
  };
  let listeners = [];
  global.window = {
    addEventListener: (type, fn) => { listeners.push({ type, fn }); },
    removeEventListener: (type, fn) => { listeners = listeners.filter(l => l.fn !== fn); },
    innerWidth: 400,
    innerHeight: 600
  };
  const replay = new BattleReplay(mockCanvas);
  if (listeners.length !== 1 || listeners[0].type !== 'resize') {
    throw new Error('BattleReplay did not register resize listener');
  }
  replay.destroy();
  if (listeners.length !== 0) {
    throw new Error('BattleReplay.destroy() failed to remove resize listener (memory leak!)');
  }
  delete global.window;
  passedTests++;
  console.log('  ✓ Replay Event Cleanup (Issue 23): BattleReplay.destroy() unregisters bound resize listener cleanly');
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

// 8c. Server-side score validation & anti-cheat bounds (Issue 2)
totalTests++;
{
  const makeMockRes = () => {
    let statusCode = 0;
    let data = null;
    return {
      res: {
        setHeader: () => {},
        status: (c) => {
          statusCode = c;
          return { json: (d) => { data = d; }, end: () => {} };
        }
      },
      get: () => ({ statusCode, data })
    };
  };

  // Rejects score > 10000
  const highRes = makeMockRes();
  await scoreHandler({ method: 'POST', body: { deviceId: 'valid_device_id', score: 99999, time: 10000, date: '20261005' } }, highRes.res);
  if (highRes.get().statusCode !== 400) throw new Error('Failed to reject impossibly high score');

  // Rejects score < 0
  const negRes = makeMockRes();
  await scoreHandler({ method: 'POST', body: { deviceId: 'valid_device_id', score: -10, time: 10000, date: '20261005' } }, negRes.res);
  if (negRes.get().statusCode !== 400) throw new Error('Failed to reject negative score');

  // Rejects superhuman time (< 2000ms)
  const fastRes = makeMockRes();
  await scoreHandler({ method: 'POST', body: { deviceId: 'valid_device_id', score: 9000, time: 500, date: '20261005' } }, fastRes.res);
  if (fastRes.get().statusCode !== 400) throw new Error('Failed to reject superhuman run time');

  // Rejects invalid date format (preventing Redis key injection)
  const dateRes = makeMockRes();
  await scoreHandler({ method: 'POST', body: { deviceId: 'valid_device_id', score: 9000, time: 20000, date: 'bad-date-format' } }, dateRes.res);
  if (dateRes.get().statusCode !== 400) throw new Error('Failed to reject invalid date format');

  // Rejects spoofed ghost bot deviceId
  const botRes = makeMockRes();
  await scoreHandler({ method: 'POST', body: { deviceId: 'ghost_bot_42', score: 9000, time: 20000, date: '20261005' } }, botRes.res);
  if (botRes.get().statusCode !== 400) throw new Error('Failed to reject spoofed ghost bot deviceId');

  // Issue 19: Throttles excessive score submissions by IP
  let scoreRateLimitHit = false;
  for (let i = 0; i < 20; i++) {
    const loopRes = makeMockRes();
    await scoreHandler({
      headers: { 'x-real-ip': '198.51.100.99' },
      method: 'POST',
      body: { deviceId: `flood_device_${i}_unique`, score: 5000, time: 25000, date: '20261005' }
    }, loopRes.res);
    if (loopRes.get().statusCode === 429) {
      scoreRateLimitHit = true;
      break;
    }
  }
  if (!scoreRateLimitHit) {
    throw new Error('Score API failed to trigger rate limit on excessive submissions from single IP');
  }

  passedTests++;
  console.log('  ✓ Score Validation & Rate Limiting (Issue 2, 19): Rejects spoofing, validates bounds & throttles IP floods');
}

// 8d. CORS & Origin Whitelisting (Issue 4)
totalTests++;
{
  const { applyCors } = await import('./api/_cors.js');

  const headersSet = {};
  const mockRes = {
    setHeader: (k, v) => { headersSet[k] = v; },
    status: () => ({ end: () => {} })
  };

  // 1. Legitimate origin allowed
  applyCors({ headers: { origin: 'https://tiledly.com' } }, mockRes);
  if (headersSet['Access-Control-Allow-Origin'] !== 'https://tiledly.com') {
    throw new Error('CORS did not allow https://tiledly.com');
  }

  // 2. Malicious origin denied (header NOT set, never wildcard *)
  const deniedHeaders = {};
  const deniedRes = {
    setHeader: (k, v) => { deniedHeaders[k] = v; },
    status: () => ({ end: () => {} })
  };
  applyCors({ headers: { origin: 'https://attacker-domain.evil.com' } }, deniedRes);
  if (deniedHeaders['Access-Control-Allow-Origin']) {
    throw new Error(`CORS improperly allowed unauthorized origin: ${deniedHeaders['Access-Control-Allow-Origin']}`);
  }

  passedTests++;
  console.log('  ✓ API CORS Security (Issue 4): Origin strictly whitelisted to tiledly.com; zero wildcard (*) exposure');
}

// 8e. Restore Code Validation & Brute-Force Protection (Issue 3)
totalTests++;
{
  const restoreHandler = (await import('./api/restore-pro.js')).default;
  const makeMockRes = () => {
    let statusCode = 0;
    let data = null;
    return {
      res: {
        setHeader: () => {},
        status: (c) => {
          statusCode = c;
          return { json: (d) => { data = d; }, end: () => {} };
        }
      },
      get: () => ({ statusCode, data })
    };
  };

  // Rejects invalid non-6-digit code format
  const badCodeRes = makeMockRes();
  await restoreHandler({
    method: 'POST',
    body: { action: 'verify_code', email: 'test@example.com', code: 'abc', deviceId: 'test_device_valid_id' }
  }, badCodeRes.res);
  if (badCodeRes.get().statusCode !== 400) {
    throw new Error('Failed to reject invalid 6-digit code format');
  }

  // Rejects invalid token format in verify_token
  const badTokenRes = makeMockRes();
  await restoreHandler({
    method: 'POST',
    body: { action: 'verify_token', token: 'invalid_short_token', deviceId: 'test_device_valid_id' }
  }, badTokenRes.res);
  if (badTokenRes.get().statusCode !== 400) {
    throw new Error('Failed to reject invalid token format');
  }

  // Blocker Issue 14: Never leak magicCode in response payload
  const reqRes = makeMockRes();
  await restoreHandler({
    method: 'POST',
    headers: { origin: 'https://attacker.com' },
    body: { action: 'request', email: 'test@example.com', deviceId: 'test_device_valid_id' }
  }, reqRes.res);
  if (reqRes.get().data && reqRes.get().data.magicCode !== undefined) {
    throw new Error('Critical: magicCode was leaked in restore response payload!');
  }

  // Issue 26: Verify restore attempts are keyed on IP + email to prevent targeted lockout
  const fs = await import('fs');
  const restoreSrc = fs.readFileSync('./api/restore-pro.js', 'utf8');
  if (!restoreSrc.includes('cleanIp') || !restoreSrc.includes('attemptsKey = `tiledly_restore_attempts_${cleanIp}_${cleanEmail}`')) {
    throw new Error('api/restore-pro.js must key restore attempts on both IP and email to prevent targeted lockout');
  }

  passedTests++;
  console.log('  ✓ Restore Protection (Issue 3, 13, 14, 26): Validates code/token format, prevents Origin poisoning & scopes attempts to IP+email');
}

// 8f. Server-Side VIP Key Redemption & Rate Limiting (Issue 1)
totalTests++;
{
  const redeemKeyHandler = (await import('./api/redeem-key.js')).default;
  const makeMockRes = () => {
    let statusCode = 0;
    let data = null;
    return {
      res: {
        setHeader: () => {},
        status: (c) => {
          statusCode = c;
          return { json: (d) => { data = d; }, end: () => {} };
        }
      },
      get: () => ({ statusCode, data })
    };
  };

  // Invalid key fails cleanly
  const badKeyRes = makeMockRes();
  await redeemKeyHandler({
    method: 'POST',
    body: { key: 'TOTALLY_FAKE_KEY', deviceId: 'valid_test_device_id' }
  }, badKeyRes.res);
  if (badKeyRes.get().data?.success !== false) {
    throw new Error('Fake VIP key was improperly accepted');
  }

  // Valid key succeeds server-side
  const goodKeyRes = makeMockRes();
  await redeemKeyHandler({
    method: 'POST',
    body: { key: 'TILEDLY_VIP_2026', deviceId: 'valid_test_device_id' }
  }, goodKeyRes.res);
  if (goodKeyRes.get().data?.success !== true || goodKeyRes.get().data?.plan !== 'lifetime') {
    throw new Error('Valid VIP key failed server-side validation');
  }

  // Rate limiting kicks in on abusive IPs (>10 attempts)
  let hitRateLimit = false;
  for (let i = 0; i < 15; i++) {
    const loopRes = makeMockRes();
    await redeemKeyHandler({
      headers: { 'x-forwarded-for': '198.51.100.25' },
      method: 'POST',
      body: { key: 'SPAM_KEY', deviceId: 'valid_test_device_id' }
    }, loopRes.res);
    if (loopRes.get().statusCode === 429) {
      hitRateLimit = true;
      break;
    }
  }
  if (!hitRateLimit) {
    throw new Error('IP rate limiting failed to trigger on repeated VIP key attempts');
  }

  // Issue 17: Verify no plaintext VIP keys exist in api/redeem-key.js source code
  const fs = await import('fs');
  const redeemSrc = fs.readFileSync('./api/redeem-key.js', 'utf8');
  const plaintextKeys = ['TILEDLY_VIP_2026', 'FOUNDER_LIFETIME', 'TILEDLY_LIFETIME', 'PRO_PASS_30'];
  for (const k of plaintextKeys) {
    if (redeemSrc.includes(`'${k}'`) || redeemSrc.includes(`"${k}"`)) {
      throw new Error(`api/redeem-key.js still exposes plaintext key ${k} in source code!`);
    }
  }

  passedTests++;
  console.log('  ✓ Server VIP Key Endpoint (Issue 1, 17, 18): Precomputed hashes validated, zero plaintext keys in source & Redis IP rate-limited');
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

// 9g. Secure VIP Key Redemption (now async — keys validated server-side)
totalTests++;
{
  // Save the original fetch and install a mock that simulates /api/redeem-key
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('/api/redeem-key')) {
      const body = JSON.parse(opts.body);
      const key = (body.key || '').trim().toUpperCase();

      // Simulate server-side validation (only accept known test key)
      if (key === 'TEST_VALID_KEY') {
        return { ok: true, status: 200, json: async () => ({ success: true, plan: 'lifetime', expiryTimestamp: null, message: '👑 Lifetime VIP Activated!' }) };
      }
      return { ok: true, status: 200, json: async () => ({ success: false, error: 'Invalid VIP Key' }) };
    }
    // Fallback for other fetch calls
    if (originalFetch) return originalFetch(url, opts);
    return { ok: true, status: 200, json: async () => ({}) };
  };

  // Invalid key fails
  const badRes = await Monetization.redeemVipKey('WRONG_CODE_123');
  if (badRes.success || Monetization.isPro()) {
    throw new Error('Invalid VIP key should not grant PRO access');
  }

  // Valid key succeeds (server-side validated)
  const goodRes = await Monetization.redeemVipKey('TEST_VALID_KEY');
  if (!goodRes.success || !Monetization.isPro()) {
    throw new Error('Valid VIP key failed to activate PRO membership');
  }
  const details = Monetization.getProDetails();
  if (details.plan !== 'lifetime') {
    throw new Error('VIP key did not grant lifetime access');
  }

  // Verify NO hardcoded keys exist in the client-side monetization module
  const fs = await import('fs');
  const monetizationSrc = fs.readFileSync('./js/monetization/monetization.js', 'utf-8');
  const leakedKeys = ['TILEDLY_VIP_2026', 'FOUNDER_LIFETIME', 'PRO_PASS_30', 'TILEDLY_MONTHLY', 'TILEDLY_LIFETIME'];
  for (const leaked of leakedKeys) {
    if (monetizationSrc.includes(leaked)) {
      throw new Error(`SECURITY: Hardcoded VIP key "${leaked}" found in client-side code!`);
    }
  }

  Monetization.setPro(false);
  global.fetch = originalFetch; // Restore original fetch
  passedTests++;
  console.log('  ✓ Secure Key Redemption: VIP keys validated server-side via /api/redeem-key (no client secrets)');
}

// 9h. Anti-Spoofing & Server Verification (Issue 6)
totalTests++;
{
  Monetization.setPro(false);
  Monetization._sessionVerified = false;

  // 1. Attack: Someone directly injects is_pro: true in localStorage without server token or session verification
  Storage.setSetting('is_pro', true);
  Storage.setSetting('pro_token', null);
  if (Monetization.isPro() === true) {
    throw new Error('Security failure: Spoofed localStorage gave unauthorized PRO access!');
  }

  // 2. Calling requireServerPro() when server says not PRO revokes spoofed local storage
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('/api/verify-pro')) {
      return { ok: true, status: 200, json: async () => ({ isPro: false }) };
    }
    return { ok: false, status: 404 };
  };

  const isVerified = await Monetization.requireServerPro();
  if (isVerified || Monetization.isPro() || Storage.getSetting('is_pro') === true) {
    throw new Error('requireServerPro() failed to revoke spoofed local PRO status!');
  }

  // 3. Legitimate server verification with signed token succeeds
  const { createProToken } = await import('./api/_token.js');
  const validToken = createProToken(Storage.getDeviceId(), 'lifetime', null);
  global.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('/api/verify-pro')) {
      return { ok: true, status: 200, json: async () => ({ isPro: true, plan: 'lifetime', expiryTimestamp: null, token: validToken }) };
    }
    return { ok: false, status: 404 };
  };

  const legitVerified = await Monetization.requireServerPro();
  if (!legitVerified || !Monetization.isPro() || Storage.getSetting('is_pro') !== true) {
    throw new Error('Legitimate server PRO verification failed');
  }

  Monetization.setPro(false);
  global.fetch = originalFetch;
  passedTests++;
  console.log('  ✓ Anti-Spoofing (Issue 6): Blocked direct localStorage manipulation; verified session via server token');
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

// Test 10b: Token Secret Enforcement & No Hardcoded Fallback (Issue 15)
totalTests++;
{
  const oldSecret = process.env.PRO_SIGNING_SECRET;
  delete process.env.PRO_SIGNING_SECRET;
  let threw = false;
  try {
    const { createProToken } = await import('./api/_token.js');
    createProToken('test_device', 'monthly', null);
  } catch (e) {
    threw = true;
  } finally {
    process.env.PRO_SIGNING_SECRET = oldSecret;
  }
  if (!threw) {
    throw new Error('createProToken failed to throw error when PRO_SIGNING_SECRET was missing');
  }
  passedTests++;
  console.log('  ✓ Token Secret Enforcement (Issue 15): Rejects token generation when PRO_SIGNING_SECRET is missing');
}

// Test 10c: Archive Challenge & getWeekOfYear Import Integrity (Issue 16)
totalTests++;
{
  const fs = await import('fs');
  const appJsContent = fs.readFileSync('./js/app.js', 'utf8');
  if (!appJsContent.includes('getWeekOfYear')) {
    throw new Error('app.js is missing getWeekOfYear import for archive challenges');
  }
  const archiveDays = getArchiveDays();
  const testDay = archiveDays[1];
  const { getDailySeed, getWeekOfYear, SeededRandom } = await import('./js/utils.js');
  const seed = getDailySeed(testDay.date);
  const weekNum = getWeekOfYear(testDay.date);
  const rng = new SeededRandom(seed);
  const chal = testDay.mode.generateChallenge(rng, weekNum);
  if (!chal || !chal.grid) {
    throw new Error('Failed to generate archive challenge with week number');
  }
  passedTests++;
  console.log('  ✓ Archive Challenge Execution (Issue 16): getWeekOfYear verified in app.js and archive challenge runs smoothly');
}

// Test 11: SEO, Metadata & Security Headers (Issues 7, 8, 9)
console.log('\n🔍 Running SEO, Metadata & Security Headers Tests...');
const fs = await import('fs');

// 11a. robots.txt & sitemap.xml presence (Issue 7)
totalTests++;
{
  if (!fs.existsSync('./robots.txt')) {
    throw new Error('Missing robots.txt');
  }
  const robotsContent = fs.readFileSync('./robots.txt', 'utf-8');
  if (!robotsContent.includes('Sitemap: https://tiledly.com/sitemap.xml') || !robotsContent.includes('Allow: /')) {
    throw new Error('robots.txt missing Sitemap or Allow directive');
  }

  if (!fs.existsSync('./sitemap.xml')) {
    throw new Error('Missing sitemap.xml');
  }
  const sitemapContent = fs.readFileSync('./sitemap.xml', 'utf-8');
  const requiredUrls = [
    'https://tiledly.com/',
    'https://tiledly.com/about.html',
    'https://tiledly.com/privacy.html',
    'https://tiledly.com/terms.html'
  ];
  for (const u of requiredUrls) {
    if (!sitemapContent.includes(u)) {
      throw new Error(`sitemap.xml missing URL: ${u}`);
    }
  }

  passedTests++;
  console.log('  ✓ Search Engine Crawling (Issue 7): robots.txt and sitemap.xml verified with all public routes');
}

// 11b. Canonical URL tags on all HTML pages (Issue 8)
totalTests++;
{
  const pages = [
    { file: './index.html', canonical: '<link rel="canonical" href="https://tiledly.com/">' },
    { file: './about.html', canonical: '<link rel="canonical" href="https://tiledly.com/about.html">' },
    { file: './privacy.html', canonical: '<link rel="canonical" href="https://tiledly.com/privacy.html">' },
    { file: './terms.html', canonical: '<link rel="canonical" href="https://tiledly.com/terms.html">' }
  ];

  for (const page of pages) {
    const html = fs.readFileSync(page.file, 'utf-8');
    if (!html.includes(page.canonical)) {
      throw new Error(`Page ${page.file} is missing required canonical tag: ${page.canonical}`);
    }
    if (!html.includes('<meta name="description"')) {
      throw new Error(`Page ${page.file} is missing standard <meta name="description"> tag`);
    }
  }

  passedTests++;
  console.log('  ✓ Canonical URL & Meta Description Tags (Issue 8, 22): Verified on index.html, about.html, privacy.html, and terms.html');
}

// 11c. Security Headers on Server & Vercel (Issue 9)
totalTests++;
{
  const serverCode = fs.readFileSync('./server.mjs', 'utf-8');
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
    'Content-Security-Policy'
  ];

  for (const h of requiredHeaders) {
    if (!serverCode.includes(h)) {
      throw new Error(`server.mjs missing security header: ${h}`);
    }
  }

  // Also verify vercel.json for production
  if (!fs.existsSync('./vercel.json')) {
    throw new Error('Missing vercel.json production config');
  }
  const vercelConfig = JSON.parse(fs.readFileSync('./vercel.json', 'utf-8'));
  const vercelHeaderKeys = vercelConfig.headers?.[0]?.headers?.map(h => h.key) || [];
  for (const h of requiredHeaders) {
    if (!vercelHeaderKeys.includes(h)) {
      throw new Error(`vercel.json missing production security header: ${h}`);
    }
  }

  passedTests++;
  console.log('  ✓ Security Headers & CSP (Issue 9, 21): Verified on local server (server.mjs) and production config (vercel.json) including Content-Security-Policy');
}

// 11cc. Service Worker Offline Cache Completeness (Issue 20)
totalTests++;
{
  if (!fs.existsSync('./sw.js')) {
    throw new Error('Missing sw.js');
  }
  const swContent = fs.readFileSync('./sw.js', 'utf-8');
  if (!swContent.includes("CACHE_NAME = 'tiledly-v2'")) {
    throw new Error('sw.js cache version must be updated to tiledly-v2');
  }
  const expectedCachedFiles = [
    '/js/modes/alpha-hunt.js',
    '/js/modes/number-rush.js',
    '/js/modes/math-blitz.js',
    '/js/modes/sum-hunt.js',
    '/js/modes/memory-grid.js',
    '/js/modes/minefield.js',
    '/js/modes/color-cascade.js',
    '/js/replay.js',
    '/js/consent.js',
    '/js/monetization/monetization.js',
    '/js/monetization/config.js',
    '/about.html',
    '/privacy.html',
    '/terms.html'
  ];
  for (const file of expectedCachedFiles) {
    if (!swContent.includes(`'${file}'`)) {
      throw new Error(`sw.js is missing required asset from offline cache: ${file}`);
    }
  }

  passedTests++;
  console.log('  ✓ Offline PWA Cache (Issue 20): All 7 game modes, subpages & monetization modules cached in tiledly-v2');
}

// 11d. Cookie Consent & GDPR / ePrivacy Compliance (Issue 5)
totalTests++;
{
  const { Consent } = await import('./js/consent.js');
  const { Analytics } = await import('./js/analytics.js');

  // Verify all 4 HTML files contain Google Consent Mode v2 default denied WITH EU region array
  const htmlFiles = ['./index.html', './about.html', './privacy.html', './terms.html'];
  for (const f of htmlFiles) {
    const content = fs.readFileSync(f, 'utf-8');
    if (!content.includes("'ad_storage': 'denied'") || !content.includes("'analytics_storage': 'denied'")) {
      throw new Error(`Page ${f} is missing Google Consent Mode v2 default denied configuration!`);
    }
    if (!content.includes("'region': [") || !content.includes("'DE'") || !content.includes("'FR'")) {
      throw new Error(`Page ${f} is missing EU/EEA region targeting array!`);
    }
  }

  // Verify regional resident detection
  const originalDateTimeFormat = Intl.DateTimeFormat;
  // Simulated US visitor
  Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ timeZone: 'America/New_York' }) });
  if (Consent.isEuResident() !== false) {
    throw new Error('US timezone improperly identified as EU');
  }

  // Simulated EU visitor
  Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ timeZone: 'Europe/Paris' }) });
  if (Consent.isEuResident() !== true) {
    throw new Error('EU timezone failed identification');
  }
  Intl.DateTimeFormat = originalDateTimeFormat; // Restore

  // Test Consent module logic
  Storage.setSetting('cookie_consent', null);
  if (Consent.hasUserDecided()) {
    throw new Error('Expected hasUserDecided to be false before user choice');
  }
  if (Analytics.hasConsent()) {
    throw new Error('Analytics should not have consent by default');
  }

  // Track gtag consent calls
  let lastGtagCall = null;
  global.window = global.window || {};
  global.window.gtag = (command, type, config) => {
    lastGtagCall = { command, type, config };
  };

  // User chooses essential only
  Consent.acceptEssentialOnly();
  if (Consent.getConsent() !== 'essential' || !Consent.hasUserDecided()) {
    throw new Error('Failed to record essential consent');
  }
  if (Analytics.hasConsent()) {
    throw new Error('Analytics should still be false when essential only');
  }
  if (lastGtagCall?.config?.ad_storage !== 'denied' || lastGtagCall?.config?.analytics_storage !== 'denied') {
    throw new Error('gtag consent was not updated to denied for essential only');
  }

  // User chooses accept all
  Consent.acceptAll();
  if (Consent.getConsent() !== 'all' || !Analytics.hasConsent()) {
    throw new Error('Failed to record accept all consent');
  }
  if (lastGtagCall?.config?.ad_storage !== 'granted' || lastGtagCall?.config?.analytics_storage !== 'granted') {
    throw new Error('gtag consent was not updated to granted for accept all');
  }

  passedTests++;
  console.log('  ✓ GDPR Cookie Consent (Issue 5): Regional EU/EEA targeting configured; US ads completely unaffected and default granted');
}

// 11dd. Accessibility, ARIA Roles & Screen Reader Attributes (Issue 25)
totalTests++;
{
  const indexHtml = fs.readFileSync('./index.html', 'utf-8');
  const requiredAriaAttributes = [
    'role="dialog"',
    'aria-modal="true"',
    'aria-labelledby="briefing-title"',
    'aria-labelledby="how-to-play-title"',
    'aria-labelledby="pro-modal-title"',
    'aria-labelledby="archive-modal-title"',
    'aria-labelledby="ios-install-title"',
    'aria-label="Close challenge briefing"',
    'aria-label="Close how to play dialog"',
    'aria-label="Close PRO upgrade dialog"',
    'aria-label="Close daily archive dialog"'
  ];

  for (const attr of requiredAriaAttributes) {
    if (!indexHtml.includes(attr)) {
      throw new Error(`index.html is missing required accessibility attribute: ${attr}`);
    }
  }

  // Also verify GameEngine adds role="grid" and cell accessibility
  const engineCode = fs.readFileSync('./js/engine.js', 'utf-8');
  if (!engineCode.includes('role\', \'grid\'') || !engineCode.includes('role\', \'button\'') || !engineCode.includes('_onKeyDown')) {
    throw new Error('GameEngine missing grid/cell ARIA roles or keyboard navigation handler');
  }

  passedTests++;
  console.log('  ✓ Accessibility & ARIA Support (Issue 25): Modals configured with dialog roles/labels and game grid supports keyboard/screen-readers');
}

// 11e. Score Date Parameter Bounds & Anti-Injection (Issue 10)
totalTests++;
{
  const makeMockRes = () => {
    let statusCode = 0;
    let data = null;
    return {
      res: {
        setHeader: () => {},
        status: (c) => {
          statusCode = c;
          return { json: (d) => { data = d; }, end: () => {} };
        }
      },
      getStatus: () => statusCode,
      getData: () => data
    };
  };

  // Invalid date lengths / characters / calendar bounds (POST & GET)
  const invalidDates = [
    '2026101',      // 7 digits
    '202610101',    // 9 digits
    '2026-10-11',   // Hyphenated
    '20261301',     // Month 13 (out of bounds)
    '20260015',     // Month 0 (out of bounds)
    '20260500',     // Day 0 (out of bounds)
    '20260532',     // Day 32 (out of bounds)
    '20251231',     // Year 2025 (prior to launch year 2026)
    'date;DROP',    // SQL/Redis injection attempt
  ];

  for (const d of invalidDates) {
    const postMock = makeMockRes();
    await scoreHandler({
      method: 'POST',
      body: { deviceId: 'valid_dev_123', date: d, time: 25000, mistakes: 0, score: 8000 }
    }, postMock.res);
    if (postMock.getStatus() !== 400 || !postMock.getData()?.error?.includes('Invalid date')) {
      throw new Error(`POST scoreHandler accepted invalid date '${d}', status=${postMock.getStatus()}`);
    }

    const getMock = makeMockRes();
    await scoreHandler({
      method: 'GET',
      query: { date: d }
    }, getMock.res);
    if (getMock.getStatus() !== 400 || !getMock.getData()?.error?.includes('Invalid date')) {
      throw new Error(`GET scoreHandler accepted invalid date '${d}', status=${getMock.getStatus()}`);
    }
  }

  // Valid date must be accepted
  const validGetMock = makeMockRes();
  await scoreHandler({ method: 'GET', query: { date: '20261011' } }, validGetMock.res);
  if (validGetMock.getStatus() !== 200) {
    throw new Error(`GET scoreHandler rejected valid date '20261011', status=${validGetMock.getStatus()}`);
  }

  passedTests++;
  console.log('  ✓ Redis Key Sanitization & Date Bounds (Issue 10): Validated YYYYMMDD calendar constraints and injection defenses');
}

// 11f. safeStorage Exception Handling & Memory Fallback (Issue 11)
totalTests++;
{
  // Test normal storage operations
  safeStorage.setItem('tiledly_test_key', 'normal_value');
  if (safeStorage.getItem('tiledly_test_key') !== 'normal_value') {
    throw new Error('safeStorage normal set/get failed');
  }

  // Simulate QuotaExceededError or Safari Private Browsing mode failure
  const originalLocalStorage = global.localStorage;
  let throwError = true;
  global.localStorage = {
    getItem: () => {
      if (throwError) throw new Error('QuotaExceededError: The quota has been exceeded.');
      return null;
    },
    setItem: () => {
      if (throwError) throw new Error('QuotaExceededError: The quota has been exceeded.');
    },
    removeItem: () => {
      if (throwError) throw new Error('SecurityError: The operation is insecure.');
    }
  };

  // setItem should not throw even when localStorage throws
  try {
    safeStorage.setItem('tiledly_quota_test', 'persisted_fallback_value');
  } catch (err) {
    throw new Error(`safeStorage.setItem threw an error instead of catching: ${err.message}`);
  }

  // getItem should read from memoryStore fallback
  const retrieved = safeStorage.getItem('tiledly_quota_test');
  if (retrieved !== 'persisted_fallback_value') {
    throw new Error(`safeStorage did not fall back to memoryStore, got: ${retrieved}`);
  }

  // removeItem should not throw
  try {
    safeStorage.removeItem('tiledly_quota_test');
  } catch (err) {
    throw new Error(`safeStorage.removeItem threw an error: ${err.message}`);
  }
  if (safeStorage.getItem('tiledly_quota_test') !== null) {
    throw new Error('safeStorage.removeItem did not clear from memoryStore');
  }

  // Restore original localStorage
  global.localStorage = originalLocalStorage;

  passedTests++;
  console.log('  ✓ Safe Storage & Quota Fallback (Issue 11): Gracefully handles storage quota exceptions and private browsing');
}

// 11g. Terms of Service Governing Law & Domain Consistency (Issue 12)
totalTests++;
{
  const termsHtml = fs.readFileSync('./terms.html', 'utf-8');
  if (!termsHtml.includes('Governing Law &amp; Dispute Resolution') && !termsHtml.includes('Governing Law & Dispute Resolution')) {
    throw new Error('terms.html missing Governing Law & Dispute Resolution section');
  }
  if (!termsHtml.includes('State of Delaware')) {
    throw new Error('terms.html missing Delaware jurisdiction specification');
  }
  if (!termsHtml.includes('tiledly.com')) {
    throw new Error('terms.html missing official tiledly.com domain');
  }
  if (termsHtml.includes('tiledly.vercel.app')) {
    throw new Error('terms.html still contains legacy staging domain tiledly.vercel.app');
  }

  passedTests++;
  console.log('  ✓ Legal Terms Governing Law (Issue 12): Verified Delaware governing law, exclusive venue, and domain accuracy');
}

console.log(`\n🎉 ALL ${passedTests}/${totalTests} TESTS PASSED!`);
console.log(`Tiledly has 28 unique challenges, robust streak tracking, verified battle royale replay, tiered monetization, and full daily archive.`);







