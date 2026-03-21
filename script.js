/* =============================================
   QUIZ RÉVISIONS — Logique principale v2
   Nouveautés : thèmes, modes (10/20/40 questions), timer 30s
   ============================================= */

const STORAGE_KEY = 'quiz_scores_v2';
const TIMER_DURATION = 30; // secondes

// ---- État de l'application ----
let data         = null;
let questions    = [];
let chapitreId   = null;
let currentMode  = 40;    // 10, 20 ou 40
let current      = 0;
let score        = 0;
let selected     = [];
let answered     = false;
let timerInterval = null;
let timeLeft      = TIMER_DURATION;

// ---- Références DOM ----
const screens = {
  home:    document.getElementById('screen-home'),
  mode:    document.getElementById('screen-mode'),
  quiz:    document.getElementById('screen-quiz'),
  results: document.getElementById('screen-results'),
};

// =============================================
// THÈMES — à adapter si votre JSON évolue
// =============================================
const THEMES = [
  {
    titre: "Thème 1 — Appréhender les fondements de l'activité économique",
    chapitres: [1, 2]
  },
  {
    titre: "Thème 2 — Comprendre le fonctionnement des marchés",
    chapitres: [3, 4]
  },
  {
    titre: "Thème 3 — Identifier les opérations de financement",
    chapitres: [5, 6]
  },
  {
    titre: "Thème 4 — Identifier les enjeux de la croissance économique",
    chapitres: [7, 8, 9]
  },
  {
    titre: "Thème 5 — Analyser la régulation publique",
    chapitres: [10, 11, 12]
  },
  {
    titre: "Thème 6 — Analyser les déséquilibres sociaux et leur régulation",
    chapitres: [13, 14, 15]
  },
  {
    titre: "Thème 7 — Identifier les effets et les enjeux de la mondialisation des économies",
    chapitres: [16, 17, 18]
  }
];

// =============================================
// CHARGEMENT DES DONNÉES
// =============================================
fetch('data/questions.json')
  .then(r => { if (!r.ok) throw new Error('Impossible de charger questions.json'); return r.json(); })
  .then(json => { data = json; initHome(); })
  .catch(err => {
    document.body.innerHTML = `<div style="padding:3rem;font-family:sans-serif;color:#B91C1C;">
      <strong>Erreur de chargement :</strong> ${err.message}<br><br>
      Vérifiez que le fichier <code>data/questions.json</code> existe et est valide.
    </div>`;
  });

