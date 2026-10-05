import { SeededRandom, easeOutCubic, calculateScore } from './utils.js';

export class BattleReplay {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.animationId = null;
    this.players = [];
    this.startTime = 0;
    this.duration = 8000;
    
    this.resize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resize.bind(this));
    }
  }
  
  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
    const width = parent.clientWidth || windowWidth;
    const height = Math.min(400, windowHeight * 0.5) || 400;
    
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;
  }
  
  loadData(playerResult) {
    const rng = new SeededRandom(playerResult.date || Date.now());
    this.players = [];
    
    const targetPlayerRank = playerResult.percentile 
      ? Math.max(1, Math.min(100, playerResult.percentile))
      : 50;

    for (let i = 1; i <= 99; i++) {
      let timeMultiplier;
      let botMistakes = 0;

      if (i < targetPlayerRank) {
        // Faster bot (ranks above the player)
        const factor = i / Math.max(1, targetPlayerRank);
        timeMultiplier = 0.55 + factor * 0.40 + (rng.next() * 0.04);
        botMistakes = rng.next() < 0.15 ? 1 : 0;
      } else {
        // Slower bot (ranks below the player)
        const factor = (i - targetPlayerRank) / Math.max(1, 100 - targetPlayerRank);
        timeMultiplier = 1.05 + factor * 1.50 + (rng.next() * 0.10);
        botMistakes = rng.next() < 0.4 ? Math.floor(rng.next() * 4) + 1 : 0;
      }
      
      const time = Math.max(8000, Math.round(playerResult.time * timeMultiplier));
      const score = calculateScore(time, botMistakes);
      this.players.push({
        id: i,
        time,
        score,
        isPlayer: false,
        yOffset: rng.next()
      });
    }
    
    this.players.push({
      id: 0,
      time: playerResult.time,
      score: playerResult.score || calculateScore(playerResult.time, playerResult.mistakes || 0),
      isPlayer: true,
      yOffset: 0.5
    });
    
    this.players.sort((a, b) => b.score - a.score);
    
    this.players.forEach((p, index) => {
      p.rank = index + 1;
      p.eliminatedAt = -1;
      
      if (p.rank > 20) {
        const eliminationGroup = Math.floor((100 - p.rank) / 20);
        p.eliminatedAt = 1000 + (eliminationGroup * 1000) + rng.next() * 1000;
        p.finalProgress = rng.next() * 0.8; 
      }
    });
    
    this.playerIndex = this.players.findIndex(p => p.isPlayer);
  }
  
  play() {
    this.stop();
    this.startTime = performance.now();
    this.loop(this.startTime);
  }
  
  loop(timestamp) {
    this.animationId = requestAnimationFrame(this.loop.bind(this));
    
    const elapsed = timestamp - this.startTime;
    
    this.draw(elapsed);
    this.updateStatus(elapsed);
    
    if (elapsed >= this.duration + 1000) {
      this.stop();
    }
  }
  
  draw(elapsed) {
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, (this.height / 6) * i);
      this.ctx.lineTo(this.width, (this.height / 6) * i);
      this.ctx.stroke();
    }
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.width - 40, 0);
    this.ctx.lineTo(this.width - 40, this.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    const startX = 20;
    const endX = this.width - 40;
    const trackWidth = endX - startX;
    
    this.players.forEach(p => {
      if (!p.isPlayer) this.drawPlayer(p, elapsed, startX, trackWidth);
    });
    
    const player = this.players[this.playerIndex];
    if (player) {
      this.drawPlayer(player, elapsed, startX, trackWidth);
    }
    
    if (elapsed > 6000) {
      const alpha = Math.min((elapsed - 6000) / 1000, 1);
      this.ctx.fillStyle = `rgba(10, 10, 26, ${alpha * 0.7})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
      
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`🏆 #${player.rank}`, this.width / 2, this.height / 2 - 20);
      
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
      this.ctx.font = '24px system-ui, -apple-system, sans-serif';
      this.ctx.fillText('out of 100 players', this.width / 2, this.height / 2 + 30);
    }
  }
  
  drawPlayer(p, elapsed, startX, trackWidth) {
    const isEliminated = p.eliminatedAt !== -1 && elapsed > p.eliminatedAt;
    
    let progress = 0;
    
    if (p.eliminatedAt !== -1) {
      if (isEliminated) {
        progress = p.finalProgress;
      } else {
        const timeFactor = elapsed / p.eliminatedAt;
        progress = easeOutCubic(timeFactor) * p.finalProgress;
      }
    } else {
      const finishTime = 5000 + ((p.rank - 1) / 19) * 1000;
      if (elapsed > finishTime) {
        progress = 1;
      } else {
        progress = easeOutCubic(elapsed / finishTime);
      }
    }
    
    const x = startX + progress * trackWidth;
    
    const padding = 20;
    const y = padding + p.yOffset * (this.height - padding * 2);
    
    this.ctx.beginPath();
    
    if (p.isPlayer) {
      this.ctx.arc(x, y, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = '#00e5ff';
      this.ctx.shadowColor = '#00e5ff';
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    } else {
      let radius = 3;
      let alpha = 0.4;
      let color = '255, 255, 255';
      
      if (isEliminated) {
        const timeSinceEliminated = elapsed - p.eliminatedAt;
        const fade = Math.max(0, 1 - timeSinceEliminated / 500);
        radius = 3 * fade;
        alpha = fade;
        color = '255, 51, 102';
      } else if (p.rank <= 10) {
        alpha = 0.8;
      }
      
      if (radius > 0) {
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${color}, ${alpha})`;
        this.ctx.fill();
      }
    }
  }
  
  updateStatus(elapsed) {
    const statusEl = document.getElementById('replay-status');
    if (!statusEl) return;
    
    if (elapsed < 1000) {
      statusEl.textContent = '100 players racing...';
    } else if (elapsed < 2000) {
      statusEl.textContent = '80 players remaining...';
    } else if (elapsed < 3000) {
      statusEl.textContent = '60 players remaining...';
    } else if (elapsed < 4000) {
      statusEl.textContent = '40 players remaining...';
    } else if (elapsed < 5000) {
      statusEl.textContent = '20 players remaining...';
    } else if (elapsed < 6000) {
      statusEl.textContent = 'Final sprint...';
    } else {
      const player = this.players[this.playerIndex];
      if (player) {
        statusEl.textContent = `You finished #${player.rank} out of 100!`;
      }
    }
  }
  
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize.bind(this));
  }
}
