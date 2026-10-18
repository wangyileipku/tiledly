const PREFIX = 'tiledly_';

const memoryStore = {};
let isLocalStorageWorking = true;

export const safeStorage = {
  getItem(key) {
    if (isLocalStorageWorking && typeof localStorage !== 'undefined') {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      } catch (e) {
        console.warn('localStorage.getItem failed (private browsing?), using in-memory store:', e.message);
        isLocalStorageWorking = false;
      }
    }
    return memoryStore[key] ?? null;
  },
  setItem(key, value) {
    const strVal = String(value);
    memoryStore[key] = strVal;
    if (isLocalStorageWorking && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, strVal);
      } catch (e) {
        console.warn('localStorage.setItem failed (quota or private mode), using in-memory store:', e.message);
        isLocalStorageWorking = false;
      }
    }
  },
  removeItem(key) {
    delete memoryStore[key];
    if (isLocalStorageWorking && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('localStorage.removeItem failed, using in-memory store:', e.message);
        isLocalStorageWorking = false;
      }
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

    this.savePersonalBest(result.mode, result);
  },
  savePersonalBest(mode, result) {
    const modeId = typeof mode === 'string' ? mode : (mode?.id || 'default');
    const pb = this.getPersonalBest(modeId);
    if (!pb || (result.score && result.score > (pb.score || 0))) {
      safeStorage.setItem(`${PREFIX}pb_${modeId}`, JSON.stringify(result));
      return true;
    }
    return false;
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
      // Check for PRO status or Streak Shield protection
      const isPro = this.getSetting('is_pro', false);
      const shields = this.getSetting('streak_shields', 0);

      if (isPro && streak.lastPlayedDate) {
        // PRO members receive automatic streak protection
        streak.current += 1;
      } else if (shields > 0 && streak.lastPlayedDate) {
        // Consume 1 streak shield
        this.setSetting('streak_shields', shields - 1);
        streak.current += 1;
      } else {
        streak.current = 1;
      }
    }

    if (streak.current > streak.best) {
      streak.best = streak.current;
    }

    streak.lastPlayedDate = today;
    safeStorage.setItem(`${PREFIX}streak`, JSON.stringify(streak));
  },
  setStreak(streak) {
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
