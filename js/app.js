import { Storage } from './storage.js';
import { getTodayMode, getTodayChallenge, getModeInfo, getDailyNumber, ALL_MODES } from './daily.js';
import { GameEngine } from './engine.js';
import { getDailySeed, SeededRandom, formatTime, formatNumber, delay } from './utils.js';
import { generateShareCard, shareResult } from './share.js';
import { BattleReplay } from './replay.js';

let currentEngine = null;
let currentMode = null;
let currentGameState = null;
let currentChallenge = null;
let replayInstance = null;
let tempEngine = null;
let lastResult = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

async function init() {
  const modeInfo = getModeInfo();
  document.getElementById('home-mode-emoji').textContent = modeInfo.emoji;
  document.getElementById('home-mode-name').textContent = modeInfo.name;
  document.getElementById('home-mode-desc').textContent = modeInfo.description;
  
  const streak = Storage.getStreak();
  document.getElementById('home-streak').textContent = `🔥 Streak: ${streak.current} (Best: ${streak.best})`;
  
  const hasPlayed = Storage.hasPlayedToday();
  if (hasPlayed) {
    document.getElementById('home-play-btn').style.display = 'none';
    document.getElementById('home-already-played').style.display = 'block';
  } else {
    document.getElementById('home-play-btn').style.display = 'inline-block';
    document.getElementById('home-already-played').style.display = 'none';
  }
  
  showScreen('screen-home');
}

function setupEventListeners() {
  document.getElementById('home-play-btn').addEventListener('click', () => startGame(false));
  document.getElementById('home-view-result-btn').addEventListener('click', () => {
    const result = Storage.getTodayResult();
    if (result) showResult(result);
  });
  document.getElementById('home-practice-btn').addEventListener('click', () => startGame(true));
  
  // How to play modal
  const modal = document.getElementById('modal-how-to-play');
  const howToPlayBtn = document.getElementById('home-how-to-play-btn');
  if (howToPlayBtn && modal) {
    howToPlayBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.remove('hidden');
    });
    document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('modal-got-it-btn')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }
  
  document.getElementById('game-peek-btn').addEventListener('click', () => {
    if (currentMode && currentMode.handlePeek && currentGameState && currentEngine) {
      currentMode.handlePeek(currentGameState);
      
      const count = currentEngine.getCellCount();
      for (let i = 0; i < count; i++) {
        const el = currentEngine.getCellElement(i);
        if (el && el.classList.contains('hidden-cell')) {
          el.classList.remove('hidden-cell');
          el.classList.add('temp-reveal');
        }
      }
      
      setTimeout(() => {
        for (let i = 0; i < count; i++) {
          const el = currentEngine.getCellElement(i);
          if (el && el.classList.contains('temp-reveal')) {
            el.classList.remove('temp-reveal');
            el.classList.add('hidden-cell');
          }
        }
      }, currentMode.peekDuration || 1500);
    }
  });
  
  document.getElementById('result-share-btn').addEventListener('click', async () => {
    const result = lastResult || Storage.getTodayResult();
    if (result) {
      await shareResult(result);
      const toast = document.getElementById('share-toast');
      if (toast) {
        toast.style.display = 'block';
        toast.classList.add('show');
        setTimeout(() => { 
            toast.style.display = 'none'; 
            toast.classList.remove('show');
        }, 2000);
      }
    }
  });
  
  document.getElementById('result-replay-btn').addEventListener('click', () => {
    const result = lastResult || Storage.getTodayResult();
    if (result) {
      showScreen('screen-replay');
      const canvas = document.getElementById('replay-canvas');
      if (replayInstance) replayInstance.destroy();
      replayInstance = new BattleReplay(canvas);
      replayInstance.loadData(result);
      replayInstance.play();
    }
  });

  document.getElementById('result-home-btn')?.addEventListener('click', () => {
    init();
  });
  
  document.getElementById('replay-back-btn').addEventListener('click', () => {
    if (replayInstance) replayInstance.stop();
    showScreen('screen-result');
  });
}

