import { calculateScore } from '../utils.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');

const WORD_SETS = [
  ['BRAIN', 'SPEED', 'CHESS', 'LIGHT', 'FOCUS'],
  ['SWIFT', 'FLAME', 'CLOUD', 'GHOST', 'TRACK'],
  ['POWER', 'BLAZE', 'NINJA', 'TIGER', 'QUICK'],
  ['SMART', 'ZEBRA', 'PIVOT', 'SPARK', 'CLEAN']
];

const VOWEL_ORDER = ['A', 'E', 'I', 'O', 'U', 'B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y'];

export const AlphaHuntMode = {
  id: 'alpha-hunt',
  name: 'Alpha Hunt',
  emoji: '🔤',
  description: 'Hunt and tap letters in order as fast as you can!',

  getVariantInfo(weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variants = [
      { name: 'Alpha Hunt: Classic A→Y', description: 'Hunt and tap letters A through Y in alphabetical order!' },
      { name: 'Alpha Hunt: Reverse Y→A', description: 'Reverse order! Hunt and tap letters Y down to A as fast as you can!' },
      { name: 'Alpha Hunt: Word Sprint', description: 'Find letters to spell 5 five-letter theme words in order!' },
      { name: 'Alpha Hunt: Vowels First', description: 'Tap all vowels (A, E, I, O, U) first, then consonants B through Y!' }
    ];
    const info = variants[variantIndex];
    return {
      id: this.id,
      name: info.name,
      emoji: this.emoji,
      description: info.description
    };
  },

  generateChallenge(rng, weekNum = 1) {
    const variantIndex = (weekNum - 1) % 4;
    const variantInfo = this.getVariantInfo(weekNum);

    if (variantIndex === 1) {
      // Reverse Y to A
      const shuffled = rng.shuffle(LETTERS);
      const cells = shuffled.map((letter, idx) => ({
        id: idx,
        display: letter,
        value: letter
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalLetters: 25,
        sequence: [...LETTERS].reverse()
      };
    } else if (variantIndex === 2) {
      // Word Sprint
      const wordSetIndex = rng.nextInt(0, WORD_SETS.length - 1);
      const words = WORD_SETS[wordSetIndex];
      const allLetters = [];
      words.forEach((w, wIdx) => {
        for (let lIdx = 0; lIdx < w.length; lIdx++) {
          allLetters.push({
            letter: w[lIdx],
            wordIndex: wIdx,
            letterIndex: lIdx
          });
        }
      });
      const shuffled = rng.shuffle(allLetters);
      const cells = shuffled.map((item, idx) => ({
        id: idx,
        display: item.letter,
        value: item.letter,
        meta: item
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        words,
        totalLetters: 25
      };
    } else if (variantIndex === 3) {
      // Vowels first
      const shuffled = rng.shuffle(LETTERS);
      const cells = shuffled.map((letter, idx) => ({
        id: idx,
        display: letter,
        value: letter
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalLetters: 25,
        sequence: VOWEL_ORDER
      };
    } else {
      // Classic A to Y
      const shuffled = rng.shuffle(LETTERS);
      const cells = shuffled.map((letter, idx) => ({
        id: idx,
        display: letter,
        value: letter
      }));
      return {
        variantIndex,
        variantName: variantInfo.name,
        grid: { rows: 5, cols: 5, cells },
        totalLetters: 25,
        sequence: LETTERS
      };
    }
  },

  createGameState(challenge) {
    if (challenge.variantIndex === 2) {
      // Word sprint state
      return {
        variantIndex: 2,
        words: challenge.words,
        currentWordIndex: 0,
        currentLetterIndex: 0,
        totalLetters: 25,
        found: 0,
        mistakes: 0,
        taps: [],
        clearedIndices: new Set()
      };
    }

    return {
      variantIndex: challenge.variantIndex,
      sequence: challenge.sequence || LETTERS,
      currentIndex: 0,
      totalLetters: 25,
      found: 0,
      mistakes: 0,
      taps: [],
      clearedIndices: new Set()
    };
  },

  handleTap(cellIndex, gameState, elapsedMs, cellValue) {
    if (gameState.clearedIndices.has(cellIndex)) {
      return { valid: false };
    }

    if (gameState.variantIndex === 2) {
      // Word Sprint: must match next letter of current word
      const currentWord = gameState.words[gameState.currentWordIndex];
      const expectedLetter = currentWord[gameState.currentLetterIndex];

      if (cellValue === expectedLetter) {
        gameState.found++;
        gameState.currentLetterIndex++;
        gameState.clearedIndices.add(cellIndex);
        gameState.taps.push({ index: cellIndex, time: elapsedMs });

        if (gameState.currentLetterIndex >= currentWord.length) {
          gameState.currentWordIndex++;
          gameState.currentLetterIndex = 0;
        }

        return {
          valid: true,
          action: 'correct',
          index: cellIndex,
          isComplete: gameState.found === gameState.totalLetters
        };
      } else {
        gameState.mistakes++;
        return {
          valid: true,
          action: 'wrong',
          index: cellIndex,
          expectedValue: expectedLetter
        };
      }
    }

    // Sequence-based variants (Classic, Reverse, Vowels)
    const expectedLetter = gameState.sequence[gameState.currentIndex];

    if (cellValue === expectedLetter) {
      gameState.found++;
      gameState.currentIndex++;
      gameState.clearedIndices.add(cellIndex);
      gameState.taps.push({ index: cellIndex, time: elapsedMs });

      return {
        valid: true,
        action: 'correct',
        index: cellIndex,
        isComplete: gameState.found === gameState.totalLetters
      };
    } else {
      gameState.mistakes++;
      return {
        valid: true,
        action: 'wrong',
        index: cellIndex,
        expectedValue: expectedLetter
      };
    }
  },

  getTargetDisplay(gameState) {
    if (gameState.variantIndex === 2) {
      if (gameState.found >= gameState.totalLetters) return '🎯 All Words Spelled!';
      const currentWord = gameState.words[gameState.currentWordIndex];
      const nextLetter = currentWord[gameState.currentLetterIndex];
      return `🎯 Word ${gameState.currentWordIndex + 1}/5: ${currentWord} (Tap: ${nextLetter})`;
    }

    const expected = gameState.sequence[gameState.currentIndex];
    if (!expected) return '🎯 Complete!';

    if (gameState.variantIndex === 3) {
      const isVowel = ['A', 'E', 'I', 'O', 'U'].includes(expected);
      return `🎯 ${isVowel ? 'Vowel' : 'Consonant'}: ${expected}`;
    }

    return `🎯 Next: ${expected}`;
  },

  getProgress(gameState) {
    if (gameState.variantIndex === 2) {
      return `${gameState.currentWordIndex}/5 words (${gameState.found}/25)`;
    }
    return `${gameState.found}/${gameState.totalLetters} letters`;
  },

  getStats(gameState, elapsedMs) {
    const accuracy = gameState.found === 0 && gameState.mistakes === 0
      ? 100
      : Math.round((gameState.found / (gameState.found + gameState.mistakes)) * 100);

    const score = calculateScore(elapsedMs, gameState.mistakes);

    return {
      time: elapsedMs,
      found: gameState.found,
      totalLetters: gameState.totalLetters,
      mistakes: gameState.mistakes,
      accuracy,
      score
    };
  }
};
