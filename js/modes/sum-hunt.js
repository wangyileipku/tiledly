export const SumHuntMode = {
  id: 'sum-hunt',
  name: 'Sum Hunt',
  emoji: '🧮',
  description: 'Find pairs that add up to the target!',
  
  generateChallenge(rng) {
    const targetSum = rng.nextInt(10, 18);
    const numbers = [];
    for (let i = 0; i < 12; i++) {
      const a = rng.nextInt(1, targetSum - 1);
      const b = targetSum - a;
      numbers.push(a, b);
    }
    
    const shuffled = rng.shuffle(numbers);
    
    const cells = [];
    let numberIndex = 0;
    for (let i = 0; i < 25; i++) {
      if (i === 12) {
        cells.push({
          id: i,
          display: `🎯 ${targetSum}`,
          value: null,
          classes: ['target-cell', 'disabled']
        });
      } else {
        const val = shuffled[numberIndex++];
        cells.push({
          id: i,
          display: String(val),
          value: val
        });
      }
    }
    
    return {
      targetSum,
      grid: { rows: 5, cols: 5, cells },
      totalPairs: 12
    };
  },
  
  createGameState(challenge) {
    return {
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
    
    if (val1 + val2 === gameState.targetSum) {
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
  
  getStats(gameState, elapsedMs) {
    const accuracy = gameState.clearedPairs === 0 && gameState.mistakes === 0 
      ? 100 
      : Math.round((gameState.clearedPairs / (gameState.clearedPairs + gameState.mistakes)) * 100);
      
    const scoreBase = Math.max(0, 10000 - elapsedMs / 10) * (1 - gameState.mistakes * 0.05);
    const score = Math.max(0, Math.min(10000, Math.round(scoreBase)));
    
    return {
      time: elapsedMs,
      pairs: gameState.clearedPairs,
      totalPairs: gameState.totalPairs,
      mistakes: gameState.mistakes,
      accuracy,
      score
    };
  }
};
