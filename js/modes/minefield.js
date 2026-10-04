export const MinefieldMode = {
  id: 'minefield',
  name: 'Minefield',
  emoji: '💣',
  description: 'Memorize the 5 hidden bombs, then tap numbers 1 to 20 without exploding!',

  memorizeDuration: 2500,
  bombPenalty: 3000,

  generateChallenge(rng) {
    // 20 numbers + 5 bombs
    const items = [];
    for (let i = 1; i <= 20; i++) {
      items.push({ isBomb: false, number: i });
    }
    for (let b = 1; b <= 5; b++) {
      items.push({ isBomb: true, number: null });
    }

    const shuffled = rng.shuffle(items);
    const cells = shuffled.map((item, idx) => ({
      id: idx,
      display: item.isBomb ? '💣' : String(item.number),
      value: item.isBomb ? -1 : item.number,
      isBomb: item.isBomb,
      classes: item.isBomb ? ['bomb-preview'] : []
    }));

    return {
      grid: { rows: 5, cols: 5, cells },
      totalNumbers: 20,
      totalBombs: 5
    };
  },

  createGameState(challenge) {
    return {
      currentTarget: 1,
      totalNumbers: 20,
      found: 0,
      mistakes: 0,
      bombsHit: 0,
      penaltyMs: 0,
      taps: [],
      phase: 'memorize'
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (cellValue === -1) {
      // Hit a bomb!
      gameState.bombsHit++;
      gameState.mistakes++;
      gameState.penaltyMs += this.bombPenalty;
      gameState.taps.push({ index: cellIndex, time: elapsedMs, bomb: true });

      return {
        valid: true,
        action: 'bomb',
        index: cellIndex,
        isComplete: false
      };
    } else if (cellValue === gameState.currentTarget) {
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
    return `🎯 Next: ${gameState.currentTarget <= gameState.totalNumbers ? gameState.currentTarget : 'Cleared!'} (⚠️ ${gameState.bombsHit} 💣)`;
  },

  getProgress(gameState) {
    return `${gameState.found}/${gameState.totalNumbers} safe`;
  },

  getStats(gameState, elapsedMs) {
    const totalTime = elapsedMs + gameState.penaltyMs;
    const accuracy = gameState.found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((gameState.found / (gameState.found + gameState.mistakes)) * 100);

    const scoreBase = Math.max(0, 10000 - totalTime / 6) * (1 - gameState.mistakes * 0.05) * (1 - gameState.bombsHit * 0.1);
    const score = Math.max(0, Math.min(10000, Math.round(scoreBase)));

    return {
      time: totalTime,
      rawTime: elapsedMs,
      found: gameState.found,
      totalNumbers: gameState.totalNumbers,
      mistakes: gameState.mistakes,
      bombsHit: gameState.bombsHit,
      accuracy,
      score
    };
  }
};
