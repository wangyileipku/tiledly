const PREFIX = 'tiledly_';

const memoryStore = {};
const safeStorage = {
  getItem(key) {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return memoryStore[key] || null;
  },
  setItem(key, value) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    } else {
      memoryStore[key] = String(value);
    }
  },
  removeItem(key) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    } else {
      delete memoryStore[key];
    }
  }
};

function getFormattedDate(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const Storage = {
  getDeviceId() {
    let deviceId = safeStorage.getItem(`${PREFIX}device_id`);
    if (!deviceId) {
      deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `tiledly_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      safeStorage.setItem(`${PREFIX}device_id`, deviceId);
    }
    return deviceId;
  },

  saveTodayResult(result) {
    const today = getFormattedDate();
    safeStorage.setItem(`${PREFIX}result_${today}`, JSON.stringify(result));
    
    const history = this.getHistory();
    history.unshift(result);
    if (history.length > 30) history.pop();
    safeStorage.setItem(`${PREFIX}history`, JSON.stringify(history));

    const modeId = typeof result.mode === 'string' ? result.mode : (result.mode?.id || 'default');
    const pb = this.getPersonalBest(modeId);
    if (!pb || result.score > pb.score) {
      safeStorage.setItem(`${PREFIX}pb_${modeId}`, JSON.stringify(result));
    }
  },
  getTodayResult() {
    const today = getFormattedDate();
    const data = safeStorage.getItem(`${PREFIX}result_${today}`);
    return data ? JSON.parse(data) : null;
  },
  hasPlayedToday() {
    return this.getTodayResult() !== null;
  },
  getStreak() {
    const data = safeStorage.getItem(`${PREFIX}streak`);
    if (!data) return { current: 0, best: 0 };
    return JSON.parse(data);
  },
  updateStreak(date = new Date()) {
    const today = getFormattedDate(date);
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const yesterday = getFormattedDate(d);
    
    let streakData = safeStorage.getItem(`${PREFIX}streak`);
    let streak = streakData ? JSON.parse(streakData) : { current: 0, best: 0, lastPlayedDate: null };

    if (streak.lastPlayedDate === today) {
      return;
    }

    if (streak.lastPlayedDate === yesterday) {
      streak.current += 1;
    } else {
      streak.current = 1;
    }

    if (streak.current > streak.best) {
      streak.best = streak.current;
    }

    streak.lastPlayedDate = today;
    safeStorage.setItem(`${PREFIX}streak`, JSON.stringify(streak));
  },
  getHistory() {
    const data = safeStorage.getItem(`${PREFIX}history`);
    return data ? JSON.parse(data) : [];
  },
  getPersonalBest(modeId) {
    const data = safeStorage.getItem(`${PREFIX}pb_${modeId}`);
    return data ? JSON.parse(data) : null;
  },
  getSetting(key, defaultValue) {
    const data = safeStorage.getItem(`${PREFIX}setting_${key}`);
    return data !== null ? JSON.parse(data) : defaultValue;
  },
  setSetting(key, value) {
    safeStorage.setItem(`${PREFIX}setting_${key}`, JSON.stringify(value));
  }
};
