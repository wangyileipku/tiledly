const PREFIX = 'gridclash_';

function getFormattedDate(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const Storage = {
  saveTodayResult(result) {
    const today = getFormattedDate();
    localStorage.setItem(`${PREFIX}result_${today}`, JSON.stringify(result));
    
    const history = this.getHistory();
    history.unshift(result);
    if (history.length > 30) history.pop();
    localStorage.setItem(`${PREFIX}history`, JSON.stringify(history));

    const modeId = typeof result.mode === 'string' ? result.mode : (result.mode?.id || 'default');
    const pb = this.getPersonalBest(modeId);
    if (!pb || result.score > pb.score) {
      localStorage.setItem(`${PREFIX}pb_${modeId}`, JSON.stringify(result));
    }
  },
  getTodayResult() {
    const today = getFormattedDate();
    const data = localStorage.getItem(`${PREFIX}result_${today}`);
    return data ? JSON.parse(data) : null;
  },
  hasPlayedToday() {
    return this.getTodayResult() !== null;
  },
  getStreak() {
    const data = localStorage.getItem(`${PREFIX}streak`);
    if (!data) return { current: 0, best: 0 };
    return JSON.parse(data);
  },
  updateStreak() {
    const today = getFormattedDate();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = getFormattedDate(d);
    
    let streakData = localStorage.getItem(`${PREFIX}streak`);
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
    localStorage.setItem(`${PREFIX}streak`, JSON.stringify(streak));
  },
  getHistory() {
    const data = localStorage.getItem(`${PREFIX}history`);
    return data ? JSON.parse(data) : [];
  },
  getPersonalBest(modeId) {
    const data = localStorage.getItem(`${PREFIX}pb_${modeId}`);
    return data ? JSON.parse(data) : null;
  },
  getSetting(key, defaultValue) {
    const data = localStorage.getItem(`${PREFIX}setting_${key}`);
    return data !== null ? JSON.parse(data) : defaultValue;
  },
  setSetting(key, value) {
    localStorage.setItem(`${PREFIX}setting_${key}`, JSON.stringify(value));
  }
};
