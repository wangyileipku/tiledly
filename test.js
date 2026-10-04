import { ALL_MODES, getDailyNumber, getTodayMode } from './js/daily.js';
import { SeededRandom } from './js/utils.js';

console.log('⚡ Running Tiledly 7-Day Modes Test Suite...\n');

const rng = new SeededRandom(20261003);
let totalTests = 0;
let passedTests = 0;

for (const [day, mode] of Object.entries(ALL_MODES)) {
  totalTests++;
  console.log(`Testing Day ${day}: ${mode.emoji} ${mode.name}...`);
  
  const challenge = mode.generateChallenge(rng);
  if (!challenge || !challenge.grid || challenge.grid.cells.length !== 25) {
    throw new Error(`Invalid grid in ${mode.name}: expected 25 cells`);
  }
  
  const state = mode.createGameState(challenge);
  const cell0 = challenge.grid.cells[0];
  const tapRes = mode.handleTap(0, state, 1000, cell0.value);
  
  if (!tapRes || typeof tapRes.valid !== 'boolean') {
    throw new Error(`Invalid tap response in ${mode.name}`);
  }
  
  const stats = mode.getStats(state, 4500);
  if (typeof stats.score !== 'number' || typeof stats.accuracy !== 'number') {
    throw new Error(`Invalid stats in ${mode.name}`);
  }
  
  passedTests++;
  console.log(`  ✓ Grid: 25 cells | Tap: ${tapRes.action} | Score: ${stats.score} | Acc: ${stats.accuracy}%\n`);
}

console.log(`🎉 All ${passedTests}/${totalTests} modes passed validation successfully!`);
console.log(`Today's Mode: ${getTodayMode().emoji} ${getTodayMode().name}`);
console.log(`Day Number: #${getDailyNumber()}`);
