export const NumberRushMode = {
  id: 'number-rush',
  name: 'Number Rush',
  emoji: '🔢',
  description: 'Tap numbers 1 to 25 in ascending order as fast as you can!',

  generateChallenge(rng) {
    const numbers = [];
    for (let i = 1; i <= 25; i++) {
      numbers.push(i);
    }
    const shuffled = rng.shuffle(numbers);
    const cells = shuffled.map((num, idx) => ({
      id: idx,
      display: String(num),
      value: num
    }));

    return {
      grid: { rows: 5, cols: 5, cells },
      totalNumbers: 25
    };
  },

  createGameState(challenge) {
    return {
      currentTarget: 1,
      totalNumbers: 25,
      found: 0,
      mistakes: 0,
      taps: []
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (cellValue === gameState.currentTarget) {
      gameState.found++;
      gameState.currentTarget++;
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
        expectedValue: gameState.currentTarget
      };
    }
  },

  getTargetDisplay(gameState) {
    return `🎯 Next: ${gameState.currentTarget <= gameState.totalNumbers ? gameState.currentTarget : 'Done!'}`;
  },

  getProgress(gameState) {
    return `${gameState.found}/${gameState.totalNumbers} found`;
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
