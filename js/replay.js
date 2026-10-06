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
    
    // Exact target rank:
    // If total players <= 100, use their exact rank directly!
    // If total players > 100, use their exact percentile!
    let targetRank;
    if (playerResult.rank && playerResult.totalPlayers && playerResult.totalPlayers <= 100) {
      targetRank = Math.max(1, Math.min(100, playerResult.rank));
    } else if (playerResult.percentile) {
      targetRank = Math.max(1, Math.min(100, playerResult.percentile));
    } else if (playerResult.rank && playerResult.totalPlayers) {
      targetRank = Math.max(1, Math.min(100, Math.round((playerResult.rank / playerResult.totalPlayers) * 100)));
    } else if (playerResult.score != null) {
      targetRank = Math.max(1, Math.min(100, Math.round(101 - (playerResult.score / 100))));
    } else {
      targetRank = 50;
    }

    const playerScore = playerResult.score != null
      ? playerResult.score
      : calculateScore(playerResult.time, playerResult.mistakes || 0);

    // Compute deterministic descending step sizes to guarantee strict score ordering
    const ceilingScore = Math.max(playerScore + (targetRank - 1) * 20, 9950);
    const stepAhead = targetRank > 1 
      ? Math.max(1, Math.floor((ceilingScore - playerScore) / targetRank))
      : 1;

    const floorScore = Math.min(playerScore - (100 - targetRank) * 20, 500);
    const stepBehind = targetRank < 100
      ? Math.max(1, Math.floor((playerScore - floorScore) / (101 - targetRank)))
      : 1;

    // Build exactly 100 racers with guaranteed contiguous ranks 1..100
    for (let r = 1; r <= 100; r++) {
      if (r === targetRank) {
        // Real human player
        this.players.push({
          id: 0,
          rank: r,
          time: playerResult.time,
          score: playerScore,
          isPlayer: true,
          yOffset: 0.5,
          eliminatedAt: -1
        });
      } else {
        // Bot / ghost racer
        let timeMultiplier;
        let botScore;

        if (r < targetRank) {
          // Faster bot ahead of player: time < player time, score > player score
          const fraction = r / targetRank; // 0..1
          timeMultiplier = 0.65 + (fraction * 0.32);
          botScore = playerScore + (targetRank - r) * stepAhead;
        } else {
          // Slower bot behind player: time > player time, score < player score
          const fraction = (r - targetRank) / (101 - targetRank); // 0..1
          timeMultiplier = 1.05 + (fraction * 1.5);
          botScore = playerScore - (r - targetRank) * stepBehind;
        }
        
        const botTime = Math.max(5000, Math.round(playerResult.time * timeMultiplier));
        this.players.push({
          id: r,
          rank: r,
          time: botTime,
          score: botScore,
          isPlayer: false,
          yOffset: rng.next(),
          eliminatedAt: -1
        });
      }
    }

    // Sort by rank ascending (rank 1 at index 0, rank 100 at index 99)
    this.players.sort((a, b) => a.rank - b.rank);

    // Set elimination wave timestamps for ranks 21 to 100
    this.players.forEach(p => {
      if (p.rank > 20) {
        const eliminationGroup = Math.floor((100 - p.rank) / 20); // 0, 1, 2, 3
        p.eliminatedAt = 1200 + (eliminationGroup * 1100) + rng.next() * 800;
        p.finalProgress = 0.25 + (rng.next() * 0.55);
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
