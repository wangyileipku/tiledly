export const NumberRushMode = {
  id: 'number-rush',
  name: 'Number Rush',
  emoji: '🔢',
  description: 'Tap numbers in sequence as fast as you can!',

  getVariantInfo(weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variants = [
      { name: 'Number Rush: Classic 1→25', description: 'Tap numbers 1 to 25 in ascending order as fast as you can!' },
      { name: 'Number Rush: Reverse 25→1', description: 'Count down! Tap numbers 25 down to 1 in reverse order!' },
      { name: 'Number Rush: Multiples of 3', description: 'Multiplication speed sprint! Tap multiples of 3 (3, 6, 9... 75) in order!' },
      { name: 'Number Rush: Odd/Even Split', description: 'Tap all Odds ascending (1..25), then all Evens descending (24..2)!' }
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

    let numbers = [];
    let sequence = [];

    if (variantIndex === 1) {
      // Reverse 25 down to 1
      for (let i = 1; i <= 25; i++) numbers.push(i);
      sequence = [...numbers].reverse();
    } else if (variantIndex === 2) {
      // Multiples of 3 (3, 6, 9... 75)
      for (let i = 1; i <= 25; i++) numbers.push(i * 3);
      sequence = [...numbers];
    } else if (variantIndex === 3) {
      // Odd ascending (1..25), Even descending (24..2)
      for (let i = 1; i <= 25; i++) numbers.push(i);
      const odds = [];
      const evens = [];
      for (let i = 1; i <= 25; i++) {
        if (i % 2 !== 0) odds.push(i);
        else evens.push(i);
      }
      sequence = [...odds, ...evens.reverse()];
    } else {
      // Classic 1 to 25
      for (let i = 1; i <= 25; i++) numbers.push(i);
      sequence = [...numbers];
    }

    const shuffled = rng.shuffle(numbers);
    const cells = shuffled.map((num, idx) => ({
      id: idx,
      display: String(num),
      value: num
    }));

    return {
      variantIndex,
      variantName: variantInfo.name,
      grid: { rows: 5, cols: 5, cells },
      totalNumbers: 25,
      sequence
    };
  },

  createGameState(challenge) {
    return {
      variantIndex: challenge.variantIndex,
      sequence: challenge.sequence,
      currentIndex: 0,
      totalNumbers: 25,
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

    const expectedValue = gameState.sequence[gameState.currentIndex];

    if (cellValue === expectedValue) {
      gameState.found++;
      gameState.currentIndex++;
      gameState.clearedIndices.add(cellIndex);
      gameState.taps.push({ index: cellIndex, time: elapsedMs });

      return {
        valid: true,
        action: 'correct',
        index: cellIndex,
        isComplete: gameState.found === gameState.totalNumbers
      };
    } else {
      gameState.mistakes++;
      return {
        valid: true,
        action: 'wrong',
        index: cellIndex,
        expectedValue
      };
    }
  },

  getTargetDisplay(gameState) {
    const expected = gameState.sequence[gameState.currentIndex];
    if (expected === undefined) return '🎯 Complete!';

    if (gameState.variantIndex === 3) {
      const isOddPhase = gameState.currentIndex < 13;
      return `🎯 ${isOddPhase ? 'Odd (▲)' : 'Even (▼)'}: ${expected}`;
    }

    return `🎯 Next: ${expected}`;
  },

  getProgress(gameState) {
    return `${gameState.found}/${gameState.totalNumbers} tapped`;
  },

  getStats(gameState, elapsedMs) {
    const accuracy = gameState.found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((gameState.found / (gameState.found + gameState.mistakes)) * 100);

    const scoreBase = Math.max(0, 10000 - elapsedMs / 5) * (1 - gameState.mistakes * 0.04);
    const score = Math.max(0, Math.min(10000, Math.round(scoreBase)));

    return {
      time: elapsedMs,
      found: gameState.found,
      totalNumbers: gameState.totalNumbers,
      mistakes: gameState.mistakes,
      accuracy,
      score
    };
  }
};
