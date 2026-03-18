/* =============================================
   QUIZ RÉVISIONS — Logique principale
   ============================================= */

const STORAGE_KEY = 'quiz_scores';

// ---- État de l'application ----
let data       = null;   // données JSON complètes
let questions  = [];     // questions du chapitre actif (ordre mélangé)
let chapitreId = null;   // id du chapitre actif
let current    = 0;      // index de la question en cours
let score      = 0;      // score courant
let selected   = [];     // options sélectionnées par l'étudiant
let answered   = false;  // la question en cours a-t-elle été validée ?

// ---- Références DOM ----
const screens = {
  home:    document.getElementById('screen-home'),
  quiz:    document.getElementById('screen-quiz'),
  results: document.getElementById('screen-results'),
};

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
// ÉCRAN ACCUEIL
// =============================================
function initHome() {
  document.getElementById('home-matiere').textContent = data.matiere || 'Révisions';
  document.title = `Quiz — ${data.matiere}`;

  const grid   = document.getElementById('chapters-grid');
  const scores = getSavedScores();
  grid.innerHTML = '';

  data.chapitres.forEach((ch, idx) => {
    const total   = ch.questions.length;
    const isEmpty = total === 0;
    const saved   = scores[ch.id];

    const typesSet = new Set((ch.questions || []).map(q => q.type));
    const badges   = [...typesSet].map(t => {
      const cls = t === 'QCU' ? 'qcu' : t === 'QCM' ? 'qcm' : 'vf';
      return `<span class="mini-badge ${cls}">${t === 'VF' ? 'V/F' : t}</span>`;
    }).join('');

    const savedBadge = saved
      ? `<span class="chapter-saved-score">${saved.score}/${saved.total}</span>`
      : '';

    const card = document.createElement('div');
    card.className = 'chapter-card' + (isEmpty ? ' empty' : '');
    card.style.animationDelay = `${idx * 40}ms`;
    card.innerHTML = `
      ${savedBadge}
      <div class="chapter-num">Chapitre ${ch.id}</div>
      <div class="chapter-title">${stripChapterNum(ch.titre)}</div>
      <div class="chapter-meta">
        <span class="chapter-count">${isEmpty ? 'Aucune question' : `${total} question${total > 1 ? 's' : ''}`}</span>
        <div class="chapter-badges">${badges}</div>
      </div>
      <span class="chapter-arrow">›</span>`;

    if (!isEmpty) {
      card.addEventListener('click', () => startQuiz(ch.id));
    }
    grid.appendChild(card);
  });

  // Statistiques globales
  const totalQ = data.chapitres.reduce((s, c) => s + c.questions.length, 0);
  const doneChapters = Object.keys(scores).length;
  document.getElementById('footer-stats').textContent =
    `${totalQ} question${totalQ > 1 ? 's' : ''} au total · ${doneChapters} chapitre${doneChapters > 1 ? 's' : ''} complété${doneChapters > 1 ? 's' : ''}`;

  showScreen('home');
}

// =============================================
// ÉCRAN QUIZ
// =============================================
function startQuiz(chapId) {
  const chapitre = data.chapitres.find(c => c.id === chapId);
  if (!chapitre || !chapitre.questions.length) return;

  chapitreId = chapId;
  questions  = shuffle([...chapitre.questions]);
  current    = 0;
  score      = 0;

  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q       = questions[current];
  const total   = questions.length;
  answered      = false;
  selected      = [];

  // Barre de progression
  document.getElementById('progress-fill').style.width  = `${((current) / total) * 100}%`;
  document.getElementById('progress-label').textContent = `${current + 1} / ${total}`;
  document.getElementById('score-live').textContent     = `${score} pt${score > 1 ? 's' : ''}`;

  // Badge type
  const badgeEl = document.getElementById('q-badge');
  const typeMap  = { QCU: 'QCU', QCM: 'QCM', VF: 'V/F' };
  const clsMap   = { QCU: 'qcu', QCM: 'qcm', VF: 'vf' };
  badgeEl.textContent  = typeMap[q.type] || q.type;
  badgeEl.className    = `q-badge ${clsMap[q.type] || ''}`;

  document.getElementById('q-num').textContent     = `Question ${current + 1}`;
  document.getElementById('q-enonce').textContent  = q.enonce;
  document.getElementById('q-hint').textContent    = q.type === 'QCM' ? 'Plusieurs réponses possibles' : '';

  // Feedback (masqué)
  const fb = document.getElementById('q-feedback');
  fb.className = 'q-feedback';
  fb.textContent = '';

  // Boutons d'action
  document.getElementById('btn-validate').disabled = true;
  document.getElementById('btn-next').classList.add('hidden');

  // Construire les options
  const listEl = document.getElementById('options-list');
  listEl.innerHTML = '';

  if (q.type === 'VF') {
    ['Vrai', 'Faux'].forEach((label, i) => {
      listEl.appendChild(makeOption(i, label, q.type));
    });
  } else {
    (q.options || []).forEach((opt, i) => {
      listEl.appendChild(makeOption(i, opt, q.type));
    });
  }

  // Animation
  const wrap = document.getElementById('question-wrap');
  wrap.style.animation = 'none';
  void wrap.offsetWidth;
  wrap.style.animation = 'fadeUp 0.25s ease both';
}

