(() => {
  'use strict';

  // ---------- Timings ----------
  // Durée de l'animation de flip définie dans styles.css (.card-inner transition).
  const FLIP_DURATION = 450;
  // Délai avant l'apparition du liseré rouge, une fois la 2e carte bien retournée.
  const WRONG_RING_DELAY = FLIP_DURATION;
  // Délai avant que la 1re carte se remette face cachée (après l'apparition du liseré).
  const MISMATCH_FIRST_HIDE_DELAY = 700;
  // Délai supplémentaire avant que la 2e carte se remette face cachée.
  const MISMATCH_SECOND_HIDE_EXTRA_DELAY = 1000;

  // ---------- Taille des cartes ----------
  // Bornes de la taille d'une carte, pour que la grille entière tienne
  // toujours à l'écran (desktop, tablette, mobile) sans jamais scroller.
  const MIN_CARD_SIZE = 34;
  const MAX_CARD_SIZE = 150;

  // ---------- Levels config ----------
  // Chaque niveau pointe vers les images recadrées dans assets/cards/levelX.
  // La sélection des cartes par niveau est manuelle (fichiers triés à la main
  // dans assets/cards/levelX/ depuis assets/cards/all28/) : les numéros ne sont
  // donc pas forcément contigus, d'où la liste explicite plutôt qu'un Array.from.
  function cardList(level, numbers) {
    return numbers.map((n) => `assets/cards/level${level}/card-${String(n).padStart(2, '0')}.png`);
  }

  const LEVELS = [
    {
      id: 1,
      label: 'Niveau 1 · Facile',
      shortLabel: 'Facile',
      color: '#029ADB',
      textOnActive: '#10151B',
      images: cardList(1, [2, 4, 5, 6, 10, 14, 15, 20, 22, 27]),
    },
    {
      id: 2,
      label: 'Niveau 2 · Moyen',
      shortLabel: 'Moyen',
      color: '#019A46',
      textOnActive: '#10151B',
      images: cardList(2, [1, 2, 4, 5, 6, 8, 10, 11, 14, 15, 17, 19, 20, 22, 23, 25, 27, 28]),
    },
    {
      id: 3,
      label: 'Niveau 3 · Difficile',
      shortLabel: 'Difficile',
      color: '#0E4793',
      textOnActive: '#FFFFFF',
      images: Array.from({ length: 28 }, (_, i) => `assets/cards/level3/card-${String(i + 1).padStart(2, '0')}.png`),
    },
  ];

  // ---------- Classement en ligne (Supabase) ----------
  // Renseigne ces deux valeurs avec celles de ton projet Supabase
  // (Dashboard > Settings > API). La clé "anon public" est faite pour être
  // exposée côté client : les règles RLS côté serveur limitent ce qu'elle
  // peut faire (lecture publique, insertion contrainte, jamais de modif/suppr).
  const SUPABASE_URL = 'https://sgzrjagbcmzeizvglsin.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnenJqYWdiY216ZWl6dmdsc2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDkyMjgsImV4cCI6MjEwODU4NTIyOH0.a_9ZPaZ7EPPpGXETU9cS02FO8Is6lS3jkiykJTD0BN8';
  const LEADERBOARD_SIZE = 10;

  const isSupabaseConfigured = /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;
  const supabaseClient = isSupabaseConfigured && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // ---------- Suivi des parties jouées (Supabase) ----------
  // Contrairement à `scores` (qui ne garde que les scores entrant dans le top
  // 10), `game_plays` enregistre CHAQUE partie terminée, pour pouvoir compter
  // le nombre de parties jouées et un nombre de "joueurs uniques" approximatif.
  // L'identifiant est anonyme (aucune donnée perso), généré une fois par
  // navigateur et stocké en localStorage : il identifie un appareil/navigateur,
  // pas une personne (se réinitialise en navigation privée, autre navigateur,
  // autre appareil, ou si le joueur vide son stockage local).
  const PLAYER_ID_STORAGE_KEY = 'memorygame:playerId';

  function getOrCreatePlayerId() {
    try {
      let id = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
      if (!id) {
        id = (window.crypto && window.crypto.randomUUID)
          ? window.crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        localStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
      }
      return id;
    } catch {
      return null; // Stockage indisponible (navigation privée stricte, etc.).
    }
  }

  // Best-effort : un souci réseau ou de config ne doit jamais empêcher
  // d'afficher la modale de victoire, donc on avale les erreurs ici.
  async function recordGamePlayed(levelId, score, moves, timeSeconds) {
    if (!isSupabaseConfigured) return;
    const playerId = getOrCreatePlayerId();
    if (!playerId) return;
    try {
      await supabaseClient.from('game_plays').insert({
        player_id: playerId,
        level_id: levelId,
        score,
        moves,
        time_seconds: timeSeconds,
      });
    } catch {
      // Le suivi est un bonus, pas une fonctionnalité critique : on ignore.
    }
  }

  // ---------- DOM refs ----------
  const main = document.querySelector('.main');
  const levelsNav = document.getElementById('levels');
  const board = document.getElementById('board');
  const emptyState = document.getElementById('emptyState');
  const levelInfo = document.getElementById('levelInfo');
  const timerEl = document.getElementById('timer');
  const movesEl = document.getElementById('moves');
  const starsEl = document.getElementById('stars');
  const pointsEl = document.getElementById('points');
  const newGameBtn = document.getElementById('newGameBtn');
  const leaderboardBtn = document.getElementById('leaderboardBtn');

  const leaderboardModal = document.getElementById('leaderboardModal');
  const leaderboardLevelsNav = document.getElementById('leaderboardLevels');
  const leaderboardLevelLabel = document.getElementById('leaderboardLevelLabel');
  const leaderboardBoardList = document.getElementById('leaderboardBoardList');
  const leaderboardBoardStatus = document.getElementById('leaderboardBoardStatus');
  const leaderboardCloseBtn = document.getElementById('leaderboardCloseBtn');

  const winModal = document.getElementById('winModal');
  const modalTime = document.getElementById('modalTime');
  const modalMoves = document.getElementById('modalMoves');
  const modalStars = document.getElementById('modalStars');
  const modalPoints = document.getElementById('modalPoints');
  const modalRecord = document.getElementById('modalRecord');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalReplayBtn = document.getElementById('modalReplayBtn');
  const boardLevelLabel = document.getElementById('boardLevelLabel');
  const boardList = document.getElementById('boardList');
  const boardStatus = document.getElementById('boardStatus');
  const boardOutsideEntry = document.getElementById('boardOutsideEntry');

  // ---------- State ----------
  let currentLevelId = LEVELS.find((l) => l.images.length > 0)?.id ?? LEVELS[0].id;
  let deck = [];
  let flipped = [];
  let matchedCount = 0;
  let attempts = 0;
  let mismatches = 0;
  let locked = false;
  let timerSeconds = 0;
  let timerHandle = null;
  let gameStarted = false;
  // Paire fautive en attente de retournement (pour le fast-forward).
  let pendingMismatch = null;
  // Niveau affiché dans la modale "Classement" (ouvrable sans finir de partie,
  // donc distinct du niveau en cours de jeu currentLevelId).
  let currentLeaderboardLevelId = currentLevelId;

  function currentLevel() {
    return LEVELS.find((l) => l.id === currentLevelId);
  }

  function findLevel(id) {
    return LEVELS.find((l) => l.id === id);
  }

  // ---------- Utils ----------
  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function starMarkup(count) {
    const filled = '★'.repeat(count);
    const empty = '☆'.repeat(3 - count);
    return `<span class="filled">${filled}</span><span class="empty">${empty}</span>`;
  }

  function computeStars() {
    if (attempts === 0) return 0;
    const pairs = deck.length / 2;
    const efficiency = pairs / attempts;
    if (efficiency >= 0.9) return 3;
    if (efficiency >= 0.6) return 2;
    return 1;
  }

  function computeScore() {
    return Math.max(0, matchedCount * 100 - mismatches * 3);
  }

  // ---------- Records (meilleur score / moins de coups, par niveau) ----------
  const BEST_STORAGE_PREFIX = 'memorygame:best:';

  function getBest(levelId) {
    try {
      const raw = localStorage.getItem(BEST_STORAGE_PREFIX + levelId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveBest(levelId, best) {
    try {
      localStorage.setItem(BEST_STORAGE_PREFIX + levelId, JSON.stringify(best));
    } catch {
      // Stockage indisponible (navigation privée, etc.) : on continue sans persister.
    }
  }

  // ---------- Timer ----------
  function startTimer() {
    if (timerHandle) return;
    timerHandle = setInterval(() => {
      timerSeconds += 1;
      timerEl.textContent = formatTime(timerSeconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
  }

  function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    timerEl.textContent = formatTime(0);
  }

  // ---------- Rendering: level tabs ----------
  function renderLevelTabs() {
    levelsNav.innerHTML = '';
    LEVELS.forEach((level) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-btn';
      btn.style.setProperty('--level-color', level.color);
      btn.style.setProperty('--level-text-on-active', level.textOnActive);

      const isActive = level.id === currentLevelId;
      const isDisabled = level.images.length === 0;

      btn.setAttribute('aria-pressed', String(isActive));
      btn.disabled = isDisabled;
      btn.title = isDisabled ? 'Ajoute des images dans assets/cards/level3 pour débloquer ce niveau' : '';

      btn.innerHTML = `<span class="level-btn__full">${level.label}</span><span class="level-btn__short">${level.shortLabel}</span>`
        + (isDisabled ? '<span class="level-btn__tag">Bientôt</span>' : '');

      btn.addEventListener('click', () => {
        if (currentLevelId === level.id) return;
        currentLevelId = level.id;
        startLevel();
      });

      levelsNav.appendChild(btn);
    });
  }

  // ---------- Rendering: stats ----------
  function renderStats() {
    starsEl.innerHTML = starMarkup(computeStars());
    pointsEl.textContent = String(computeScore());
    movesEl.textContent = String(attempts);
  }

  // ---------- Game setup ----------
  function buildDeck(level) {
    const pairs = level.images.map((src, i) => ({ value: i, src }));
    const doubled = shuffle([...pairs, ...pairs]).map((card, idx) => ({
      ...card,
      id: idx,
    }));
    return doubled;
  }

  function startLevel() {
    const level = currentLevel();
    renderLevelTabs();

    if (pendingMismatch) {
      pendingMismatch.timeouts.forEach(window.clearTimeout);
      pendingMismatch = null;
    }

    flipped = [];
    matchedCount = 0;
    attempts = 0;
    mismatches = 0;
    locked = false;
    gameStarted = false;
    resetTimer();
    renderStats();

    if (level.images.length === 0) {
      board.hidden = true;
      emptyState.hidden = false;
      levelInfo.textContent = `${level.label} — bientôt disponible`;
      return;
    }

    board.hidden = false;
    emptyState.hidden = true;

    deck = buildDeck(level);

    renderBoard();
    fitBoard();
  }

  function renderBoard() {
    board.innerHTML = '';
    deck.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.id = String(card.id);

      cardEl.innerHTML = `
        <div class="card-inner">
          <div class="face face--back">
            <img src="assets/cards/card-back.png" alt="" class="face--back__img">
          </div>
          <div class="face face--front">
            <img src="${card.src}" alt="Carte mémoire" loading="lazy">
          </div>
        </div>
      `;

      cardEl.tabIndex = 0;
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('aria-label', 'Carte mémoire, face cachée');
      cardEl.setAttribute('aria-pressed', 'false');

      cardEl.addEventListener('click', () => onCardClick(card.id, cardEl));
      cardEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        e.preventDefault();
        onCardClick(card.id, cardEl);
      });
      board.appendChild(cardEl);
    });
  }

  // Parmi toutes les grilles cols×rows possibles pour `count` cartes (en
  // évitant les formes trop étirées type 1×N), renvoie celle qui permet
  // d'avoir les plus grosses cartes dans l'espace dispo (availWidth × availHeight).
  // C'est ce qui permet par ex. au niveau 2 de passer d'une grille 6×6 à une
  // grille plus large et moins haute (9×4) sur un écran large, avec des
  // cartes bien plus grosses, plutôt qu'une forme carrée figée.
  const GRID_MIN_RATIO = 0.4; // cols/rows : pas trop haut
  const GRID_MAX_RATIO = 2.6; // cols/rows : pas trop large

  // allowPartialLastRow : uniquement pour le niveau 3 (56 cartes = peu de
  // diviseurs exacts, seulement 7×8/8×7 sinon). Autorise une dernière ligne
  // pas totalement remplie pour avoir beaucoup plus de formes cols×rows
  // candidates, et donc mieux coller à l'espace dispo (large sur desktop,
  // haut sur mobile) sans scroll. Niveaux 1 et 2 gardent le comportement
  // d'origine (diviseurs exacts uniquement) inchangé.
  function bestGridShape(count, availWidth, availHeight, gap, allowPartialLastRow) {
    const candidates = [];
    for (let cols = 2; cols < count; cols++) {
      let rows;
      if (allowPartialLastRow) {
        rows = Math.ceil(count / cols);
      } else {
        if (count % cols !== 0) continue;
        rows = count / cols;
      }
      if (rows < 2) continue;
      const ratio = cols / rows;
      if (ratio < GRID_MIN_RATIO || ratio > GRID_MAX_RATIO) continue;
      candidates.push({ cols, rows });
    }
    if (candidates.length === 0) {
      // Repli (ex. nombre de cartes avec peu de diviseurs) : grille la plus carrée possible.
      const cols = Math.round(Math.sqrt(count));
      candidates.push({ cols, rows: Math.ceil(count / cols) });
    }

    let best = null;
    for (const { cols, rows } of candidates) {
      const cardFromWidth = (availWidth - gap * (cols - 1)) / cols;
      const cardFromHeight = (availHeight - gap * (rows - 1)) / rows;
      const size = Math.min(cardFromWidth, cardFromHeight);
      if (!best || size > best.size) best = { cols, rows, size };
    }
    return best;
  }

  // Calcule la forme de grille et la taille de carte qui remplissent le mieux
  // l'espace dispo (largeur ET hauteur), pour ne jamais avoir besoin de scroller.
  function fitBoard() {
    const level = currentLevel();
    if (level.images.length === 0) return;

    const mainStyles = getComputedStyle(main);
    const paddingX = parseFloat(mainStyles.paddingLeft) + parseFloat(mainStyles.paddingRight);
    const paddingY = parseFloat(mainStyles.paddingTop) + parseFloat(mainStyles.paddingBottom);
    const mainGap = parseFloat(mainStyles.rowGap) || 0;

    const availWidth = main.clientWidth - paddingX;
    const availHeight = main.clientHeight - paddingY - levelInfo.getBoundingClientRect().height - mainGap;

    const boardGap = parseFloat(getComputedStyle(board).columnGap) || 0;

    const shape = bestGridShape(deck.length, availWidth, availHeight, boardGap, false);

    let cardSize = Math.floor(shape.size);
    cardSize = Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, cardSize));

    // Le plateau est en flexbox (flex-wrap + justify-content: center), pas en
    // grid : chaque carte a une taille fixe (--card-size) et la largeur du
    // plateau est calée pile sur `shape.cols` cartes, pour que le flex-wrap
    // coupe au bon endroit. Avantage sur une grid : une dernière ligne
    // incomplète (niveau 3) se retrouve centrée au lieu d'être collée à gauche.
    board.style.setProperty('--card-size', `${cardSize}px`);
    board.style.width = `${shape.cols * cardSize + (shape.cols - 1) * boardGap}px`;

    levelInfo.textContent = `${level.label} — grille ${shape.cols}×${shape.rows} (${level.images.length} paires)`;
  }

  // Reflète l'état visuel (retournée / trouvée) d'une carte pour les
  // lecteurs d'écran et la navigation clavier.
  function syncCardAria(el) {
    const isMatched = el.classList.contains('is-matched');
    const isFlipped = isMatched || el.classList.contains('is-flipped');
    el.setAttribute('aria-pressed', String(isFlipped));
    el.setAttribute('aria-label', isMatched
      ? 'Carte mémoire, trouvée'
      : (isFlipped ? 'Carte mémoire, retournée' : 'Carte mémoire, face cachée'));
    el.tabIndex = isMatched ? -1 : 0;
  }

  // Enchaîner plus vite : si deux cartes fautives sont encore affichées et que
  // le joueur clique sur une autre carte face cachée, on accélère leur retour
  // face cachée au lieu de le forcer à attendre la fin de l'animation normale.
  function fastForwardPendingMismatch() {
    const { a, b, timeouts } = pendingMismatch;
    timeouts.forEach(window.clearTimeout);

    a.el.classList.add('is-quick-hide');
    b.el.classList.add('is-quick-hide');
    a.el.classList.remove('is-flipped', 'is-active', 'is-wrong');
    b.el.classList.remove('is-flipped', 'is-active', 'is-wrong');
    syncCardAria(a.el);
    syncCardAria(b.el);
    window.setTimeout(() => {
      a.el.classList.remove('is-quick-hide');
      b.el.classList.remove('is-quick-hide');
    }, 200);

    pendingMismatch = null;
    flipped = [];
    locked = false;
  }

  function onCardClick(id, cardEl) {
    if (locked) {
      const canFastForward = pendingMismatch
        && cardEl !== pendingMismatch.a.el
        && cardEl !== pendingMismatch.b.el
        && !cardEl.classList.contains('is-flipped')
        && !cardEl.classList.contains('is-matched');
      if (!canFastForward) return;
      fastForwardPendingMismatch();
    }

    if (cardEl.classList.contains('is-flipped') || cardEl.classList.contains('is-matched')) return;
    if (flipped.length === 2) return;

    if (!gameStarted) {
      gameStarted = true;
      startTimer();
    }

    cardEl.classList.add('is-flipped', 'is-active');
    syncCardAria(cardEl);
    flipped.push({ id, el: cardEl, card: deck.find((c) => c.id === id) });

    if (flipped.length === 2) {
      attempts += 1;
      locked = true;
      const [a, b] = flipped;

      if (a.card.value === b.card.value) {
        window.setTimeout(() => {
          a.el.classList.remove('is-active');
          b.el.classList.remove('is-active');
          a.el.classList.add('is-matched', 'is-disabled');
          b.el.classList.add('is-matched', 'is-disabled');
          syncCardAria(a.el);
          syncCardAria(b.el);
          matchedCount += 1;
          renderStats();
          flipped = [];
          locked = false;
          checkWin();
        }, 350);
      } else {
        mismatches += 1;
        renderStats();

        // La carte se retourne d'abord (déjà fait ci-dessus) ; le liseré rouge
        // n'arrive qu'une fois qu'elle est bien visible, pas au moment du flip.
        const ringTimeout = window.setTimeout(() => {
          a.el.classList.add('is-wrong');
          b.el.classList.add('is-wrong');
        }, WRONG_RING_DELAY);

        // La 2e carte retournée reste visible une seconde de plus que la 1re.
        const hideATimeout = window.setTimeout(() => {
          a.el.classList.remove('is-flipped', 'is-active', 'is-wrong');
          syncCardAria(a.el);
        }, WRONG_RING_DELAY + MISMATCH_FIRST_HIDE_DELAY);

        const hideBTimeout = window.setTimeout(() => {
          b.el.classList.remove('is-flipped', 'is-active', 'is-wrong');
          syncCardAria(b.el);
          pendingMismatch = null;
          flipped = [];
          locked = false;
        }, WRONG_RING_DELAY + MISMATCH_FIRST_HIDE_DELAY + MISMATCH_SECOND_HIDE_EXTRA_DELAY);

        // Le joueur peut cliquer une autre carte pendant ce délai pour accélérer
        // le retournement (voir fastForwardPendingMismatch).
        pendingMismatch = { a, b, timeouts: [ringTimeout, hideATimeout, hideBTimeout] };
      }
    }
  }

  function checkWin() {
    const level = currentLevel();
    if (matchedCount === level.images.length) {
      stopTimer();
      window.setTimeout(showWinModal, 400);
    }
  }

  // ---------- Classement : requêtes Supabase ----------
  async function fetchTopScores(levelId) {
    const { data, error } = await supabaseClient
      .from('scores')
      .select('pseudo, score')
      .eq('level_id', levelId)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(LEADERBOARD_SIZE);
    if (error) throw error;
    return data;
  }

  async function submitScore(levelId, pseudo, score, moves, timeSeconds) {
    const { error } = await supabaseClient
      .from('scores')
      .insert({ level_id: levelId, pseudo, score, moves, time_seconds: timeSeconds });
    if (error) throw error;
  }

  // Position d'un score parmi TOUS les scores enregistrés pour ce niveau
  // (pas seulement le top 10) : utilisé pour le joueur hors classement, qui
  // peut quand même enregistrer son score et voir "tu es Ne sur M joueurs".
  // Deux requêtes de comptage (RLS "Lecture publique" déjà en place) plutôt
  // que de rapatrier toutes les lignes.
  async function fetchRank(levelId, score) {
    const { count: better, error: betterError } = await supabaseClient
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('level_id', levelId)
      .gt('score', score);
    if (betterError) throw betterError;

    const { count: total, error: totalError } = await supabaseClient
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('level_id', levelId);
    if (totalError) throw totalError;

    return { rank: (better ?? 0) + 1, total: total ?? 0 };
  }

  // ---------- Classement : rendu ----------
  // `listEl` : conteneur cible (celui de la modale de victoire ou celui de la
  // modale "Classement" consultable librement). `rows` : lignes à afficher
  // (classement + éventuellement l'entrée du joueur en cours, pas encore
  // enregistrée). `youIndex` : position de cette entrée dans `rows`, ou -1 si
  // aucune. `onSubmit` : appelé quand le joueur valide son pseudo pour la
  // ligne "vous".
  function renderBoardRows(listEl, rows, youIndex, onSubmit) {
    listEl.innerHTML = '';
    rows.forEach((row, i) => {
      const rowEl = document.createElement('div');
      rowEl.className = i === youIndex ? 'row you' : 'row';

      const rankEl = document.createElement('div');
      rankEl.className = 'rank';
      rankEl.textContent = String(i + 1);
      rowEl.appendChild(rankEl);

      if (i === youIndex) {
        const form = document.createElement('form');
        form.className = 'you-form';
        form.innerHTML = '<input maxlength="16" placeholder="Votre pseudo" aria-label="Votre pseudo" required>'
          + '<button type="submit">Valider</button>';
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          onSubmit(form);
        });
        rowEl.appendChild(form);
      } else {
        const nameEl = document.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = row.pseudo; // textContent : jamais de HTML injecté depuis un pseudo d'un autre joueur.
        rowEl.appendChild(nameEl);
      }

      const scoreEl = document.createElement('div');
      scoreEl.className = 'score mono';
      scoreEl.textContent = String(row.score);
      rowEl.appendChild(scoreEl);

      listEl.appendChild(rowEl);
    });
  }

  // Charge le top 10 du niveau et, si la partie qui vient de se terminer s'y
  // classerait, insère une ligne éditable à la bonne position pour que le
  // joueur entre son pseudo (comme sur un flipper).
  async function loadLeaderboard(level, currentEntry) {
    boardLevelLabel.textContent = level.label;
    boardList.innerHTML = '';
    boardStatus.textContent = '';
    boardOutsideEntry.hidden = true;
    boardOutsideEntry.innerHTML = '';

    if (!isSupabaseConfigured) {
      boardStatus.textContent = 'Classement pas encore configuré.';
      return;
    }

    boardStatus.textContent = 'Chargement du classement…';

    let top;
    try {
      top = await fetchTopScores(level.id);
    } catch {
      boardStatus.textContent = 'Classement indisponible pour le moment.';
      return;
    }

    boardStatus.textContent = '';

    let insertAt = top.findIndex((row) => currentEntry.score > row.score);
    if (insertAt === -1 && top.length < LEADERBOARD_SIZE) insertAt = top.length;

    if (insertAt === -1) {
      renderBoardRows(boardList, top, -1);
      boardStatus.textContent = `Hors du top ${LEADERBOARD_SIZE} cette fois (il fallait au moins ${top[top.length - 1].score} pts).`;
      renderOutsideEntry(level, currentEntry);
      return;
    }

    const merged = top.slice();
    merged.splice(insertAt, 0, { pseudo: '', score: currentEntry.score });
    const trimmed = merged.slice(0, LEADERBOARD_SIZE);

    renderBoardRows(boardList, trimmed, insertAt, async (form) => {
      const input = form.querySelector('input');
      const pseudo = input.value.trim();
      if (!pseudo) {
        input.setCustomValidity('Entre un pseudo.');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');

      const button = form.querySelector('button');
      button.disabled = true;

      try {
        await submitScore(level.id, pseudo, currentEntry.score, currentEntry.moves, currentEntry.timeSeconds);
        const nameEl = document.createElement('div');
        nameEl.className = 'name';
        nameEl.textContent = pseudo;
        form.replaceWith(nameEl);
        boardStatus.textContent = 'Score enregistré dans le classement !';
      } catch {
        button.disabled = false;
        boardStatus.textContent = "Le score n'a pas pu être enregistré, réessaie.";
      }
    });
  }

  // Score hors du top 10 : on propose quand même d'enregistrer le pseudo
  // (pour suivre le nombre de joueurs), puis on affiche sa position réelle
  // parmi tous les scores du niveau ("tu es 47e sur 312"). Affiché à part,
  // sous le top 10 — jamais inséré comme une fausse ligne dedans puisque ce
  // score n'y figure pas vraiment.
  function renderOutsideEntry(level, currentEntry) {
    boardOutsideEntry.hidden = false;
    boardOutsideEntry.innerHTML = '';

    const hint = document.createElement('p');
    hint.className = 'outside-entry__hint';
    hint.textContent = 'Enregistre quand même ton score pour connaître ta position :';
    boardOutsideEntry.appendChild(hint);

    const form = document.createElement('form');
    form.className = 'you-form';
    form.innerHTML = '<input maxlength="16" placeholder="Votre pseudo" aria-label="Votre pseudo" required>'
      + '<button type="submit">Valider</button>';
    boardOutsideEntry.appendChild(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const pseudo = input.value.trim();
      if (!pseudo) {
        input.setCustomValidity('Entre un pseudo.');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');

      const button = form.querySelector('button');
      button.disabled = true;

      try {
        await submitScore(level.id, pseudo, currentEntry.score, currentEntry.moves, currentEntry.timeSeconds);
        const { rank, total } = await fetchRank(level.id, currentEntry.score);
        boardOutsideEntry.innerHTML = '';
        const result = document.createElement('p');
        result.className = 'outside-entry__rank';
        result.textContent = `Score enregistré ! Tu es ${rank}${rank === 1 ? 'er' : 'e'} sur ${total} joueur${total > 1 ? 's' : ''}.`;
        boardOutsideEntry.appendChild(result);
      } catch {
        button.disabled = false;
        boardStatus.textContent = "Le score n'a pas pu être enregistré, réessaie.";
      }
    });
  }

  // ---------- Classement : modale de consultation libre ----------
  // Permet de voir le top 10 de n'importe quel niveau sans avoir à le
  // terminer. Des tabs niveau internes à la modale (currentLeaderboardLevelId)
  // le permettent sans toucher au niveau en cours de jeu (currentLevelId).
  // Libellé volontairement simplifié ("Niveau 1" plutôt que "Niveau 1 ·
  // Facile") pour que les 3 tabs tiennent sur une ligne dans la modale.
  function leaderboardLevelName(level) {
    return `Niveau ${level.id}`;
  }

  function renderLeaderboardTabs() {
    leaderboardLevelsNav.innerHTML = '';
    LEVELS.filter((level) => level.images.length > 0).forEach((level) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-btn';
      btn.style.setProperty('--level-color', level.color);
      btn.style.setProperty('--level-text-on-active', level.textOnActive);

      btn.setAttribute('aria-pressed', String(level.id === currentLeaderboardLevelId));
      btn.textContent = leaderboardLevelName(level);

      btn.addEventListener('click', () => {
        if (currentLeaderboardLevelId === level.id) return;
        currentLeaderboardLevelId = level.id;
        renderLeaderboardTabs();
        loadLeaderboardView(level);
      });

      leaderboardLevelsNav.appendChild(btn);
    });
  }

  // Ne vide/reconstruit PAS la liste avant la réponse : en changeant vite de
  // tab niveau, ça donnait un flash de liste vide entre chaque clic (effet
  // "la fenêtre se ferme et se rouvre"). On garde l'ancien contenu affiché
  // pendant le chargement et on ne le remplace qu'une fois la réponse prête.
  async function loadLeaderboardView(level) {
    leaderboardLevelLabel.textContent = leaderboardLevelName(level);

    if (!isSupabaseConfigured) {
      leaderboardBoardList.innerHTML = '';
      leaderboardBoardStatus.textContent = 'Classement pas encore configuré.';
      return;
    }

    let top;
    try {
      top = await fetchTopScores(level.id);
    } catch {
      // Si le joueur a déjà changé de tab entre-temps, cette erreur ne
      // concerne plus le niveau affiché : on l'ignore pour ne pas écraser
      // le contenu (valide) du niveau sur lequel il est maintenant.
      if (level.id !== currentLeaderboardLevelId) return;
      leaderboardBoardList.innerHTML = '';
      leaderboardBoardStatus.textContent = 'Classement indisponible pour le moment.';
      return;
    }

    // Idem si un changement de tab plus récent est arrivé en premier pendant
    // ce chargement : cette réponse est obsolète, on ne l'affiche pas.
    if (level.id !== currentLeaderboardLevelId) return;

    renderBoardRows(leaderboardBoardList, top, -1);
    leaderboardBoardStatus.textContent = top.length ? '' : 'Pas encore de score pour ce niveau.';
  }

  // Le chrono de la partie en cours ne doit pas continuer à tourner pendant
  // que le joueur consulte le classement. On ne le relance à la fermeture
  // que s'il tournait déjà à l'ouverture (pas de partie en cours = rien à
  // reprendre, partie déjà gagnée = stoppé par checkWin, pas à relancer).
  let timerWasRunningBeforeLeaderboard = false;

  function openLeaderboardModal() {
    currentLeaderboardLevelId = currentLevelId;
    renderLeaderboardTabs();
    loadLeaderboardView(findLevel(currentLeaderboardLevelId));

    timerWasRunningBeforeLeaderboard = Boolean(timerHandle);
    stopTimer();

    // Même précaution que la modale de victoire contre un pinch-zoom resté actif.
    window.scrollTo(0, 0);
    leaderboardModal.hidden = false;
  }

  function hideLeaderboardModal() {
    leaderboardModal.hidden = true;
    if (timerWasRunningBeforeLeaderboard) {
      timerWasRunningBeforeLeaderboard = false;
      startTimer();
    }
  }

  // ---------- Win modal ----------
  function showWinModal() {
    const level = currentLevel();
    const score = computeScore();
    const moves = attempts;

    modalTime.textContent = formatTime(timerSeconds);
    modalMoves.textContent = String(moves);
    modalStars.innerHTML = starMarkup(computeStars());
    modalPoints.textContent = String(score);

    const prevBest = getBest(level.id);
    const isNewBestScore = !prevBest || score > prevBest.score;
    const isNewBestMoves = !prevBest || moves < prevBest.moves;

    const nextBest = {
      score: Math.max(score, prevBest ? prevBest.score : 0),
      moves: prevBest ? Math.min(moves, prevBest.moves) : moves,
    };
    saveBest(level.id, nextBest);

    const badges = [];
    if (isNewBestScore) badges.push('Nouveau record de score !');
    if (isNewBestMoves) badges.push('Nouveau record de coups !');

    modalRecord.innerHTML = badges.length
      ? `<p class="modal__record-new">${badges.join(' · ')}</p>`
      : `<p class="modal__record-hint">Record perso : ${nextBest.score} pts en ${nextBest.moves} coups</p>`;

    // Sécurité contre un pinch-zoom resté actif pendant la partie (mobile) :
    // sans ça la modale (position: fixed) peut apparaître décalée/zoomée.
    window.scrollTo(0, 0);
    winModal.hidden = false;
    loadLeaderboard(level, { score, moves, timeSeconds: timerSeconds });
    recordGamePlayed(level.id, score, moves, timerSeconds);
  }

  function hideWinModal() {
    winModal.hidden = true;
  }

  // ---------- Events ----------
  newGameBtn.addEventListener('click', startLevel);
  leaderboardBtn.addEventListener('click', openLeaderboardModal);
  leaderboardCloseBtn.addEventListener('click', hideLeaderboardModal);
  modalCloseBtn.addEventListener('click', hideWinModal);
  modalReplayBtn.addEventListener('click', () => {
    hideWinModal();
    startLevel();
  });

  let resizeHandle = null;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeHandle);
    resizeHandle = requestAnimationFrame(fitBoard);
  });
  window.addEventListener('orientationchange', fitBoard);

  // La police web peut légèrement changer la hauteur du header une fois chargée.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitBoard);
  }

  // ---------- Init ----------
  startLevel();
})();
