import { calculateScore } from '../utils.js';

function generatePemdasEquation(target, rng) {
  // Generate expressions with operator precedence that evaluate to target
  if (target === 1) return '3×2-5';
  if (target === 2) return '4×2-6';
  if (target === 3) return '2+3-2';
  if (target === 4) return '2×3-2';
  if (target === 5) return '2+1×3';
  if (target === 6) return '2×4-2';
  if (target === 7) return '1+2×3';
  if (target === 8) return '2+3×2';
  if (target === 9) return '3+2×3';
  if (target === 10) return '2×(3+2)';
  if (target === 11) return '3+2×4';
  if (target === 12) return '2×(2+4)';
  if (target === 13) return '1+3×4';
  if (target === 14) return '2+3×4';
  if (target === 15) return '3×(1+4)';
  if (target === 16) return '4×(2+2)';
  if (target === 17) return '2+3×5';
  if (target === 18) return '3×(4+2)';
  if (target === 19) return '4+3×5';
  if (target === 20) return '4×(3+2)';
  if (target === 21) return '1+4×5';
  if (target === 22) return '2+4×5';
  if (target === 23) return '3+4×5';
  if (target === 24) return '4×(2+4)';
  if (target === 25) return '5×(3+2)';
  return `${target}+0`;
}

function generatePercentageEquation(target) {
  // Realistic fraction/percentage equal to target (1..25)
  const map = {
    1: '50% of 2', 2: '25% of 8', 3: '1/3 of 9', 4: '10% of 40',
    5: '50% of 10', 6: '20% of 30', 7: '1/4 of 28', 8: '10% of 80',
    9: '1/3 of 27', 10: '50% of 20', 11: '10% of 110', 12: '25% of 48',
    13: '1/2 of 26', 14: '20% of 70', 15: '50% of 30', 16: '25% of 64',
    17: '1/2 of 34', 18: '1/3 of 54', 19: '1/2 of 38', 20: '25% of 80',
    21: '30% of 70', 22: '1/2 of 44', 23: '1/2 of 46', 24: '1/3 of 72',
    25: '50% of 50'
  };
  return map[target] || `${target}×1`;
}

const TIMES_TABLE_FACTS = [
  { eq: '2×3', ans: 6 },
  { eq: '2×4', ans: 8 },
  { eq: '3×3', ans: 9 },
  { eq: '2×5', ans: 10 },
  { eq: '3×4', ans: 12 },
  { eq: '2×7', ans: 14 },
  { eq: '3×5', ans: 15 },
  { eq: '4×4', ans: 16 },
  { eq: '2×9', ans: 18 },
  { eq: '4×5', ans: 20 },
  { eq: '3×7', ans: 21 },
  { eq: '4×6', ans: 24 },
  { eq: '5×5', ans: 25 },
  { eq: '3×9', ans: 27 },
  { eq: '4×7', ans: 28 },
  { eq: '5×6', ans: 30 },
  { eq: '4×8', ans: 32 },
  { eq: '5×7', ans: 35 },
  { eq: '6×6', ans: 36 },
  { eq: '4×10', ans: 40 },
  { eq: '6×7', ans: 42 },
  { eq: '5×9', ans: 45 },
  { eq: '6×8', ans: 48 },
  { eq: '7×7', ans: 49 },
  { eq: '6×9', ans: 54 }
];

