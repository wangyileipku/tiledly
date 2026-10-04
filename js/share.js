import { formatTime } from './utils.js';

export async function generateShareCard(result) {
  const canvas = document.getElementById('result-share-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = 600;
  canvas.height = 340;
  
  // Background
  const bgGradient = ctx.createLinearGradient(0, 0, 0, 340);
  bgGradient.addColorStop(0, '#0a0a1a');
  bgGradient.addColorStop(1, '#1a1a2e');
  
  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, 600, 340, 16);
  ctx.fill();
  
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${result.mode.emoji} GridClash #${result.dayNumber}`, 40, 40);
  
  ctx.fillStyle = '#00e5ff';
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(result.mode.name, 40, 80);
  
  // Stats
  const startY = 130;
  const drawStat = (x, label, value, emoji) => {
    ctx.fillStyle = '#252542';
    ctx.beginPath();
    ctx.roundRect(x, startY, 160, 80, 12);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${emoji} ${label}`, x + 80, startY + 20);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(value, x + 80, startY + 45);
  };
  
  drawStat(40, 'Time', formatTime(result.time), '⏱');
  drawStat(220, 'Accuracy', `${result.accuracy}%`, '✅');
  drawStat(400, 'Score', `${result.score.toLocaleString()}pts`, '🎯');
  
  // Rank bar
  const barY = 240;
  ctx.fillStyle = '#252542';
  ctx.beginPath();
  ctx.roundRect(40, barY, 520, 20, 10);
  ctx.fill();
  
  const fillWidth = 520 * ((100 - result.percentile) / 100);
  const fillGradient = ctx.createLinearGradient(40, 0, 40 + 520, 0);
  fillGradient.addColorStop(0, '#00e5ff');
  fillGradient.addColorStop(1, '#00ff88');
  
  if (fillWidth > 0) {
    ctx.fillStyle = fillGradient;
    ctx.beginPath();
    ctx.roundRect(40, barY, fillWidth, 20, 10);
    ctx.fill();
  }
  
  // Percentile text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Top ${result.percentile}%`, 560, barY - 25);
  
  // Streak
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(`🔥 Streak: ${result.streak} day${result.streak !== 1 ? 's' : ''}`, 40, 290);
  
  // Footer
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText('gridclash.com', 560, 290);
}

export function getShareText(result) {
  const lines = [
    `⚡ GridClash #${result.dayNumber} — ${result.mode.emoji} ${result.mode.name}`,
    `⏱ ${formatTime(result.time)} | ✅ ${result.accuracy}% | 🏆 Top ${result.percentile}%`,
    `🔥 Streak: ${result.streak} day${result.streak !== 1 ? 's' : ''}`,
    `gridclash.com`
  ];
  return lines.join('\n');
}

export async function shareResult(result) {
  const text = getShareText(result);
  
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return true;
    } catch (e) {
      // User cancelled or not supported, fall through
    }
  }
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}