function makeOption(index, text, type) {
  const btn = document.createElement('button');
  btn.className = 'option-btn';
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
    // QCU ou VF : sélection unique
    selected = [index];
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  } else {
    // QCM : sélection multiple
    const pos = selected.indexOf(index);
    if (pos === -1) {
      selected.push(index);
      btn.classList.add('selected');
    } else {
      selected.splice(pos, 1);
      btn.classList.remove('selected');
    }
  }
  document.getElementById('btn-validate').disabled = selected.length === 0;
}

function validate() {
  if (answered || selected.length === 0) return;
  answered = true;

  const q = questions[current];
  const correctIndexes = getCorrectIndexes(q);
  const isCorrect = arraysEqual(selected.sort(), correctIndexes.sort());

  if (isCorrect) score++;

  // Coloriser les options
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

  // Feedback
  const fb = document.getElementById('q-feedback');
  fb.className = `q-feedback ${isCorrect ? 'good' : 'bad'}`;
  const prefix = isCorrect ? '✓ Bonne réponse. ' : '✗ Mauvaise réponse. ';
  fb.textContent = prefix + (q.explication || '');

  // Progression
  const total = questions.length;
  document.getElementById('progress-fill').style.width = `${((current + 1) / total) * 100}%`;
  document.getElementById('score-live').textContent    = `${score} pt${score > 1 ? 's' : ''}`;

  // Boutons
  document.getElementById('btn-validate').disabled = true;
  const btnNext = document.getElementById('btn-next');
  btnNext.textContent = current < total - 1 ? 'Suivant →' : 'Voir les résultats →';
  btnNext.classList.remove('hidden');
}

function nextQuestion() {
  current++;
  if (current < questions.length) {
    renderQuestion();
  } else {
    showResults();
  }
}

// =============================================
// ÉCRAN RÉSULTATS
// =============================================
function showResults() {
  const chapitre = data.chapitres.find(c => c.id === chapitreId);
  const total    = questions.length;
  const pct      = Math.round((score / total) * 100);

  // Note sur 15 (arrondie à 2 décimales)
  const noteSur15 = (score / total * 15).toFixed(2);

  // Sauvegarde locale
  saveScore(chapitreId, score, total);

  const mention = pct >= 80 ? 'Excellent travail !'
                : pct >= 60 ? 'Bon résultat.'
                : pct >= 40 ? 'Des lacunes à combler.'
                :             'À retravailler.';

  document.getElementById('res-chapitre').textContent = chapitre ? chapitre.titre : '';
  document.getElementById('res-num').textContent      = score;
  document.getElementById('res-den').textContent      = `/ ${total}`;
  document.getElementById('res-pct').textContent      = `${pct} %`;
  document.getElementById('res-mention').textContent  = mention;

  // Couleur du cercle selon score
  const circle = document.getElementById('res-circle');
  const numEl  = document.getElementById('res-num');
  if (pct >= 60) {
    circle.style.borderColor = 'var(--c-success)';
    numEl.style.color = 'var(--c-success)';
  } else {
    circle.style.borderColor = 'var(--c-accent)';
    numEl.style.color = 'var(--c-accent)';
  }

  // Note sur 15 — bloc mis en avant
  const noteColor = pct >= 60 ? 'var(--c-success)' : pct >= 40 ? 'var(--c-warn)' : 'var(--c-error)';
  const noteBg    = pct >= 60 ? 'var(--c-success-bg)' : pct >= 40 ? 'var(--c-warn-bg)' : 'var(--c-error-bg)';
  const noteBd    = pct >= 60 ? 'var(--c-success-bd)' : pct >= 40 ? 'var(--c-warn-bd)' : 'var(--c-error-bd)';

  document.getElementById('res-note15').innerHTML =
    `<span style="font-size:0.8rem;color:var(--c-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Note sur 15</span>
     <span style="font-size:2.4rem;font-weight:700;color:${noteColor};line-height:1;">${noteSur15}</span>
     <span style="font-size:1rem;color:var(--c-muted);"> / 15</span>`;
  document.getElementById('res-note15').style.background = noteBg;
  document.getElementById('res-note15').style.border     = `1px solid ${noteBd}`;

  // Stats par type
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
// GESTION DES ÉCRANS
// =============================================
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// ÉCOUTEURS D'ÉVÉNEMENTS
// =============================================
document.getElementById('btn-back').addEventListener('click',    () => initHome());
document.getElementById('btn-validate').addEventListener('click', () => validate());
document.getElementById('btn-next').addEventListener('click',     () => nextQuestion());
document.getElementById('btn-retry').addEventListener('click',    () => startQuiz(chapitreId));
document.getElementById('btn-home').addEventListener('click',     () => initHome());

// =============================================
// UTILITAIRES
// =============================================

// Extraire les index corrects selon le type de question
function getCorrectIndexes(q) {
  if (q.type === 'VF') {
    return [q.correct === true ? 0 : 1];
  }
  return Array.isArray(q.correct) ? q.correct : [q.correct];
}

// Comparer deux tableaux triés
function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Mélange Fisher-Yates
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Retirer le préfixe "Chapitre N — " du titre pour l'affichage carte
function stripChapterNum(titre) {
  return titre.replace(/^Chapitre\s+\d+\s*[—–-]\s*/i, '');
}

// ---- Sauvegarde des scores (localStorage) ----
function getSavedScores() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveScore(chapId, s, total) {
  const scores = getSavedScores();
  const existing = scores[chapId];
  // Conserver le meilleur score
  if (!existing || s > existing.score) {
    scores[chapId] = { score: s, total };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }
}
