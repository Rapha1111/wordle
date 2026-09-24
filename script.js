(function () {
  "use strict";

  // WORDS is provided by words.js (array of uppercase, unaccented 5-letter French words).
  // A word is picked at random every time a new game starts.
  var VALID_WORDS = (typeof WORDS !== "undefined" && WORDS.length) ? WORDS : ["POULE"];
  var SOLUTIONS = VALID_WORDS;
  var VALID_SET = new Set(VALID_WORDS);

  var WORD_LENGTH = 5;
  var MAX_GUESSES = 6;
  var STORAGE_STATS_KEY = "lemot_stats_v1";
  var STORAGE_THEME_KEY = "lemot_theme";
  var STORAGE_HARDMODE_KEY = "lemot_hardmode";
  var STORAGE_COLORBLIND_KEY = "lemot_colorblind";

  var KB_ROWS = [
    ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
    ["ENTER", "W", "X", "C", "V", "B", "N", "BACK"]
  ];

  var state = {
    secret: "",
    row: 0,
    col: 0,
    guesses: [],
    rowStates: [],
    gameOver: false,
    won: false,
    keyStates: {},
    hardModeHints: { correct: {}, present: new Set() }
  };

  var boardEl = document.getElementById("board");
  var keyboardEl = document.getElementById("keyboard");
  var toastContainer = document.getElementById("toast-container");

  function pickRandomWord() {
    return SOLUTIONS[Math.floor(Math.random() * SOLUTIONS.length)];
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    for (var r = 0; r < MAX_GUESSES; r++) {
      var rowEl = document.createElement("div");
      rowEl.className = "board-row";
      rowEl.id = "row-" + r;
      for (var c = 0; c < WORD_LENGTH; c++) {
        var tile = document.createElement("div");
        tile.className = "tile";
        tile.id = "tile-" + r + "-" + c;
        rowEl.appendChild(tile);
      }
      boardEl.appendChild(rowEl);
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KB_ROWS.forEach(function (row) {
      var rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      row.forEach(function (key) {
        var btn = document.createElement("button");
        btn.className = "key";
        btn.dataset.key = key;
        if (key === "ENTER" || key === "BACK") btn.classList.add("wide");
        if (key === "ENTER") {
          btn.textContent = "Entrer";
        } else if (key === "BACK") {
          btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2.59 12.59L18 17l-4-4-4 4-1.41-1.41L12.59 12 8.59 8 10 6.59l4 4 4-4L19.41 8 15.41 12l4 3.59z"/></svg>';
        } else {
          btn.textContent = key;
        }
        btn.addEventListener("click", function () {
          onKey(key);
        });
        rowEl.appendChild(btn);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  function showToast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(function () {
      t.remove();
    }, 1600);
  }

  function shakeRow(r) {
    var rowEl = document.getElementById("row-" + r);
    for (var c = 0; c < WORD_LENGTH; c++) {
      rowEl.children[c].classList.add("shake");
    }
    setTimeout(function () {
      for (var c = 0; c < WORD_LENGTH; c++) {
        rowEl.children[c].classList.remove("shake");
      }
    }, 500);
  }

  function onKey(key) {
    if (state.gameOver) return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }
    if (key === "BACK") {
      if (state.col > 0) {
        state.col--;
        setTile(state.row, state.col, "");
      }
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      if (state.col < WORD_LENGTH) {
        setTile(state.row, state.col, key);
        state.col++;
      }
    }
  }

  function setTile(r, c, letter) {
    var tile = document.getElementById("tile-" + r + "-" + c);
    tile.textContent = letter;
    if (letter) {
      tile.classList.add("filled");
      tile.classList.add("pop");
      setTimeout(function () {
        tile.classList.remove("pop");
      }, 120);
    } else {
      tile.classList.remove("filled");
    }
    if (!state.guesses[r]) state.guesses[r] = new Array(WORD_LENGTH).fill("");
    state.guesses[r][c] = letter;
  }

  function currentGuessWord() {
    return (state.guesses[state.row] || []).join("");
  }

  function checkHardMode(guess) {
    for (var pos in state.hardModeHints.correct) {
      if (guess[pos] !== state.hardModeHints.correct[pos]) {
        return "La lettre " + state.hardModeHints.correct[pos] + " doit être en position " + (parseInt(pos, 10) + 1);
      }
    }
    var guessSet = new Set(guess.split(""));
    var missing = null;
    state.hardModeHints.present.forEach(function (l) {
      if (!guessSet.has(l)) missing = l;
    });
    if (missing) return "Le mot doit contenir la lettre " + missing;
    return null;
  }

  function evaluateGuess(guess, secret) {
    var result = new Array(WORD_LENGTH).fill("absent");
    var secretArr = secret.split("");
    var guessArr = guess.split("");
    var used = new Array(WORD_LENGTH).fill(false);

    for (var i = 0; i < WORD_LENGTH; i++) {
      if (guessArr[i] === secretArr[i]) {
        result[i] = "correct";
        used[i] = true;
      }
    }
    for (var i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === "correct") continue;
      for (var j = 0; j < WORD_LENGTH; j++) {
        if (!used[j] && guessArr[i] === secretArr[j]) {
          result[i] = "present";
          used[j] = true;
          break;
        }
      }
    }
    return result;
  }

  function updateKeyboardState(guess, result) {
    var rank = { absent: 0, present: 1, correct: 2 };
    for (var i = 0; i < guess.length; i++) {
      var letter = guess[i];
      var newState = result[i];
      var current = state.keyStates[letter];
      if (!current || rank[newState] > rank[current]) {
        state.keyStates[letter] = newState;
      }
    }
    renderKeyboardColors();
  }

  function renderKeyboardColors() {
    var keys = keyboardEl.querySelectorAll(".key");
    keys.forEach(function (btn) {
      var k = btn.dataset.key;
      if (k === "ENTER" || k === "BACK") return;
      btn.classList.remove("correct", "present", "absent");
      var st = state.keyStates[k];
      if (st) btn.classList.add(st);
    });
  }

  function submitGuess() {
    var guess = currentGuessWord();
    if (guess.length < WORD_LENGTH) {
      showToast("Pas assez de lettres");
      shakeRow(state.row);
      return;
    }
    if (!VALID_SET.has(guess)) {
      showToast("Mot inconnu");
      shakeRow(state.row);
      return;
    }
    if (isHardMode()) {
      var violation = checkHardMode(guess);
      if (violation) {
        showToast(violation);
        shakeRow(state.row);
        return;
      }
    }

    var result = evaluateGuess(guess, state.secret);
    state.rowStates[state.row] = result;

    var rowEl = document.getElementById("row-" + state.row);
    result.forEach(function (r, i) {
      var tile = rowEl.children[i];
      setTimeout(function () {
        tile.classList.add("flip");
        setTimeout(function () {
          tile.classList.add(r);
        }, 250);
      }, i * 250);

      if (r === "correct") {
        state.hardModeHints.correct[i] = guess[i];
      } else if (r === "present") {
        state.hardModeHints.present.add(guess[i]);
      }
    });

    var isWin = guess === state.secret;
    var thisRow = state.row;

    setTimeout(function () {
      updateKeyboardState(guess, result);
      if (isWin) {
        bounceRow(thisRow);
        finishGame(true);
      } else if (thisRow === MAX_GUESSES - 1) {
        finishGame(false);
      } else {
        state.row++;
        state.col = 0;
      }
    }, WORD_LENGTH * 250 + 300);
  }

  function bounceRow(r) {
    var rowEl = document.getElementById("row-" + r);
    for (var c = 0; c < WORD_LENGTH; c++) {
      (function (c) {
        setTimeout(function () {
          rowEl.children[c].classList.add("bounce");
        }, c * 100);
      })(c);
    }
  }

  function finishGame(won) {
    state.gameOver = true;
    state.won = won;
    recordStats(won, state.row + 1);
    setTimeout(function () {
      openEndModal(won);
    }, 1200);
  }

  // ---------------- Stats ----------------

  function loadStats() {
    try {
      var raw = localStorage.getItem(STORAGE_STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0]
    };
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function recordStats(won, guessCount) {
    var stats = loadStats();
    stats.played++;
    if (won) {
      stats.wins++;
      stats.currentStreak++;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.distribution[guessCount - 1]++;
    } else {
      stats.currentStreak = 0;
    }
    saveStats(stats);
  }

  function renderStats() {
    var stats = loadStats();
    document.getElementById("stat-played").textContent = stats.played;
    var pct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    document.getElementById("stat-winpct").textContent = pct;
    document.getElementById("stat-streak").textContent = stats.currentStreak;
    document.getElementById("stat-maxstreak").textContent = stats.maxStreak;

    var distEl = document.getElementById("dist");
    distEl.innerHTML = "";
    var maxVal = Math.max.apply(null, stats.distribution.concat([1]));
    stats.distribution.forEach(function (count, idx) {
      var row = document.createElement("div");
      row.className = "dist-row";
      var num = document.createElement("div");
      num.className = "dist-num";
      num.textContent = idx + 1;
      var wrap = document.createElement("div");
      wrap.className = "dist-bar-wrap";
      var bar = document.createElement("div");
      bar.className = "dist-bar";
      if (state.gameOver && state.won && state.row === idx) bar.classList.add("win");
      var width = Math.max(6, (count / maxVal) * 100);
      bar.style.width = width + "%";
      bar.textContent = count;
      wrap.appendChild(bar);
      row.appendChild(num);
      row.appendChild(wrap);
      distEl.appendChild(row);
    });
  }

  // ---------------- Modals ----------------

  function openModal(id) {
    document.getElementById(id).classList.add("open");
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove("open");
  }
  function closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach(function (m) {
      m.classList.remove("open");
    });
  }

  function openEndModal(won) {
    document.getElementById("end-title").textContent = won ? pickWinTitle() : "Dommage !";
    document.getElementById("end-message").textContent = won
      ? "Vous avez trouvé le mot en " + (state.row + 1) + (state.row === 0 ? " essai" : " essais") + " !"
      : "Vous n'avez pas trouvé le mot cette fois.";
    document.getElementById("end-word").textContent = state.secret;
    renderStats();
    openModal("modal-end");
  }

  function pickWinTitle() {
    var titles = ["Bravo !", "Excellent !", "Magnifique !", "Impressionnant !", "Beau travail !", "Ouf !"];
    return titles[Math.min(state.row, titles.length - 1)];
  }

  function shareText() {
    var lines = ["LE MOT " + (state.won ? (state.row + 1) : "X") + "/6"];
    state.rowStates.forEach(function (result) {
      var line = result
        .map(function (r) {
          if (r === "correct") return "🟩";
          if (r === "present") return "🟨";
          return "⬛";
        })
        .join("");
      lines.push(line);
    });
    return lines.join("\n");
  }

  // ---------------- Settings ----------------

  function isHardMode() {
    return localStorage.getItem(STORAGE_HARDMODE_KEY) === "true";
  }

  function applyTheme() {
    var saved = localStorage.getItem(STORAGE_THEME_KEY);
    var dark = saved !== "light";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.getElementById("toggle-theme").checked = dark;
  }

  function applyColorblind() {
    var on = localStorage.getItem(STORAGE_COLORBLIND_KEY) === "true";
    document.documentElement.setAttribute("data-colorblind", on ? "true" : "false");
    document.getElementById("toggle-colorblind").checked = on;
  }

  function applyHardModeToggle() {
    document.getElementById("toggle-hardmode").checked = isHardMode();
  }

  // ---------------- New game ----------------

  function newGame() {
    state.secret = pickRandomWord();
    state.row = 0;
    state.col = 0;
    state.guesses = [];
    state.rowStates = [];
    state.gameOver = false;
    state.won = false;
    state.keyStates = {};
    state.hardModeHints = { correct: {}, present: new Set() };
    buildBoard();
    renderKeyboardColors();
    closeAllModals();
  }

  // ---------------- Wiring ----------------

  function init() {
    buildBoard();
    buildKeyboard();
    applyTheme();
    applyColorblind();
    applyHardModeToggle();
    document.getElementById("word-count-label").textContent =
      VALID_WORDS.length + " mots possibles dans ce jeu.";
    newGame();

    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var key = e.key.toUpperCase();
      if (key === "ENTER") {
        onKey("ENTER");
      } else if (key === "BACKSPACE") {
        onKey("BACK");
      } else if (/^[A-Z]$/.test(key)) {
        onKey(key);
      }
    });

    document.getElementById("btn-restart").addEventListener("click", function () {
      if (state.gameOver || confirm("Recommencer une nouvelle partie ? La partie en cours sera perdue.")) {
        newGame();
      }
    });
    document.getElementById("btn-help").addEventListener("click", function () {
      openModal("modal-help");
    });
    document.getElementById("btn-stats").addEventListener("click", function () {
      renderStats();
      openModal("modal-stats");
    });
    document.getElementById("btn-settings").addEventListener("click", function () {
      openModal("modal-settings");
    });
    document.getElementById("btn-new-game").addEventListener("click", newGame);
    document.getElementById("btn-play-again").addEventListener("click", newGame);
    document.getElementById("btn-reset-stats").addEventListener("click", function () {
      if (confirm("Réinitialiser toutes les statistiques ?")) {
        saveStats({ played: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0] });
        renderStats();
      }
    });
    document.getElementById("btn-share").addEventListener("click", function () {
      var text = shareText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast("Résultat copié !");
        }).catch(function () {
          showToast(text);
        });
      } else {
        showToast("Copie non disponible");
      }
    });

    document.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeAllModals();
      });
    });
    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeAllModals();
      });
    });

    document.getElementById("toggle-theme").addEventListener("change", function (e) {
      localStorage.setItem(STORAGE_THEME_KEY, e.target.checked ? "dark" : "light");
      applyTheme();
    });
    document.getElementById("toggle-hardmode").addEventListener("change", function (e) {
      localStorage.setItem(STORAGE_HARDMODE_KEY, e.target.checked ? "true" : "false");
    });
    document.getElementById("toggle-colorblind").addEventListener("change", function (e) {
      localStorage.setItem(STORAGE_COLORBLIND_KEY, e.target.checked ? "true" : "false");
      applyColorblind();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
