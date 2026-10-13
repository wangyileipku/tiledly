import { calculateScore } from '../utils.js';

export const SumHuntMode = {
  id: 'sum-hunt',
  name: 'Sum Hunt',
  emoji: '🧮',
  description: 'Find pairs that add up to the target!',

  getVariantInfo(weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variants = [
      { name: 'Sum Hunt: Two-Digit Clashes', description: 'Find pairs of 2-digit numbers that add up to the target!' },
      { name: 'Sum Hunt: Century Sprint', description: 'Find pairs that add up to 100!' },
      { name: 'Sum Hunt: Escalating Targets', description: 'Pairs add to escalating targets: 20 → 40 → 60 → 80!' },
      { name: 'Sum Hunt: Difference Hunt', description: 'Find pairs of numbers with the target difference!' }
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
      // Century Sprint (Pairs that add up to 100)
      const targetSum = 100;
      const numbers = [];
      const used = new Set();
      for (let i = 0; i < 12; i++) {
        let a, b;
        let attempts = 0;
        do {
          a = rng.nextInt(5, 95);
          b = targetSum - a;
          attempts++;
        } while ((used.has(a) || used.has(b) || a === b) && attempts < 100);
        used.add(a);
        used.add(b);
        numbers.push(a, b);
      }
      const shuffled = rng.shuffle(numbers);
      const cells = [];
      let numIdx = 0;
      for (let i = 0; i < 25; i++) {
        if (i === 12) {
          cells.push({
            id: i,
            display: `🎯 ${targetSum}`,
            value: null,
            classes: ['target-cell', 'disabled']
          });
        } else {
          const val = shuffled[numIdx++];
          cells.push({
            id: i,
            display: String(val),
            value: val
          });
        }
      }
      return {
        variantIndex,
        variantName: variantInfo.name,
        targetSum,
        grid: { rows: 5, cols: 5, cells },
        totalPairs: 12
      };
    } else if (variantIndex === 2) {
      // Escalating Targets: 20, 40, 60, 80 (3 pairs each)
      const stages = [20, 40, 60, 80];
      const numbers = [];
      stages.forEach(tgt => {
        for (let i = 0; i < 3; i++) {
          const a = rng.nextInt(3, tgt - 3);
          const b = tgt - a;
          numbers.push(a, b);
        }
      });
      const shuffled = rng.shuffle(numbers);
      const cells = [];
      let numIdx = 0;
      for (let i = 0; i < 25; i++) {
        if (i === 12) {
          cells.push({
            id: i,
            display: `🎯 20→80`,
            value: null,
            classes: ['target-cell', 'disabled']
          });
        } else {
          const val = shuffled[numIdx++];
          cells.push({
            id: i,
            display: String(val),
            value: val
          });
        }
      }
      return {
        variantIndex,
        variantName: variantInfo.name,
        stages,
        grid: { rows: 5, cols: 5, cells },
        totalPairs: 12
      };
    } else if (variantIndex === 3) {
      // Difference Hunt (|A - B| = targetDiff)
      const targetDiff = rng.nextInt(15, 30);
      const numbers = [];
      for (let i = 0; i < 12; i++) {
        const b = rng.nextInt(10, 60);
        const a = b + targetDiff;
        numbers.push(a, b);
      }
      const shuffled = rng.shuffle(numbers);
      const cells = [];
      let numIdx = 0;
      for (let i = 0; i < 25; i++) {
        if (i === 12) {
          cells.push({
            id: i,
            display: `➖ ${targetDiff}`,
            value: null,
            classes: ['target-cell', 'disabled']
          });
        } else {
          const val = shuffled[numIdx++];
          cells.push({
            id: i,
            display: String(val),
            value: val
          });
        }
      }
      return {
        variantIndex,
        variantName: variantInfo.name,
        targetDiff,
        grid: { rows: 5, cols: 5, cells },
        totalPairs: 12
      };
    } else {
      // Two-Digit Clashes (targetSum 40 to 85)
      const targetSum = rng.nextInt(40, 85);
      const numbers = [];
      for (let i = 0; i < 12; i++) {
        const a = rng.nextInt(11, targetSum - 11);
        const b = targetSum - a;
        numbers.push(a, b);
      }
      const shuffled = rng.shuffle(numbers);
      const cells = [];
      let numIdx = 0;
      for (let i = 0; i < 25; i++) {
        if (i === 12) {
          cells.push({
            id: i,
            display: `🎯 ${targetSum}`,
            value: null,
            classes: ['target-cell', 'disabled']
          });
        } else {
          const val = shuffled[numIdx++];
          cells.push({
            id: i,
            display: String(val),
            value: val
          });
        }
      }
      return {
        variantIndex,
        variantName: variantInfo.name,
        targetSum,
        grid: { rows: 5, cols: 5, cells },
        totalPairs: 12
      };
    }
  },

  createGameState(challenge) {
    if (challenge.variantIndex === 2) {
      // Escalating state
      return {
        variantIndex: 2,
        stages: challenge.stages,
        currentStageIndex: 0,
        pairsClearedInStage: 0,
        cells: challenge.grid.cells,
        selectedIndex: null,
        clearedPairs: 0,
        totalPairs: 12,
        mistakes: 0,
        clearedIndices: new Set(),
        taps: []
      };
    } else if (challenge.variantIndex === 3) {
      // Difference state
      return {
        variantIndex: 3,
        targetDiff: challenge.targetDiff,
        cells: challenge.grid.cells,
        selectedIndex: null,
        clearedPairs: 0,
        totalPairs: 12,
        mistakes: 0,
        clearedIndices: new Set(),
        taps: []
      };
    }

    // Two-digit clashes (0) and Century Sprint (1) state
    return {
      variantIndex: challenge.variantIndex,
      targetSum: challenge.targetSum,
      cells: challenge.grid.cells,
      selectedIndex: null,
      clearedPairs: 0,
      totalPairs: 12,
      mistakes: 0,
      clearedIndices: new Set(),
      taps: []
    };
  },

  handleTap(cellIndex, gameState, elapsedMs) {
    if (cellIndex === 12 || gameState.clearedIndices.has(cellIndex)) {
      return { valid: false };
    }

    // Pair-based handling (Two-Digit, Century Sprint, Escalating, Difference)
    if (gameState.selectedIndex === null) {
      gameState.selectedIndex = cellIndex;
      return { valid: true, action: 'select' };
    }

    if (gameState.selectedIndex === cellIndex) {
      gameState.selectedIndex = null;
      return { valid: true, action: 'deselect' };
    }

    const prevIndex = gameState.selectedIndex;
    gameState.selectedIndex = null;

    const val1 = gameState.cells[prevIndex].value;
    const val2 = gameState.cells[cellIndex].value;

    let isMatch = false;

    if (gameState.variantIndex === 2) {
      // Escalating targets
      const currentTarget = gameState.stages[gameState.currentStageIndex];
      isMatch = (val1 + val2 === currentTarget);
      if (isMatch) {
        gameState.pairsClearedInStage++;
        if (gameState.pairsClearedInStage >= 3 && gameState.currentStageIndex < gameState.stages.length - 1) {
          gameState.currentStageIndex++;
          gameState.pairsClearedInStage = 0;
        }
      }
    } else if (gameState.variantIndex === 3) {
      // Difference Hunt
      isMatch = Math.abs(val1 - val2) === gameState.targetDiff;
    } else {
      // Two-digit clashes (0) and Century Sprint (1)
      isMatch = (val1 + val2 === gameState.targetSum);
    }

    if (isMatch) {
      gameState.clearedIndices.add(prevIndex);
      gameState.clearedIndices.add(cellIndex);
      gameState.clearedPairs++;
      gameState.taps.push({ index: cellIndex, time: elapsedMs });

      return {
        valid: true,
        action: 'correct',
        indices: [prevIndex, cellIndex],
        isComplete: gameState.clearedPairs === gameState.totalPairs
      };
    } else {
      gameState.mistakes++;
      return {
        valid: true,
        action: 'wrong',
        indices: [prevIndex, cellIndex]
      };
    }
  },

  getTargetDisplay(gameState, challenge) {
    if (gameState.variantIndex === 2) {
      const currentTarget = gameState.stages[gameState.currentStageIndex];
      const leftInStage = 3 - gameState.pairsClearedInStage;
      return `🎯 Target: ${currentTarget} (${leftInStage} pair${leftInStage > 1 ? 's' : ''} left)`;
    } else if (gameState.variantIndex === 3) {
      return `🎯 Difference: ${gameState.targetDiff}`;
    }
    return `🎯 Target: ${gameState.targetSum}`;
  },

  getProgress(gameState) {
    return `${gameState.clearedPairs}/${gameState.totalPairs} pairs cleared`;
  },

  getStats(gameState, elapsedMs) {
    const cleared = gameState.clearedPairs;
    const total = gameState.totalPairs;

    const accuracy = cleared === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((cleared / (cleared + gameState.mistakes)) * 100);

    const score = calculateScore(elapsedMs, gameState.mistakes);

    return {
      time: elapsedMs,
      cleared,
      total,
      mistakes: gameState.mistakes,
      accuracy,
      score
    };
  }
};