// =============================================
// ÉCRAN ACCUEIL — avec regroupement par thème
// =============================================
function initHome() {
  document.getElementById('home-matiere').textContent = data.matiere || 'Révisions';
  document.title = `Quiz — ${data.matiere}`;

  const container = document.getElementById('themes-list');
  const scores    = getSavedScores();
  container.innerHTML = '';

  // Construire un map id → chapitre
  const chapMap = {};
  data.chapitres.forEach(ch => { chapMap[ch.id] = ch; });

  THEMES.forEach((theme, tIdx) => {
    // Bloc thème
    const themeEl = document.createElement('div');
    themeEl.className = 'theme-block';
    themeEl.style.animationDelay = `${tIdx * 60}ms`;

    const themeHeader = document.createElement('div');
    themeHeader.className = 'theme-header';
    themeHeader.textContent = theme.titre;
    themeEl.appendChild(themeHeader);

    const grid = document.createElement('div');
    grid.className = 'chapters-grid';

    theme.chapitres.forEach((chapId, idx) => {
      const ch = chapMap[chapId];
      if (!ch) return;

      const total   = ch.questions.length;
      const isEmpty = total === 0;
      const saved   = scores[ch.id];

      const typesSet = new Set((ch.questions || []).map(q => q.type));
      const badges   = [...typesSet].map(t => {
        const cls = t === 'QCU' ? 'qcu' : t === 'QCM' ? 'qcm' : 'vf';
        return `<span class="mini-badge ${cls}">${t === 'VF' ? 'V/F' : t}</span>`;
      }).join('');

      // Meilleur score par mode
      let savedBadgesHtml = '';
      if (saved) {
        savedBadgesHtml = Object.entries(saved).map(([mode, s]) =>
          `<span class="chapter-saved-score">${mode}q : ${s.score}/${s.total}</span>`
        ).join('');
      }

      const card = document.createElement('div');
      card.className = 'chapter-card' + (isEmpty ? ' empty' : '');
      card.style.animationDelay = `${(tIdx * 3 + idx) * 40}ms`;
      card.innerHTML = `
        <div class="chapter-saved-scores">${savedBadgesHtml}</div>
        <div class="chapter-num">Chapitre ${ch.id}</div>
        <div class="chapter-title">${stripChapterNum(ch.titre)}</div>
        <div class="chapter-meta">
          <span class="chapter-count">${isEmpty ? 'Aucune question' : `${total} question${total > 1 ? 's' : ''}`}</span>
          <div class="chapter-badges">${badges}</div>
        </div>
        <span class="chapter-arrow">›</span>`;

      if (!isEmpty) {
        card.addEventListener('click', () => showModeScreen(ch.id));
      }
      grid.appendChild(card);
    });

    themeEl.appendChild(grid);
    container.appendChild(themeEl);
  });

  // Chapitres sans thème
  const assignedIds = new Set(THEMES.flatMap(t => t.chapitres));
  const orphans = data.chapitres.filter(ch => !assignedIds.has(ch.id) && ch.questions.length > 0);
  if (orphans.length > 0) {
    const themeEl = document.createElement('div');
    themeEl.className = 'theme-block';
    const themeHeader = document.createElement('div');
    themeHeader.className = 'theme-header';
    themeHeader.textContent = 'Autres chapitres';
    themeEl.appendChild(themeHeader);
    const grid = document.createElement('div');
    grid.className = 'chapters-grid';
    orphans.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'chapter-card';
      card.innerHTML = `<div class="chapter-num">Chapitre ${ch.id}</div>
        <div class="chapter-title">${stripChapterNum(ch.titre)}</div>
        <span class="chapter-arrow">›</span>`;
      card.addEventListener('click', () => showModeScreen(ch.id));
      grid.appendChild(card);
    });
    themeEl.appendChild(grid);
    container.appendChild(themeEl);
  }

  // Statistiques globales
  const totalQ = data.chapitres.reduce((s, c) => s + c.questions.length, 0);
  const doneChapters = Object.keys(scores).length;
  document.getElementById('footer-stats').textContent =
    `${totalQ} question${totalQ > 1 ? 's' : ''} au total · ${doneChapters} chapitre${doneChapters > 1 ? 's' : ''} complété${doneChapters > 1 ? 's' : ''}`;

  showScreen('home');
}

// =============================================
// ÉCRAN SÉLECTION DU MODE
// =============================================
function showModeScreen(chapId) {
  const chapitre = data.chapitres.find(c => c.id === chapId);
  if (!chapitre) return;
  chapitreId = chapId;

  document.getElementById('mode-chapitre-label').textContent = chapitre.titre;

  const total   = chapitre.questions.length;
  const scores  = getSavedScores();
  const saved   = scores[chapId] || {};

  const modes = [10, 20, 40];
  const modeLabels = {
    10: { label: 'Quiz rapide',    desc: '10 questions · ~5 min', icon: '⚡' },
    20: { label: 'Quiz moyen',     desc: '20 questions · ~10 min', icon: '📘' },
    40: { label: 'Quiz complet',   desc: '40 questions · ~20 min', icon: '🎓' },
  };

  const container = document.getElementById('mode-options');
  container.innerHTML = '';

  modes.forEach(n => {
    const available = total >= n;
    const s = saved[n];
    const btn = document.createElement('button');
    btn.className = 'mode-option' + (available ? '' : ' mode-disabled');

    const savedHtml = s
      ? `<span class="mode-saved">Meilleur : ${s.score}/${s.total}</span>`
      : '';

    btn.innerHTML = `
      <span class="mode-icon">${modeLabels[n].icon}</span>
      <span class="mode-info">
        <span class="mode-label">${modeLabels[n].label}</span>
        <span class="mode-desc">${available ? modeLabels[n].desc : `Nécessite ${n} questions (${total} disponibles)`}</span>
        ${savedHtml}
      </span>
      <span class="mode-arrow">›</span>`;

    if (available) {
      btn.addEventListener('click', () => startQuiz(chapId, n));
    }
    container.appendChild(btn);
  });

  showScreen('mode');
}

