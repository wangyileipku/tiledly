import { calculateScore } from '../utils.js';

const PAIR_EMOJIS = ['⚡', '🔥', '💎', '🚀', '🍀', '👑', '🎯', '🔮', '🍕', '🎸', '🐱', '🏆'];

export const MemoryGridMode = {
  id: 'memory-grid',
  name: 'Memory Grid',
  emoji: '🧠',
  description: 'Memorize the grid, then tap targets from memory!',

  memorizeDuration: 4000,
  peekDuration: 1500,
  peekPenalty: 2000,

  getVariantInfo(weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variants = [
      { name: 'Memory Grid: 10-Key Sprint', description: 'Memorize the 10 numbers in 4s, then tap 1 to 10 from memory!' },
      { name: 'Memory Grid: Symbol Pairs', description: 'Memorize the icons in 4s, then match 12 emoji pairs from memory!' },
      { name: 'Memory Grid: Snake Path', description: 'Memorize the 12-step connected path in 4s, then retrace it in order!' },
      { name: 'Memory Grid: Color Zones', description: 'Memorize 15 numbers grouped by color: Red (1-5), Green (6-10), Blue (11-15)!' }
    ];
    const info = variants[variantIndex];
    return {
      id: this.id,
      name: info.name,
      emoji: this.emoji,
      description: info.description
    };
  },

  generateChallenge(rng, weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variantInfo = this.getVariantInfo(weekNum);

    if (variantIndex === 1) {
      // Symbol Pairs: 12 pairs + 1 center star
      const items = [];
      PAIR_EMOJIS.forEach((emoji, idx) => {
        items.push({ emoji, symbolId: idx });
        items.push({ emoji, symbolId: idx });
      });
      const shuffled = rng.shuffle(items);
      const cells = [];
      let itemIdx = 0;
      for (let i = 0; i < 25; i++) {
        if (i === 12) {
          cells.push({
            id: i,
            display: '⭐',
            value: 'bonus',
            classes: ['target-cell', 'disabled']
          });
        } else {
          const item = shuffled[itemIdx++];
          cells.push({
            id: i,
            display: item.emoji,
            value: item.symbolId
          });
        }
      }
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalPairs: 12
      };
    } else if (variantIndex === 2) {
      // Snake Path: 12 connected steps
      // Build a random walk of 12 steps on a 5x5 grid
      const pathIndices = [];
      let r = rng.nextInt(0, 4);
      let c = rng.nextInt(0, 4);
      pathIndices.push(r * 5 + c);

      while (pathIndices.length < 12) {
        const neighbors = [];
        const dr = [-1, 1, 0, 0, -1, 1, -1, 1];
        const dc = [0, 0, -1, 1, -1, -1, 1, 1];
        for (let d = 0; d < 8; d++) {
          const nr = r + dr[d];
          const nc = c + dc[d];
          if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
            const nIdx = nr * 5 + nc;
            if (!pathIndices.includes(nIdx)) {
              neighbors.push({ r: nr, c: nc, idx: nIdx });
            }
          }
        }
        if (neighbors.length > 0) {
          const next = rng.pick(neighbors);
          r = next.r;
          c = next.c;
          pathIndices.push(next.idx);
        } else {
          // Restart path if dead end
          pathIndices.length = 0;
          r = rng.nextInt(0, 4);
          c = rng.nextInt(0, 4);
          pathIndices.push(r * 5 + c);
        }
      }

      const cells = [];
      for (let i = 0; i < 25; i++) {
        const pathStep = pathIndices.indexOf(i);
        if (pathStep !== -1) {
          const stepNum = pathStep + 1;
          cells.push({
            id: i,
            display: String(stepNum),
            value: stepNum
          });
        } else {
          cells.push({
            id: i,
            display: '·',
            value: null
          });
        }
      }
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalSteps: 12
      };
    } else if (variantIndex === 3) {
      // Color Zones: 15 numbers (1-5 Red, 6-10 Green, 11-15 Blue)
      const zoneItems = [];
      for (let n = 1; n <= 15; n++) {
        let color = '#ff3366'; // Red
        if (n > 10) color = '#00e5ff'; // Blue
        else if (n > 5) color = '#00ff88'; // Green
        zoneItems.push({ number: n, color });
      }
      for (let b = 0; b < 10; b++) {
        zoneItems.push({ number: null, color: null });
      }
      const shuffled = rng.shuffle(zoneItems);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.number ? String(item.number) : '·',
        value: item.number,
        color: item.color ? item.color + '33' : null
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalNumbers: 15
      };
    } else {
      // 10-Key Sprint: 10 numbers (1 to 10) + 15 blanks
      const items = [];
      for (let n = 1; n <= 10; n++) items.push(n);
      for (let b = 0; b < 15; b++) items.push(null);
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((val, idx) => ({
        id: idx,
        display: val !== null ? String(val) : '·',
        value: val
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalNumbers: 10
      };
    }
  },

  createGameState(challenge) {
    if (challenge.variantIndex === 1) {
      // Symbol Pairs state
      return {
        variantIndex: 1,
        totalPairs: 12,
        clearedPairs: 0,
        selectedCellIndex: null,
        cells: challenge.grid.cells,
        found: 0,
        mistakes: 0,
        peeks: 0,
        peekPenaltyMs: 0,
        taps: [],
        clearedIndices: new Set([12]), // Center star cleared
        phase: 'memorize'
      };
    }

    const total = challenge.totalNumbers || challenge.totalSteps || 10;
    return {
      variantIndex: challenge.variantIndex,
      currentTarget: 1,
      totalTargets: total,
      found: 0,
      mistakes: 0,
      peeks: 0,
      peekPenaltyMs: 0,
      taps: [],
      clearedIndices: new Set(),
      phase: 'memorize'
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (gameState.clearedIndices.has(cellIndex)) {
      return { valid: false };
    }

    if (gameState.variantIndex === 1) {
      // Symbol Pairs tapping logic
      if (cellValue === 'bonus') return { valid: false };

      if (gameState.selectedCellIndex === null) {
        // First card of pair
        gameState.selectedCellIndex = cellIndex;
        return { valid: true, action: 'correct', indices: [cellIndex] };
      }

      if (gameState.selectedCellIndex === cellIndex) {
        return { valid: false };
      }

      // Second card tapped
      const firstIndex = gameState.selectedCellIndex;
      gameState.selectedCellIndex = null;
      const firstVal = gameState.cells[firstIndex].value;

      if (firstVal === cellValue) {
        // Matched pair!
        gameState.clearedPairs++;
        gameState.found++;
        gameState.clearedIndices.add(firstIndex);
        gameState.clearedIndices.add(cellIndex);
        gameState.taps.push({ index: cellIndex, time: elapsedMs });

        return {
          valid: true,
          action: 'correct',
          indices: [firstIndex, cellIndex],
          isComplete: gameState.clearedPairs === gameState.totalPairs
        };
      } else {
        // Mismatch!
        gameState.mistakes++;
        return {
          valid: true,
          action: 'wrong',
          indices: [firstIndex, cellIndex]
        };
      }
    }

    // Number-target based variants (10-Key, Snake, Color Zones)
    if (cellValue === gameState.currentTarget) {
      gameState.found++;
      gameState.currentTarget++;
      gameState.clearedIndices.add(cellIndex);
      gameState.taps.push({ index: cellIndex, time: elapsedMs });

      return {
        valid: true,
        action: 'correct',
        index: cellIndex,
        isComplete: gameState.found === gameState.totalTargets
      };
    } else {
      gameState.mistakes++;
      return {
        valid: true,
        action: 'wrong',
        index: cellIndex,
        expectedValue: cellValue
      };
    }
  },

  handlePeek(gameState) {
    gameState.peeks++;
    gameState.peekPenaltyMs += this.peekPenalty;
    return { peekPenaltyMs: gameState.peekPenaltyMs };
  },

  getTargetDisplay(gameState) {
    if (gameState.variantIndex === 1) {
      return `🎯 Match Pairs (${gameState.clearedPairs}/${gameState.totalPairs} pairs)`;
    }
    return `🎯 Next: ${gameState.currentTarget <= gameState.totalTargets ? gameState.currentTarget : 'Done!'}`;
  },

  getProgress(gameState) {
    if (gameState.variantIndex === 1) {
      return `${gameState.clearedPairs}/${gameState.totalPairs} pairs found`;
    }
    return `${gameState.found}/${gameState.totalTargets} found`;
  },

  getStats(gameState, elapsedMs) {
    const adjustedTime = elapsedMs + gameState.peekPenaltyMs;
    const total = gameState.variantIndex === 1 ? gameState.totalPairs : gameState.totalTargets;
    const found = gameState.variantIndex === 1 ? gameState.clearedPairs : gameState.found;

    const accuracy = found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((found / (found + gameState.mistakes)) * 100);

    const score = calculateScore(adjustedTime, gameState.mistakes, (gameState.peeks || 0) * 0.08);

    return {
      time: adjustedTime,
      rawTime: elapsedMs,
      found,
      totalNumbers: total,
      mistakes: gameState.mistakes,
      peeks: gameState.peeks,
      accuracy,
      score
    };
  }
};
