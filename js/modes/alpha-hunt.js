const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');

export const AlphaHuntMode = {
  id: 'alpha-hunt',
  name: 'Alpha Hunt',
  emoji: '🔤',
  description: 'Hunt and tap letters A through Y in alphabetical order!',

  generateChallenge(rng) {
    const shuffled = rng.shuffle(LETTERS);
    const cells = shuffled.map((letter, idx) => ({
      id: idx,
      display: letter,
      value: letter
    }));

    return {
      grid: { rows: 5, cols: 5, cells },
      totalLetters: 25
    };
  },

  createGameState(challenge) {
    return {
      currentLetterIndex: 0,
      totalLetters: 25,
      found: 0,
      mistakes: 0,
      taps: []
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    const expectedLetter = LETTERS[gameState.currentLetterIndex];

    if (cellValue === expectedLetter) {
      gameState.found++;
      gameState.currentLetterIndex++;
      gameState.taps.push({ index: cellIndex, time: elapsedMs });

      return {
        valid: true,
        action: 'correct',
        index: cellIndex,
        isComplete: gameState.found === gameState.totalLetters
      };
    } else {
      gameState.mistakes++;
      return {
        valid: true,
        action: 'wrong',
        index: cellIndex,
        expectedValue: expectedLetter
      };
    }
  },

  getTargetDisplay(gameState) {
    const letter = LETTERS[gameState.currentLetterIndex];
    return `🎯 Next: ${letter || 'Done!'}`;
  },

  getProgress(gameState) {
    return `${gameState.found}/${gameState.totalLetters} letters`;
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
      totalLetters: gameState.totalLetters,
      mistakes: gameState.mistakes,
      accuracy,
      score
    };
  }
};