export const MathBlitzMode = {
  id: 'math-blitz',
  name: 'Math Blitz',
  emoji: '⚡',
  description: 'Solve equations in answer order as fast as you can!',

  getVariantInfo(weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variants = [
      { name: 'Math Blitz: PEMDAS', description: 'Solve equations with operator precedence! Tap in answer order (1 to 25)!' },
      { name: 'Math Blitz: Times Tables', description: 'Multiplication sprint! Solve products in ascending answer order!' },
      { name: 'Math Blitz: Percentages', description: 'Solve mental math fractions & percentages in answer order (1 to 25)!' },
      { name: 'Math Blitz: Target Buckets', description: 'Equations equal 5, 10, 15, 20, or 25. Solve each bucket in order!' }
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
      // Times Tables: sorted facts
      const items = [...TIMES_TABLE_FACTS];
      const sortedAnswers = items.map(i => i.ans);
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.eq,
        value: item.ans,
        classes: ['math-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalEquations: 25,
        sequence: sortedAnswers
      };
    } else if (variantIndex === 2) {
      // Percentages & fractions: 1 to 25
      const items = [];
      for (let ans = 1; ans <= 25; ans++) {
        items.push({
          answer: ans,
          equation: generatePercentageEquation(ans)
        });
      }
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.equation,
        value: item.answer,
        classes: ['math-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalEquations: 25,
        sequence: Array.from({ length: 25 }, (_, i) => i + 1)
      };
    } else if (variantIndex === 3) {
      // Target Buckets: 5 buckets (5, 10, 15, 20, 25), 5 equations each
      const buckets = [5, 10, 15, 20, 25];
      const bucketEquations = {
        5: ['2+3', '8-3', '10÷2', '1+4', '15-10'],
        10: ['6+4', '2×5', '14-4', '3+7', '20÷2'],
        15: ['9+6', '3×5', '20-5', '8+7', '30÷2'],
        20: ['12+8', '4×5', '25-5', '11+9', '40÷2'],
        25: ['18+7', '5×5', '30-5', '13+12', '50÷2']
      };
      const items = [];
      buckets.forEach(b => {
        bucketEquations[b].forEach(eq => {
          items.push({ answer: b, equation: eq });
        });
      });
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.equation,
        value: item.answer,
        classes: ['math-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalEquations: 25,
        buckets
      };
    } else {
      // PEMDAS: 1 to 25
      const items = [];
      for (let ans = 1; ans <= 25; ans++) {
        items.push({
          answer: ans,
          equation: generatePemdasEquation(ans, rng)
        });
      }
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.equation,
        value: item.answer,
        classes: ['math-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalEquations: 25,
        sequence: Array.from({ length: 25 }, (_, i) => i + 1)
      };
    }
  },

  createGameState(challenge) {
    if (challenge.variantIndex === 3) {
      // Target Buckets state
      return {
        variantIndex: 3,
        buckets: challenge.buckets,
        currentBucketIndex: 0,
        clearedInBucket: 0,
        totalEquations: 25,
        found: 0,
        mistakes: 0,
        taps: [],
        clearedIndices: new Set()
      };
    }

    return {
      variantIndex: challenge.variantIndex,
      sequence: challenge.sequence,
      currentIndex: 0,
      totalEquations: 25,
      found: 0,
      mistakes: 0,
      taps: [],
      clearedIndices: new Set()
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (gameState.clearedIndices.has(cellIndex)) {
      return { valid: false };
    }

    if (gameState.variantIndex === 3) {
      // Target buckets
      const expectedTarget = gameState.buckets[gameState.currentBucketIndex];
      if (cellValue === expectedTarget) {
        gameState.found++;
        gameState.clearedInBucket++;
        gameState.clearedIndices.add(cellIndex);
        gameState.taps.push({ index: cellIndex, time: elapsedMs });

        if (gameState.clearedInBucket >= 5) {
          gameState.currentBucketIndex++;
          gameState.clearedInBucket = 0;
        }

        return {
          valid: true,
          action: 'correct',
          index: cellIndex,
          isComplete: gameState.found === gameState.totalEquations
        };
      } else {
        gameState.mistakes++;
        return {
          valid: true,
          action: 'wrong',
          index: cellIndex,
          expectedValue: expectedTarget
        };
      }
    }

    // Sequence variants (PEMDAS, Times Tables, Percentages)
    const expectedAnswer = gameState.sequence[gameState.currentIndex];

    if (cellValue === expectedAnswer) {
      gameState.found++;
      gameState.currentIndex++;
      gameState.clearedIndices.add(cellIndex);
      gameState.taps.push({ index: cellIndex, time: elapsedMs });

      return {
        valid: true,
        action: 'correct',
        index: cellIndex,
        isComplete: gameState.found === gameState.totalEquations
      };
    } else {
      gameState.mistakes++;
      return {
        valid: true,
        action: 'wrong',
        index: cellIndex,
        expectedValue: expectedAnswer
      };
    }
  },

  getTargetDisplay(gameState) {
    if (gameState.variantIndex === 3) {
      if (gameState.currentBucketIndex >= gameState.buckets.length) return '🎯 Solved!';
      const targetVal = gameState.buckets[gameState.currentBucketIndex];
      const left = 5 - gameState.clearedInBucket;
      return `🎯 Target: = ${targetVal} (${left} left)`;
    }

    const expected = gameState.sequence[gameState.currentIndex];
    return `🎯 Answer: ${expected !== undefined ? expected : 'Done!'}`;
  },

  getProgress(gameState) {
    return `${gameState.found}/${gameState.totalEquations} solved`;
  },

  getStats(gameState, elapsedMs) {
    const accuracy = gameState.found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((gameState.found / (gameState.found + gameState.mistakes)) * 100);

    const score = calculateScore(elapsedMs, gameState.mistakes);

    return {
      time: elapsedMs,
      found: gameState.found,
      totalEquations: gameState.totalEquations,
      mistakes: gameState.mistakes,
      accuracy,
      score
    };
  }
};
