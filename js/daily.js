import { getDailySeed, getDayOfWeek, SeededRandom } from './utils.js';
import { SumHuntMode } from './modes/sum-hunt.js';
import { MemoryGridMode } from './modes/memory-grid.js';

export function getTodayMode() {
  const day = getDayOfWeek();
  // Mode schedule:
  // Monday (1): Sum Hunt
  // Tuesday (2): Sum Hunt
  // Wednesday (3): Memory Grid
  // Thursday (4): Sum Hunt 
  // Friday (5): Memory Grid
  // Saturday (6): Sum Hunt
  // Sunday (0): Memory Grid
  const schedule = {
    0: MemoryGridMode,
    1: SumHuntMode,
    2: SumHuntMode,
    3: MemoryGridMode,
    4: SumHuntMode,
    5: MemoryGridMode,
    6: SumHuntMode
  };
  return schedule[day];
}

export function getTodayChallenge() {
  const mode = getTodayMode();
  const seed = getDailySeed();
  const rng = new SeededRandom(seed);
  const challenge = mode.generateChallenge(rng);
  return { mode, challenge };
}

export function getModeInfo() {
  const mode = getTodayMode();
  return {
    id: mode.id,
    name: mode.name,
    emoji: mode.emoji,
    description: mode.description
  };
}

export function getDailyNumber() {
  const launchDate = new Date('2026-10-03T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(today - launchDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}
