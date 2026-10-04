function generateEquationFor(target, rng) {
  // Generate a fun, clear mini-equation that equals target
  const type = rng.nextInt(0, 2);
  
  if (type === 0 && target <= 20) {
    // Addition: a + b = target
    const a = rng.nextInt(1, Math.max(1, target - 1));
    const b = target - a;
    return `${a}+${b}`;
  } else if (type === 1) {
    // Subtraction: a - b = target
    const b = rng.nextInt(1, 9);
    const a = target + b;
    return `${a}-${b}`;
  } else {
    // Multiplication or division if possible
    // Check multiplication
    for (let f = 5; f >= 2; f--) {
      if (target % f === 0) {
        return `${f}×${target / f}`;
      }
    }
    // Fallback to addition
    const a = rng.nextInt(1, Math.max(1, target - 1));
    const b = target - a;
    return `${a}+${b}`;
  }
}

export const MathBlitzMode = {
  id: 'math-blitz',
  name: 'Math Blitz',
  emoji: '🧮',
  description: 'Solve the equations! Tap cells in order of their answers (1 to 25)!',

  generateChallenge(rng) {
    const items = [];
    for (let ans = 1; ans <= 25; ans++) {
      items.push({
        answer: ans,
        equation: generateEquationFor(ans, rng)
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
      grid: { rows: 5, cols: 5, cells },
      totalEquations: 25
    };
  },

  createGameState(challenge) {
    return {
      currentAnswer: 1,
      totalEquations: 25,
      found: 0,
      mistakes: 0,
      taps: []
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (cellValue === gameState.currentAnswer) {
      gameState.found++;
      gameState.currentAnswer++;
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
        expectedValue: gameState.currentAnswer
      };
    }
  },

  getTargetDisplay(gameState) {
    return `🎯 Answer: ${gameState.currentAnswer <= gameState.totalEquations ? gameState.currentAnswer : 'Done!'}`;
  },

  getProgress(gameState) {
    return `${gameState.found}/${gameState.totalEquations} solved`;
  },

  getStats(gameState, elapsedMs) {
    const accuracy = gameState.found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((gameState.found / (gameState.found + gameState.mistakes)) * 100);

    const scoreBase = Math.max(0, 10000 - elapsedMs / 8) * (1 - gameState.mistakes * 0.05);
    const score = Math.max(0, Math.min(10000, Math.round(scoreBase)));

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
