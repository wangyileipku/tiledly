export const MinefieldMode = {
  id: 'minefield',
  name: 'Minefield',
  emoji: '💣',
  description: 'Memorize the hidden bombs, then tap numbers in order without exploding!',

  memorizeDuration: 3500,
  peekDuration: 2500,
  peekPenalty: 2500,
  bombPenalty: 3000,

  getVariantInfo(weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variants = [
      { name: 'Minefield: Classic', description: 'Memorize 5 hidden bombs, then tap numbers 1 to 20 without exploding!' },
      { name: 'Minefield: Cluster Danger', description: 'High stakes! 7 hidden bombs with +4.0s penalty. Tap 1 to 18 safely!' },
      { name: 'Minefield: Defusal Kit', description: 'Find the 🔧 Defusal Wrench to disarm bombs, or race 1 to 18!' },
      { name: 'Minefield: Radar Sweep', description: '5 hidden bombs! Each safe number shows how many bombs are nearby!' }
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

    let numBombs = 5;
    let numSafe = 20;
    let hasDefusal = false;

    if (variantIndex === 1) {
      numBombs = 7;
      numSafe = 18;
    } else if (variantIndex === 2) {
      numBombs = 6;
      numSafe = 18;
      hasDefusal = true;
    }

    const items = [];
    for (let i = 1; i <= numSafe; i++) {
      items.push({ isBomb: false, isDefusal: false, number: i });
    }
    for (let b = 0; b < numBombs; b++) {
      items.push({ isBomb: true, isDefusal: false, number: null });
    }
    if (hasDefusal) {
      items.push({ isBomb: false, isDefusal: true, number: null });
    }

    const shuffled = rng.shuffle(items);

    // Compute adjacent bomb counts for radar sweep
    const bombIndices = new Set();
    shuffled.forEach((item, idx) => {
      if (item.isBomb) bombIndices.add(idx);
    });

    const cells = shuffled.map((item, idx) => {
      let display = '';
      let value = item.number;
      let classes = [];

      if (item.isBomb) {
        display = '💣';
        value = -1;
        classes.push('bomb-preview');
      } else if (item.isDefusal) {
        display = '🔧';
        value = 'defusal';
      } else {
        if (variantIndex === 3) {
          // Radar clue: count adjacent bombs
          const r = Math.floor(idx / 5);
          const c = idx % 5;
          let adjBombs = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
                if (bombIndices.has(nr * 5 + nc)) adjBombs++;
              }
            }
          }
          display = `${item.number} (${adjBombs}⚠️)`;
        } else {
          display = String(item.number);
        }
      }

      return {
        id: idx,
        display,
        value,
        isBomb: item.isBomb,
        isDefusal: item.isDefusal,
        classes
      };
    });

    return {
      variantIndex,
      variantName: variantInfo.name,
      grid: { rows: 5, cols: 5, cells },
      totalNumbers: numSafe,
      totalBombs: numBombs,
      hasDefusal
    };
  },

  createGameState(challenge) {
    return {
      variantIndex: challenge.variantIndex,
      currentTarget: 1,
      totalNumbers: challenge.totalNumbers,
      found: 0,
      mistakes: 0,
      bombsHit: 0,
      penaltyMs: 0,
      disarmed: false,
      taps: [],
      clearedIndices: new Set(),
      phase: 'memorize'
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (gameState.clearedIndices.has(cellIndex)) {
      return { valid: false };
    }

    if (cellValue === 'defusal') {
      // Disarm all bombs!
      gameState.disarmed = true;
      gameState.clearedIndices.add(cellIndex);
      return {
        valid: true,
        action: 'correct',
        index: cellIndex,
        isComplete: false
      };
    }

    if (cellValue === -1) {
      if (gameState.disarmed) {
        // Disarmed bomb, safe dud!
        return {
          valid: true,
          action: 'deselect',
          index: cellIndex
        };
      }

      // Hit a bomb!
      const penalty = gameState.variantIndex === 1 ? 4000 : this.bombPenalty;
      gameState.bombsHit++;
      gameState.mistakes++;
      gameState.penaltyMs += penalty;
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
        expectedValue: gameState.currentTarget
      };
    }
  },

  handlePeek(gameState) {
    gameState.peeks = (gameState.peeks || 0) + 1;
    gameState.penaltyMs = (gameState.penaltyMs || 0) + this.peekPenalty;
    return { penaltyMs: gameState.penaltyMs, peeks: gameState.peeks };
  },

  getTargetDisplay(gameState) {
    const disarmMsg = gameState.disarmed ? ' (🛡️ DISARMED)' : ` (⚠️ ${gameState.bombsHit} 💣)`;
    return `🎯 Next: ${gameState.currentTarget <= gameState.totalNumbers ? gameState.currentTarget : 'Cleared!'}${disarmMsg}`;
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