// =============================================
// ÉCRAN QUIZ
// =============================================
function startQuiz(chapId, mode) {
  const chapitre = data.chapitres.find(c => c.id === chapId);
  if (!chapitre || !chapitre.questions.length) return;

  chapitreId  = chapId;
  currentMode = mode;
  questions   = shuffle([...chapitre.questions]).slice(0, mode);
  current     = 0;
  score       = 0;

  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q     = questions[current];
  const total = questions.length;
  answered    = false;
  selected    = [];

  // Barre de progression
  document.getElementById('progress-fill').style.width  = `${(current / total) * 100}%`;
  document.getElementById('progress-label').textContent = `${current + 1} / ${total}`;
  document.getElementById('score-live').textContent     = `${score} pt${score > 1 ? 's' : ''}`;

  // Badge type
  const badgeEl = document.getElementById('q-badge');
  const typeMap = { QCU: 'QCU', QCM: 'QCM', VF: 'V/F' };
  const clsMap  = { QCU: 'qcu', QCM: 'qcm', VF: 'vf' };
  badgeEl.textContent = typeMap[q.type] || q.type;
  badgeEl.className   = `q-badge ${clsMap[q.type] || ''}`;

  document.getElementById('q-num').textContent    = `Question ${current + 1}`;
  document.getElementById('q-enonce').textContent = q.enonce;
  document.getElementById('q-hint').textContent   = q.type === 'QCM' ? 'Plusieurs réponses possibles' : '';

  // Feedback (masqué)
  const fb = document.getElementById('q-feedback');
  fb.className   = 'q-feedback';
  fb.textContent = '';

  // Boutons
  document.getElementById('btn-validate').disabled = true;
  document.getElementById('btn-next').classList.add('hidden');

  // Options
  const listEl = document.getElementById('options-list');
  listEl.innerHTML = '';
  if (q.type === 'VF') {
    ['Vrai', 'Faux'].forEach((label, i) => listEl.appendChild(makeOption(i, label, q.type)));
  } else {
    (q.options || []).forEach((opt, i) => listEl.appendChild(makeOption(i, opt, q.type)));
  }

  // Animation
  const wrap = document.getElementById('question-wrap');
  wrap.style.animation = 'none';
  void wrap.offsetWidth;
  wrap.style.animation = 'fadeUp 0.25s ease both';

  // Timer
  startTimer();
}

function makeOption(index, text, type) {
  const btn = document.createElement('button');
  btn.className     = 'option-btn';
  btn.dataset.index = index;
  const letter = type === 'VF' ? (index === 0 ? 'V' : 'F') : ['A','B','C','D','E'][index];
  btn.innerHTML = `<span class="opt-letter">${letter}</span><span>${text}</span>`;
  btn.addEventListener('click', () => toggleOption(index, type, btn));
  return btn;
}

function toggleOption(index, type, btn) {
  if (answered) return;
  const isQCM = type === 'QCM';
  if (!isQCM) {
    selected = [index];
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  } else {
    const pos = selected.indexOf(index);
    if (pos === -1) { selected.push(index); btn.classList.add('selected'); }
    else            { selected.splice(pos, 1); btn.classList.remove('selected'); }
  }
  document.getElementById('btn-validate').disabled = selected.length === 0;
}

