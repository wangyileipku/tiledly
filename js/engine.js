export class GameEngine {
  constructor(gridContainerEl, timerEl) {
    this.gridContainerEl = gridContainerEl;
    this.timerEl = timerEl;
    this.startTime = null;
    this.animationFrameId = null;
    this.timerRunning = false;
    this.tapHandler = null;
    this._onTap = this._onTap.bind(this);
    this.gridContainerEl.addEventListener('touchend', this._onTap);
    this.gridContainerEl.addEventListener('click', this._onTap);
    this.cells = [];
    this.ignoreNextClick = false;
  }

  setupGrid(config) {
    this.gridContainerEl.innerHTML = '';
    this.gridContainerEl.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
    this.cells = [];

    config.cells.forEach(cellData => {
      const cellEl = document.createElement('div');
      cellEl.classList.add('cell');
      if (cellData.classes) {
        cellEl.classList.add(...cellData.classes);
      }
      if (cellData.color) {
        cellEl.style.backgroundColor = cellData.color;
      }
      cellEl.dataset.index = cellData.id;
      cellEl.textContent = cellData.display;
      this.gridContainerEl.appendChild(cellEl);
      this.cells[cellData.id] = { element: cellEl, data: cellData };
    });
  }

  startTimer() {
    this.startTime = performance.now();
    this.timerRunning = true;
    const updateTimer = () => {
      if (!this.timerRunning) return;
      const ms = performance.now() - this.startTime;
      if (this.timerEl) {
        this.timerEl.textContent = this._formatTime(ms);
      }
      this.animationFrameId = requestAnimationFrame(updateTimer);
    };
    this.animationFrameId = requestAnimationFrame(updateTimer);
  }

  stopTimer() {
    this.timerRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    return performance.now() - this.startTime;
  }

  _formatTime(ms) {
    if (ms < 60000) {
      return (ms / 1000).toFixed(2) + 's';
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}:${seconds.padStart(5, '0')}`;
  }

  onCellTap(callback) {
    this.tapHandler = callback;
  }

  _onTap(e) {
    if (e.type === 'touchend') {
      e.preventDefault();
      this.ignoreNextClick = true;
    } else if (e.type === 'click') {
      if (this.ignoreNextClick) {
        this.ignoreNextClick = false;
        return;
      }
    }

    let target = e.target;
    if (e.type === 'touchend' && e.changedTouches.length > 0) {
      target = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }

    if (target && target.classList.contains('cell')) {
      const index = parseInt(target.dataset.index, 10);
      if (!isNaN(index) && this.tapHandler) {
        this.tapHandler(index, this.cells[index].data);
      }
    }
  }

  updateCell(index, updates) {
    const cell = this.cells[index];
    if (!cell) return;
    if (updates.display !== undefined) {
      cell.element.textContent = updates.display;
    }
    if (updates.color !== undefined) {
      cell.element.style.backgroundColor = updates.color;
    }
    if (updates.addClass) {
      cell.element.classList.add(updates.addClass);
    }
    if (updates.removeClass) {
      cell.element.classList.remove(updates.removeClass);
    }
    if (updates.disabled !== undefined) {
      if (updates.disabled) {
        cell.element.classList.add('disabled');
      } else {
        cell.element.classList.remove('disabled');
      }
    }
  }

  highlightCell(index, type) {
    const cell = this.cells[index];
    if (!cell) return;
    cell.element.classList.add(type);
    
    if (type === 'correct' && navigator.vibrate) {
      navigator.vibrate(10);
    } else if (type === 'wrong' && navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }

    setTimeout(() => {
      cell.element.classList.remove(type);
    }, 300); // Wait for animation
  }

  clearCell(index) {
    this.updateCell(index, { addClass: 'cleared', disabled: true });
  }

  hideCell(index) {
    this.updateCell(index, { addClass: 'hidden-cell' });
  }

  revealCell(index) {
    this.updateCell(index, { removeClass: 'hidden-cell', addClass: 'revealed' });
    setTimeout(() => {
      this.updateCell(index, { removeClass: 'revealed' });
    }, 500);
  }

  selectCell(index) {
    this.updateCell(index, { addClass: 'selected' });
  }

  deselectCell(index) {
    this.updateCell(index, { removeClass: 'selected' });
  }

  deselectAll() {
    this.cells.forEach(c => {
      if (c && c.element) {
        c.element.classList.remove('selected');
      }
    });
  }

  disableAllCells() {
    this.cells.forEach(c => {
      if (c && c.element) {
        c.element.classList.add('disabled');
      }
    });
  }

  getCellElement(index) {
    return this.cells[index] ? this.cells[index].element : null;
  }

  getCellCount() {
    return this.cells.length;
  }

  destroy() {
    this.stopTimer();
    this.gridContainerEl.removeEventListener('touchend', this._onTap);
    this.gridContainerEl.removeEventListener('click', this._onTap);
    this.gridContainerEl.innerHTML = '';
    this.cells = [];
    this.tapHandler = null;
  }
}
