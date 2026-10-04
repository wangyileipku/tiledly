import { getDailySeed, getDayOfWeek, getWeekOfYear, SeededRandom } from './utils.js';
import { SumHuntMode } from './modes/sum-hunt.js';
import { NumberRushMode } from './modes/number-rush.js';
import { ColorCascadeMode } from './modes/color-cascade.js';
import { MemoryGridMode } from './modes/memory-grid.js';
import { MinefieldMode } from './modes/minefield.js';
import { MathBlitzMode } from './modes/math-blitz.js';
import { AlphaHuntMode } from './modes/alpha-hunt.js';

// 7-Day Weekly Schedule:
// 0: Sunday    🔤 Alpha Hunt
// 1: Monday    🧮 Sum Hunt
// 2: Tuesday   🔢 Number Rush
// 3: Wednesday 🎨 Color Cascade
// 4: Thursday  🧠 Memory Grid
// 5: Friday    💣 Minefield
// 6: Saturday  ⚡ Math Blitz
export const ALL_MODES = {
  0: AlphaHuntMode,
  1: SumHuntMode,
  2: NumberRushMode,
  3: ColorCascadeMode,
  4: MemoryGridMode,
  5: MinefieldMode,
  6: MathBlitzMode
};

export function getTodayMode(date = new Date()) {
  const day = getDayOfWeek(date);
  return ALL_MODES[day] || SumHuntMode;
}

export function getTodayChallenge(date = new Date()) {
  const mode = getTodayMode(date);
  const seed = getDailySeed(date);
  const weekNum = getWeekOfYear(date);
  const rng = new SeededRandom(seed);
  const challenge = mode.generateChallenge(rng, weekNum);
  return { mode, challenge };
}

export function getModeInfo(modeObj, date = new Date()) {
  const mode = modeObj || getTodayMode(date);
  const weekNum = getWeekOfYear(date);
  if (mode.getVariantInfo) {
    return mode.getVariantInfo(weekNum);
  }
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
