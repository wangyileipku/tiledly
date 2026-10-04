export const MemoryGridMode = {
  id: 'memory-grid',
  name: 'Memory Grid',
  emoji: '🧠',
  description: 'Memorize the grid, then tap numbers in order!',
  
  memorizeDuration: 4000,
  peekDuration: 1500,
  peekPenalty: 2000,
  
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
      grid: { rows: 5, cols: 5, cells }
    };
  },
  
  createGameState(challenge) {
    return {
      currentTarget: 1,
      totalNumbers: 25,
      found: 0,
      mistakes: 0,
      peeks: 0,
      peekPenaltyMs: 0,
      taps: [],
      phase: 'memorize'
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
        isComplete: gameState.found === gameState.totalNumbers 
      };
    } else {
      gameState.mistakes++;
      return { 
        valid: true, 
        action: 'wrong', 
        expectedValue: cellValue 
      };
    }
  },
  
  handlePeek(gameState) {
    gameState.peeks++;
    gameState.peekPenaltyMs += this.peekPenalty;
    return { peekPenaltyMs: gameState.peekPenaltyMs };
  },
  
  getStats(gameState, elapsedMs) {
    const adjustedTime = elapsedMs + gameState.peekPenaltyMs;
    const accuracy = gameState.found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((gameState.found / (gameState.found + gameState.mistakes)) * 100);
      
    const scoreBase = Math.max(0, 10000 - adjustedTime / 5) * (1 - gameState.mistakes * 0.03) * (1 - gameState.peeks * 0.1);
    const score = Math.max(0, Math.min(10000, Math.round(scoreBase)));
    
    return {
      time: adjustedTime,
      rawTime: elapsedMs,
      found: gameState.found,
      totalNumbers: 25,
      mistakes: gameState.mistakes,
      peeks: gameState.peeks,
      accuracy,
      score
    };
  }
};