async function startGame(isPractice = false) {
  if (isPractice) {
    const modeKeys = Object.keys(ALL_MODES);
    const randomKey = modeKeys[Math.floor(Math.random() * modeKeys.length)];
    currentMode = ALL_MODES[randomKey];
    const rng = new SeededRandom(Date.now());
    currentChallenge = currentMode.generateChallenge(rng);
  } else {
    currentMode = getTodayMode();
    const dailyChal = getTodayChallenge();
    currentChallenge = dailyChal.challenge;
  }

  showScreen('screen-countdown');
  const cdNum = document.getElementById('countdown-number');
  const cdMode = document.getElementById('countdown-mode');
  
  if (cdMode) {
    cdMode.textContent = `${currentMode.emoji} ${currentMode.name}`;
  }
  
  cdNum.textContent = '3';
  await delay(800);
  cdNum.textContent = '2';
  await delay(800);
  cdNum.textContent = '1';
  await delay(800);
  cdNum.textContent = 'GO!';
  await delay(400);
  
  currentGameState = currentMode.createGameState(currentChallenge);
  
  if (currentMode.memorizeDuration) {
    showScreen('screen-memorize');
    
    if (tempEngine) tempEngine.destroy();
    tempEngine = new GameEngine(document.getElementById('memorize-grid'), document.getElementById('memorize-timer'));
    tempEngine.setupGrid(currentChallenge.grid);
    
    let secondsLeft = (currentMode.memorizeDuration) / 1000;
    const timerEl = document.getElementById('memorize-timer');
    timerEl.textContent = secondsLeft.toFixed(1) + 's';
    
    const interval = setInterval(() => {
      secondsLeft -= 0.1;
      if (secondsLeft <= 0) {
        clearInterval(interval);
      } else {
        timerEl.textContent = Math.max(0, secondsLeft).toFixed(1) + 's';
      }
    }, 100);
    
    await delay(currentMode.memorizeDuration);
    clearInterval(interval);
    
    tempEngine.destroy();
    tempEngine = null;
    
    showScreen('screen-game');
    
    if (currentEngine) currentEngine.destroy();
    currentEngine = new GameEngine(document.getElementById('game-grid'), document.getElementById('game-timer'));
    
    if (currentMode.id === 'memory-grid') {
      currentEngine.setupGrid(currentChallenge.grid);
      const count = currentEngine.getCellCount();
      for (let i = 0; i < count; i++) {
        const el = currentEngine.getCellElement(i);
        if (el) el.classList.add('hidden-cell');
      }
      document.getElementById('game-peek-btn').classList.remove('hidden');
    } else if (currentMode.id === 'minefield') {
      const disguisedGrid = {
        ...currentChallenge.grid,
        cells: currentChallenge.grid.cells.map(c => ({
          ...c,
          display: '?',
          classes: ['disguised-cell']
        }))
      };
      currentEngine.setupGrid(disguisedGrid);
      document.getElementById('game-peek-btn').classList.add('hidden');
    } else {
      currentEngine.setupGrid(currentChallenge.grid);
      document.getElementById('game-peek-btn').classList.add('hidden');
    }
    
    currentGameState.phase = 'play';
  } else {
    showScreen('screen-game');
    document.getElementById('game-peek-btn').classList.add('hidden');
    
    if (currentEngine) currentEngine.destroy();
    currentEngine = new GameEngine(document.getElementById('game-grid'), document.getElementById('game-timer'));
    currentEngine.setupGrid(currentChallenge.grid);
  }
  
  // Target display
  const targetEl = document.getElementById('game-target');
  if (targetEl) {
    if (currentMode.getTargetDisplay) {
      targetEl.textContent = currentMode.getTargetDisplay(currentGameState, currentChallenge);
      targetEl.classList.remove('hidden');
    } else if (currentChallenge.targetSum) {
      targetEl.textContent = `🎯 Target: ${currentChallenge.targetSum}`;
      targetEl.classList.remove('hidden');
    } else {
      targetEl.classList.add('hidden');
    }
  }
  
  document.getElementById('game-mode-info').textContent = `${currentMode.emoji} ${currentMode.name}`;
  if (currentMode.getProgress) {
    document.getElementById('game-progress').textContent = currentMode.getProgress(currentGameState);
  } else if (currentMode.id === 'sum-hunt') {
    document.getElementById('game-progress').textContent = `0/${currentGameState.totalPairs} cleared`;
  }
  document.getElementById('game-mistakes').textContent = '❌ 0';
  
  currentEngine.onCellTap((index, cellData) => handleCellTap(index, cellData, isPractice));
  currentEngine.startTimer();
}

