const BASE_COLORS = [
  { id: 'red', name: 'Red', hex: '#ff3366', emoji: '🔴' },
  { id: 'orange', name: 'Orange', hex: '#ff7700', emoji: '🟠' },
  { id: 'yellow', name: 'Yellow', hex: '#ffcc00', emoji: '🟡' },
  { id: 'green', name: 'Green', hex: '#00ff88', emoji: '🟢' },
  { id: 'blue', name: 'Blue', hex: '#00e5ff', emoji: '🔵' }
];

const SHAPES = [
  { id: 'circle', name: 'Circle', emoji: '⭕' },
  { id: 'square', name: 'Square', emoji: '⬛' },
  { id: 'triangle', name: 'Triangle', emoji: '🔺' },
  { id: 'star', name: 'Star', emoji: '⭐' },
  { id: 'diamond', name: 'Diamond', emoji: '🔷' }
];

export const ColorCascadeMode = {
  id: 'color-cascade',
  name: 'Color Cascade',
  emoji: '🎨',
  description: 'Tap colors in sequence as fast as you can!',

  getVariantInfo(weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variants = [
      { name: 'Color Cascade: Shuffled Rhythm', description: 'Tap colors in today’s unique shuffled color cycle!' },
      { name: 'Color Cascade: Stroop Effect', description: 'Mind trick! Tap the FONT color of the tile, ignore the word!' },
      { name: 'Color Cascade: Shape Shift', description: 'Tap shapes in cycle: ⭕ Circle → ⬛ Square → 🔺 Triangle → ⭐ Star → 🔷 Diamond!' },
      { name: 'Color Cascade: Ascending Count', description: 'Clear colors from least common (1 tile) to most common (9 tiles)!' }
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
      // Stroop Effect: text is a color word, font color is a different color
      const items = [];
      for (let c = 0; c < 5; c++) {
        for (let i = 0; i < 5; i++) {
          // font color index is c
          // pick a conflicting word
          let wordIdx = rng.nextInt(0, 4);
          if (wordIdx === c) wordIdx = (wordIdx + 1) % 5;
          items.push({
            fontColorIdx: c,
            fontColor: BASE_COLORS[c],
            wordText: BASE_COLORS[wordIdx].name
          });
        }
      }
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.wordText,
        value: item.fontColorIdx,
        textColor: item.fontColor.hex,
        classes: ['color-tile', 'stroop-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalTaps: 25,
        colors: BASE_COLORS
      };
    } else if (variantIndex === 2) {
      // Shape Shift: 5 shapes, 5 of each
      const items = [];
      for (let s = 0; s < 5; s++) {
        for (let i = 0; i < 5; i++) {
          items.push({ shapeIdx: s, shape: SHAPES[s] });
        }
      }
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.shape.emoji,
        value: item.shapeIdx,
        classes: ['color-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalTaps: 25,
        shapes: SHAPES
      };
    } else if (variantIndex === 3) {
      // Ascending Count: 1 Red, 3 Orange, 5 Yellow, 7 Green, 9 Blue
      const counts = [1, 3, 5, 7, 9];
      const items = [];
      counts.forEach((cnt, cIdx) => {
        for (let i = 0; i < cnt; i++) {
          items.push({ colorIndex: cIdx, color: BASE_COLORS[cIdx] });
        }
      });
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.color.emoji,
        value: item.colorIndex,
        color: item.color.hex + '22',
        classes: ['color-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalTaps: 25,
        counts,
        colors: BASE_COLORS
      };
    } else {
      // Shuffled Rhythm: cycle order is shuffled
      const cycleColors = rng.shuffle([...BASE_COLORS]);
      const items = [];
      for (let c = 0; c < 5; c++) {
        for (let i = 0; i < 5; i++) {
          items.push({ colorIndex: c, color: cycleColors[c] });
        }
      }
      const shuffled = rng.shuffle(items);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.color.emoji,
        value: item.colorIndex,
        color: item.color.hex + '22',
        classes: ['color-tile']
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalTaps: 25,
        cycleColors
      };
    }
  },

  createGameState(challenge) {
    if (challenge.variantIndex === 3) {
      // Ascending count state
      return {
        variantIndex: 3,
        currentColorStage: 0, // 0 to 4
        counts: challenge.counts,
        clearedInStage: 0,
        found: 0,
        totalTaps: 25,
        mistakes: 0,
        taps: [],
        clearedIndices: new Set()
      };
    }

    return {
      variantIndex: challenge.variantIndex,
      currentStepIndex: 0, // 0 to 4
      found: 0,
      totalTaps: 25,
      mistakes: 0,
      taps: [],
      clearedIndices: new Set(),
      challenge
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (gameState.clearedIndices.has(cellIndex)) {
      return { valid: false };
    }

    if (gameState.variantIndex === 3) {
      // Ascending Count: must match currentColorStage
      if (cellValue === gameState.currentColorStage) {
        gameState.found++;
        gameState.clearedInStage++;
        gameState.clearedIndices.add(cellIndex);
        gameState.taps.push({ index: cellIndex, time: elapsedMs });

        if (gameState.clearedInStage >= gameState.counts[gameState.currentColorStage]) {
          gameState.currentColorStage++;
          gameState.clearedInStage = 0;
        }

        return {
          valid: true,
          action: 'correct',
          index: cellIndex,
          isComplete: gameState.found === gameState.totalTaps
        };
      } else {
        gameState.mistakes++;
        return {
          valid: true,
          action: 'wrong',
          index: cellIndex
        };
      }
    }

    // Variants 0, 1, 2: cycle through 0..4
    if (cellValue === gameState.currentStepIndex) {
      gameState.found++;
      gameState.currentStepIndex = (gameState.currentStepIndex + 1) % 5;
      gameState.clearedIndices.add(cellIndex);
      gameState.taps.push({ index: cellIndex, time: elapsedMs });

      return {
        valid: true,
        action: 'correct',
        index: cellIndex,
        isComplete: gameState.found === gameState.totalTaps
      };
    } else {
      gameState.mistakes++;
      return {
        valid: true,
        action: 'wrong',
        index: cellIndex
      };
    }
  },

  getTargetDisplay(gameState, challenge) {
    if (gameState.found >= gameState.totalTaps) return '🎯 Complete!';

    if (gameState.variantIndex === 1) {
      const targetColor = BASE_COLORS[gameState.currentStepIndex];
      return `🎯 Tap FONT: ${targetColor.emoji} ${targetColor.name}`;
    } else if (gameState.variantIndex === 2) {
      const targetShape = SHAPES[gameState.currentStepIndex];
      return `🎯 Tap Shape: ${targetShape.emoji} ${targetShape.name}`;
    } else if (gameState.variantIndex === 3) {
      const targetColor = BASE_COLORS[gameState.currentColorStage];
      const left = gameState.counts[gameState.currentColorStage] - gameState.clearedInStage;
      return `🎯 Clear: ${targetColor.emoji} ${targetColor.name} (${left} left)`;
    } else {
      const colors = challenge?.cycleColors || BASE_COLORS;
      const targetColor = colors[gameState.currentStepIndex];
      return `🎯 Tap: ${targetColor.emoji} ${targetColor.name}`;
    }
  },

  getProgress(gameState) {
    return `${gameState.found}/${gameState.totalTaps} cleared`;
  },

  getStats(gameState, elapsedMs) {
    const accuracy = gameState.found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((gameState.found / (gameState.found + gameState.mistakes)) * 100);

    const scoreBase = Math.max(0, 10000 - elapsedMs / 6) * (1 - gameState.mistakes * 0.05);
    const score = Math.max(0, Math.min(10000, Math.round(scoreBase)));

    return {
      time: elapsedMs,
      found: gameState.found,
      totalTaps: gameState.totalTaps,
      mistakes: gameState.mistakes,
      accuracy,
      score
    };
  }
};