function validate() {
  if (answered || selected.length === 0) return;
  answered = true;
  stopTimer();

  const q = questions[current];
  const correctIndexes = getCorrectIndexes(q);
  const isCorrect = arraysEqual(selected.sort(), correctIndexes.sort());
  if (isCorrect) score++;

  document.querySelectorAll('.option-btn').forEach(btn => {
    const idx = parseInt(btn.dataset.index);
    btn.disabled = true;
    btn.classList.remove('selected');
    if (correctIndexes.includes(idx)) {
      btn.classList.add('correct');
      btn.querySelector('.opt-letter').textContent = '✓';
    } else if (selected.includes(idx)) {
      btn.classList.add('wrong');
      btn.querySelector('.opt-letter').textContent = '✕';
    }
  });

  const fb = document.getElementById('q-feedback');
  fb.className   = `q-feedback ${isCorrect ? 'good' : 'bad'}`;
  fb.textContent = (isCorrect ? '✓ Bonne réponse. ' : '✗ Mauvaise réponse. ') + (q.explication || '');

  const total = questions.length;
  document.getElementById('progress-fill').style.width = `${((current + 1) / total) * 100}%`;
  document.getElementById('score-live').textContent    = `${score} pt${score > 1 ? 's' : ''}`;

  document.getElementById('btn-validate').disabled = true;
  const btnNext = document.getElementById('btn-next');
  btnNext.textContent = current < total - 1 ? 'Suivant →' : 'Voir les résultats →';
  btnNext.classList.remove('hidden');
}

function nextQuestion() {
  current++;
  if (current < questions.length) renderQuestion();
  else showResults();
}

// =============================================
// TIMER
// =============================================
function startTimer() {
  stopTimer();
  timeLeft = TIMER_DURATION;
  updateTimerDisplay();

  const timerEl = document.getElementById('quiz-timer');
  timerEl.className = 'quiz-timer';

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 10) timerEl.classList.add('timer-warning');
    if (timeLeft <= 5)  timerEl.classList.add('timer-danger');

    if (timeLeft <= 0) {
      stopTimer();
      timeExpired();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  document.getElementById('timer-display').textContent = timeLeft;
}

function timeExpired() {
  if (answered) return;
  answered = true;

  const q = questions[current];
  const correctIndexes = getCorrectIndexes(q);

  document.querySelectorAll('.option-btn').forEach(btn => {
    const idx = parseInt(btn.dataset.index);
    btn.disabled = true;
    if (correctIndexes.includes(idx)) {
      btn.classList.add('correct');
      btn.querySelector('.opt-letter').textContent = '✓';
    }
  });

  const fb = document.getElementById('q-feedback');
  fb.className   = 'q-feedback bad';
  fb.textContent = '⏱ Temps écoulé ! ' + (q.explication || '');

  document.getElementById('btn-validate').disabled = true;
  const btnNext = document.getElementById('btn-next');
  btnNext.textContent = current < questions.length - 1 ? 'Suivant →' : 'Voir les résultats →';
  btnNext.classList.remove('hidden');

  const timerEl = document.getElementById('quiz-timer');
  timerEl.className = 'quiz-timer timer-expired';
}

