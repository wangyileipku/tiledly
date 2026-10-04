export class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    var t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
}

export function getDailySeed() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`, 10);
}

export function getDayOfWeek() {
  return new Date().getDay();
}

export function formatTime(ms) {
  if (ms < 60000) {
    return (ms / 1000).toFixed(2) + 's';
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}:${seconds.padStart(5, '0')}`;
}

export function formatNumber(n) {
  return new Intl.NumberFormat().format(n);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