function handleCellTap(index, cellData, isPractice) {
  if (!currentMode || !currentGameState || !currentEngine) return;
  
  const elapsedMs = currentEngine.getElapsedTime();
  const cellValue = cellData ? cellData.value : (currentChallenge.grid.cells[index] ? currentChallenge.grid.cells[index].value : null);
  const result = currentMode.handleTap(index, currentGameState, elapsedMs, cellValue);
  
  if (!result || !result.valid) return;
  
  if (result.action === 'select') {
    currentEngine.selectCell(index);
  } else if (result.action === 'deselect') {
    currentEngine.deselectCell(index);
  } else if (result.action === 'correct') {
    if (currentMode.id === 'memory-grid') {
      currentEngine.revealCell(index);
      const el = currentEngine.getCellElement(index);
      if (el) el.classList.remove('hidden-cell');
    } else if (result.indices) {
      currentEngine.deselectAll();
      result.indices.forEach(i => currentEngine.highlightCell(i, 'correct'));
      setTimeout(() => {
        result.indices.forEach(i => currentEngine.clearCell(i));
      }, 250);
    } else {
      currentEngine.highlightCell(index, 'correct');
      setTimeout(() => {
        currentEngine.clearCell(index);
      }, 200);
    }
  } else if (result.action === 'wrong') {
    if (currentMode.id === 'memory-grid') {
      const el = currentEngine.getCellElement(index);
      if (el) {
        el.classList.remove('hidden-cell');
        currentEngine.highlightCell(index, 'wrong');
        setTimeout(() => {
          el.classList.add('hidden-cell');
        }, 500);
      }
    } else if (result.indices) {
      currentEngine.deselectAll();
      result.indices.forEach(i => currentEngine.highlightCell(i, 'wrong'));
    } else {
      currentEngine.highlightCell(index, 'wrong');
    }
  } else if (result.action === 'bomb') {
    currentEngine.highlightCell(index, 'bomb');
    currentEngine.updateCell(index, { display: '💥', addClass: 'bomb' });
  }
  
  // Update target display
  const targetEl = document.getElementById('game-target');
  if (targetEl && currentMode.getTargetDisplay) {
    targetEl.textContent = currentMode.getTargetDisplay(currentGameState, currentChallenge);
  }
  
  // Update progress
  if (currentMode.getProgress) {
    document.getElementById('game-progress').textContent = currentMode.getProgress(currentGameState);
  }
  document.getElementById('game-mistakes').textContent = `❌ ${currentGameState.mistakes}`;
  
  if (result.isComplete) {
    endGame(isPractice);
  }
}

async function endGame(isPractice) {
  currentEngine.stopTimer();
  const elapsedMs = currentEngine.getElapsedTime();
  const stats = currentMode.getStats(currentGameState, elapsedMs);
  
  const totalPlayers = 125000 + Math.floor(new SeededRandom(getDailySeed()).next() * 50000);
  const randomJitter = Math.floor(Math.random() * 100) - 50;
  const rankNumber = Math.max(1, Math.floor(totalPlayers * (1 - stats.score / 10000) * 0.8) + randomJitter);
  const percentile = Math.max(1, Math.round((rankNumber / totalPlayers) * 100));
  
  const result = {
    mode: { id: currentMode.id, name: currentMode.name, emoji: currentMode.emoji },
    time: stats.time,
    score: stats.score,
    accuracy: stats.accuracy,
    mistakes: stats.mistakes,
    rank: rankNumber,
    totalPlayers,
    percentile,
    streak: Storage.getStreak().current,
    date: Date.now(),
    dayNumber: getDailyNumber()
  };
  
  if (!isPractice) {
    Storage.saveTodayResult(result);
    Storage.updateStreak();
    result.streak = Storage.getStreak().current;
  }
  
  showResult(result);
}

function showResult(result) {
  lastResult = result;
  showScreen('screen-result');
  
  document.getElementById('result-time').textContent = formatTime(result.time);
  document.getElementById('result-score').textContent = formatNumber(result.score);
  document.getElementById('result-accuracy').textContent = `${result.accuracy}%`;
  document.getElementById('result-mistakes').textContent = result.mistakes;
  document.getElementById('result-rank-text').textContent = `#${formatNumber(result.rank)} / ${formatNumber(result.totalPlayers)}`;
  document.getElementById('result-rank-percentile').textContent = `Top ${result.percentile}%`;
  document.getElementById('result-streak-display').textContent = `🔥 Streak: ${result.streak} Days`;
  
  const fillEl = document.getElementById('result-rank-fill');
  if (fillEl) {
    fillEl.style.width = '0%';
    setTimeout(() => {
      fillEl.style.width = `${100 - result.percentile}%`;
    }, 100);
  }
  
  generateShareCard(result);
  
  if (currentEngine) {
    currentEngine.destroy();
    currentEngine = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  init();
});