// =============================================
// ÉCRAN RÉSULTATS
// =============================================
function showResults() {
  stopTimer();
  const chapitre = data.chapitres.find(c => c.id === chapitreId);
  const total    = questions.length;
  const pct      = Math.round((score / total) * 100);
  const noteSur15 = (score / total * 15).toFixed(2);

  saveScore(chapitreId, currentMode, score, total);

  const mention = pct >= 80 ? 'Excellent travail !'
                : pct >= 60 ? 'Bon résultat.'
                : pct >= 40 ? 'Des lacunes à combler.'
                :             'À retravailler.';

  document.getElementById('res-chapitre').textContent = chapitre
    ? `${chapitre.titre} · ${currentMode} questions`
    : '';
  document.getElementById('res-num').textContent  = score;
  document.getElementById('res-den').textContent  = `/ ${total}`;
  document.getElementById('res-pct').textContent  = `${pct} %`;
  document.getElementById('res-mention').textContent = mention;

  const circle = document.getElementById('res-circle');
  const numEl  = document.getElementById('res-num');
  if (pct >= 60) {
    circle.style.borderColor = 'var(--c-success)';
    numEl.style.color = 'var(--c-success)';
  } else {
    circle.style.borderColor = 'var(--c-accent)';
    numEl.style.color = 'var(--c-accent)';
  }

  const noteColor = pct >= 60 ? 'var(--c-success)' : pct >= 40 ? 'var(--c-warn)' : 'var(--c-error)';
  const noteBg    = pct >= 60 ? 'var(--c-success-bg)' : pct >= 40 ? 'var(--c-warn-bg)' : 'var(--c-error-bg)';
  const noteBd    = pct >= 60 ? 'var(--c-success-bd)' : pct >= 40 ? 'var(--c-warn-bd)' : 'var(--c-error-bd)';

  document.getElementById('res-note15').innerHTML =
    `<span style="font-size:0.8rem;color:var(--c-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Note sur 15</span>
     <span style="font-size:2.4rem;font-weight:700;color:${noteColor};line-height:1;">${noteSur15}</span>
     <span style="font-size:1rem;color:var(--c-muted);"> / 15</span>`;
  document.getElementById('res-note15').style.background = noteBg;
  document.getElementById('res-note15').style.border     = `1px solid ${noteBd}`;

  const typeLabels = { QCU: 'QCU', QCM: 'QCM', VF: 'V/F' };
  const typeTotals = {};
  questions.forEach(q => { typeTotals[q.type] = (typeTotals[q.type] || 0) + 1; });

  const statsEl = document.getElementById('res-stats');
  statsEl.innerHTML = Object.keys(typeTotals).map(t => `
    <div class="stat-box">
      <div class="stat-val">${typeTotals[t]}</div>
      <div class="stat-lbl">${typeLabels[t] || t}</div>
    </div>`).join('') + `
    <div class="stat-box">
      <div class="stat-val">${score}</div>
      <div class="stat-lbl">Bonnes rép.</div>
    </div>`;

  showScreen('results');
}

// =============================================
// NAVIGATION
// =============================================
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// ÉVÉNEMENTS
// =============================================
document.getElementById('btn-back').addEventListener('click',      () => { stopTimer(); initHome(); });
document.getElementById('btn-mode-back').addEventListener('click', () => initHome());
document.getElementById('btn-validate').addEventListener('click',  () => validate());
document.getElementById('btn-next').addEventListener('click',      () => nextQuestion());
document.getElementById('btn-retry').addEventListener('click',     () => startQuiz(chapitreId, currentMode));
document.getElementById('btn-change-mode').addEventListener('click', () => showModeScreen(chapitreId));
document.getElementById('btn-home').addEventListener('click',      () => initHome());

// =============================================
// UTILITAIRES
// =============================================
function getCorrectIndexes(q) {
  if (q.type === 'VF') return [q.correct === true ? 0 : 1];
  return Array.isArray(q.correct) ? q.correct : [q.correct];
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function stripChapterNum(titre) {
  return titre.replace(/^Chapitre\s+\d+\s*[—–-]\s*/i, '');
}

// ---- Sauvegarde des scores — indexés par mode ----
function getSavedScores() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveScore(chapId, mode, s, total) {
  const scores  = getSavedScores();
  if (!scores[chapId]) scores[chapId] = {};
  const existing = scores[chapId][mode];
  if (!existing || s > existing.score) {
    scores[chapId][mode] = { score: s, total };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }
}
