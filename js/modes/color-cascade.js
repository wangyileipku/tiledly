const COLORS = [
  { id: 'red', name: 'Red', hex: '#ff3366', emoji: '🔴' },
  { id: 'orange', name: 'Orange', hex: '#ff7700', emoji: '🟠' },
  { id: 'yellow', name: 'Yellow', hex: '#ffcc00', emoji: '🟡' },
  { id: 'green', name: 'Green', hex: '#00ff88', emoji: '🟢' },
  { id: 'blue', name: 'Blue', hex: '#00e5ff', emoji: '🔵' }
];

export const ColorCascadeMode = {
  id: 'color-cascade',
  name: 'Color Cascade',
  emoji: '🎨',
  description: 'Tap colors in order: Red → Orange → Yellow → Green → Blue!',

  generateChallenge(rng) {
    const items = [];
    for (let c = 0; c < COLORS.length; c++) {
      for (let i = 0; i < 5; i++) {
        items.push({
          colorIndex: c,
          color: COLORS[c]
        });
      }
    }

    const shuffled = rng.shuffle(items);
    const cells = shuffled.map((item, idx) => ({
      id: idx,
      display: item.color.emoji,
      value: item.colorIndex,
      color: item.color.hex + '22', // translucent bg
      classes: ['color-tile']
    }));

    return {
      grid: { rows: 5, cols: 5, cells },
      totalTaps: 25
    };
  },

  createGameState(challenge) {
    return {
      currentColorIndex: 0, // starts with Red (0)
      found: 0,
      totalTaps: 25,
      mistakes: 0,
      taps: []
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (cellValue === gameState.currentColorIndex) {
      gameState.found++;
      gameState.currentColorIndex = (gameState.currentColorIndex + 1) % 5;
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
        index: cellIndex,
        expectedColor: COLORS[gameState.currentColorIndex]
      };
    }
  },

  getTargetDisplay(gameState) {
    if (gameState.found >= gameState.totalTaps) return '🎯 Done!';
    const nextColor = COLORS[gameState.currentColorIndex];
    return `🎯 Tap: ${nextColor.emoji} ${nextColor.name}`;
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
