# Memory Game

Web app de jeu de mémoire (memory) — HTML/CSS/JS vanilla, sans framework ni étape de build.

**En ligne** : [memory.juliolebarbo.com](https://memory.juliolebarbo.com) (GitHub Pages). Code source sur [github.com/julespariot/Memory-Game](https://github.com/julespariot/Memory-Game).

## Lancer le projet

```bash
python3 -m http.server 8743
```

Puis ouvrir `http://localhost:8743`. Une config `.claude/launch.json` existe déjà pour lancer ce serveur via l'outil de preview (nom `memorygame`, port 8743).

**Piège de cache en dev** : `python3 -m http.server` ne force pas le rechargement de `styles.css`/`script.js` — le navigateur du pane de preview garde parfois une version mise en cache même après une navigation vers une nouvelle URL. Si un changement CSS/JS ne semble "pas appliqué" alors que le fichier source est correct, forcer le rechargement du lien stylesheet/script (`link.href = '/styles.css?cb=' + Date.now()`) avant de conclure à un bug réel.

## Structure

```
index.html       structure de la page (header, grille de jeu, modale de victoire)
styles.css       tout le style (thème clair, responsive desktop/mobile)
script.js        toute la logique (IIFE unique, pas de modules)
assets/
  dos.PNG                      illustration source du dos de carte
  memory cards/Niveau 1 /...   photos sources brutes niveau 1 (non utilisées directement)
  memory cards/Niveau 2 /...   photos sources brutes niveau 2 (anciennes, remplacées par cards/IMG_3017.PNG)
  memory cards/Niveau 3 /      vide — les sources niveau 3 sont arrivées directement dans cards/IMG_3017.PNG
  cards/IMG_3017.PNG           planche-contact fournie par l'utilisateur : grille 4×7 (28 cases). Source à conserver si de nouvelles planches doivent être découpées pareil.
  cards/all28/card-01..28.png  les 28 illustrations de la planche, découpées individuellement (ordre de lecture de la planche, gauche→droite haut→bas), non triées par niveau — sert de réservoir pour la sélection manuelle par niveau.
  cards/level1/card-XX.png     sélection de cartes niveau 1 : 10 fichiers copiés à la main depuis cards/all28/ (numéros non contigus, ex. card-02, card-04, card-06…)
  cards/level2/card-XX.png     sélection de cartes niveau 2 : 18 fichiers copiés à la main depuis cards/all28/ (numéros non contigus)
  cards/level3/card-XX.png     niveau 3 = les 28 cartes de cards/all28/ (toutes, card-01 à card-28)
  cards/card-back.png          dos de carte, recadré depuis assets/dos.PNG
.wireframes-scratch/           résidus d'extraction de la maquette d'origine (pas utilisés par l'app, à nettoyer si besoin)
legal/
  legal.css                    styles partagés des pages légales (réutilise les variables de styles.css)
  mentions-legales.html        gabarit mentions légales — contient des [À COMPLÉTER] (identité éditeur, hébergeur)
  confidentialite.html         gabarit politique de confidentialité / RGPD — contient des [À COMPLÉTER]
  cgu.html                     gabarit CGU — contient des [À COMPLÉTER]
```

Les 3 pages `legal/` ne sont pas encore reliées depuis `index.html` (pas de lien dans un footer) : elles attendent les infos d'identité de l'éditeur avant d'être complétées et liées. Voir "État / suivi".

## Niveaux

- **Niveau 1 · Facile** — 10 paires (`assets/cards/level1`)
- **Niveau 2 · Moyen** — 18 paires (`assets/cards/level2`)
- **Niveau 3 · Difficile** — 28 paires (`assets/cards/level3`, toutes les cartes)

**Important** : la sélection des cartes par niveau se fait à la main (copier les fichiers voulus depuis `assets/cards/all28/` vers `assets/cards/levelN/`, en gardant leur nom d'origine — donc des numéros non contigus). `script.js` ne génère donc PAS la liste `images` par `Array.from` pour les niveaux 1 et 2 : il référence explicitement les numéros présents via la fonction `cardList(level, numbers)`. **Après toute nouvelle sélection manuelle dans ces dossiers, il faut mettre à jour les tableaux `numbers` dans `LEVELS` (script.js) pour qu'ils correspondent aux fichiers réellement présents.** Niveau 3 reste un `Array.from` simple car il prend toujours l'intégralité de `all28/`.

**Pour découper une nouvelle planche-contact** (plusieurs illustrations sur un seul PNG, comme `cards/IMG_3017.PNG`) :
1. Détecter la grille en repérant les lignes/colonnes quasi entièrement noires (fond/gouttières) dans l'image, avec un script Python (PIL + numpy) : profil de "fraction de pixels sombres" par ligne/colonne, seuil ~0.95.
2. Pour chaque cellule détectée, reprendre une bbox serrée sur les pixels non-sombres (pas juste les bornes de la grille globale — certaines lignes/colonnes de gouttière ne sont pas parfaitement noires et faussent la découpe globale), puis recadrer en carré centré.
3. Vérifier visuellement (contact sheet des crops) avant de ranger les fichiers dans `cards/all28/card-XX.png`.
4. Laisser l'utilisateur trier à la main les fichiers voulus dans `cards/level1/` et `cards/level2/`, puis mettre à jour `cardList(...)` dans `script.js` avec les numéros présents.

## Points d'architecture importants

- **Pas de build** : tout est servi tel quel (ES5/ES6 vanilla, une seule balise `<script>`).
- **Grille adaptative** (`fitBoard()` / `bestGridShape()` dans `script.js`) : pour chaque niveau, l'algo teste les formes `cols × rows` raisonnables (ratio cols/rows entre 0.4 et 2.6) et choisit celle qui donne les plus grosses cartes pour l'espace écran réellement dispo (largeur ET hauteur) — recalculé en direct au resize/orientation. Résultat : jamais de scroll, et la forme de grille change entre desktop (ex. 9×4) et mobile (ex. 4×9) automatiquement.
  - Tous les niveaux (1, 2 et 3) : seules les factorisations exactes de `cols × rows = nombre de cartes` sont candidates. `bestGridShape()` accepte un paramètre `allowPartialLastRow` (dernière ligne non remplie, `rows = Math.ceil(count / cols)`) qui avait été activé pour le niveau 3 (56 cartes → 12×5 desktop / 6×10 mobile au lieu de 7×8/8×7), mais désactivé ensuite sur demande explicite : `fitBoard()` appelle maintenant `bestGridShape(..., false)` pour les 3 niveaux, donc le niveau 3 reste figé sur 7×8/8×7 (ses seuls diviseurs exacts dans la plage de ratio acceptée). Le paramètre reste dans le code au cas où on voudrait le réactiver, mais ne pas le faire sans qu'on le redemande.
  - `#board` est en **flexbox** (`flex-wrap: wrap; justify-content: center`), pas en CSS grid : chaque `.card` a une taille fixe via la variable CSS `--card-size` (posée sur `#board`, héritée), et `fitBoard()` fixe `board.style.width` à exactement `cols × cardSize + gaps` pour que le flex-wrap coupe au bon nombre de colonnes.
- **Scoring** : +100 pts/paire trouvée, -3 pts/erreur. Étoiles basées sur l'efficacité (paires / tentatives). Un compteur de coups ("Coups") est affiché à côté du temps et du score.
- **Records personnels** : meilleur score et meilleur nombre de coups sauvegardés par niveau dans `localStorage` (clé `memorygame:best:<levelId>`), affichés dans la modale de victoire avec un message "Nouveau record" si battu.
- **Séquence d'erreur (mismatch)** : les 2 cartes se retournent d'abord, le liseré rouge n'apparaît qu'après coup (~450ms), la 1re carte se recache après un délai, la 2e reste visible 1s de plus. Si le joueur clique une 3e carte pendant ce délai, le retournement des 2 cartes fautives est accéléré (fast-forward) pour ne pas le bloquer.
- **Responsive** : un seul layout HTML, adapté via CSS (`@media max-width: 680px` et `420px`) + le calcul JS de grille. Sur mobile, le header est volontairement compact : labels Temps/Coups/Score masqués visuellement (mais gardés accessibles via technique sr-only) et bouton "Nouvelle partie" réduit à une icône (↻) avec `aria-label`.
- **Pas d'emoji dans l'UI** : retirés sur demande explicite de l'écran de victoire (🎉, 🏆, 🎯). Ne pas en réintroduire sans qu'on le demande.

### Classement en ligne (implémenté, en attente des identifiants Supabase)

Top 10 par niveau, visible par tous les joueurs, avec saisie d'un pseudo depuis la modale de victoire si le score obtenu s'y classe.

- **Décisions prises** : backend = **Supabase** (compte gratuit déjà existant côté utilisateur) ; design = **proposition B "intégré au jeu"** (reprend la charte actuelle — modale blanche, badges couleur).
- **Implémenté** :
  - SDK Supabase JS chargé via CDN (`index.html`, balise `<script>` jsDelivr, UMD, avant `script.js`) — garde le projet sans étape de build.
  - `script.js` : constantes `SUPABASE_URL` / `SUPABASE_ANON_KEY` en haut du fichier (section "Classement en ligne (Supabase)"), actuellement des placeholders (`'YOUR_SUPABASE_URL'` / `'YOUR_SUPABASE_ANON_KEY'`). Tant qu'elles ne sont pas renseignées, `isSupabaseConfigured` vaut `false` et la modale affiche juste "Classement pas encore configuré." sans planter.
  - `fetchTopScores(levelId)` / `submitScore(...)` : requêtes Supabase (lecture top 10, insertion d'un score).
  - `loadLeaderboard(level, currentEntry)` : calcule où le score qui vient d'être fait se classerait parmi le top 10 existant (fusion + tri + troncature à 10, testé pour les cas limites : classement vide, moins de 10 entrées, score en milieu de classement, record absolu, score hors classement), et insère une ligne de saisie du pseudo à la bonne position si le score qualifie. Appelée à la fin de `showWinModal()`.
  - `renderBoardRows(...)` : rendu DOM via `textContent` (jamais `innerHTML` sur un pseudo venant d'un autre joueur — défense en profondeur contre une injection XSS si jamais les RLS étaient contournées).
  - Markup dans `index.html` (`#boardSection` dans la modale) et styles dans `styles.css` (section "Classement (Top 10)"), classes identiques à la maquette B validée.
  - `.modal__card` a maintenant `max-height: calc(100vh - 40px); overflow-y: auto;` pour rester scrollable sur petit écran vu que la liste ajoute pas mal de hauteur.
- **Fait** : Project URL + clé `anon public` Supabase (jamais la `service_role`, qui doit rester secrète côté serveur) collées dans les deux constantes de `script.js`. Projet Supabase : `sgzrjagbcmzeizvglsin`. Schéma SQL exécuté (voir ci-dessous), connexion vérifiée (requête REST sur `scores` → 200, table vide).
- **Schéma SQL** (table `scores`) : colonnes `id uuid`, `level_id int`, `pseudo text`, `score int`, `moves int`, `time_seconds int`, `created_at timestamptz`. RLS activé : policy `select` publique, policy `insert` publique mais contrainte (pseudo 1–16 caractères, score plafonné selon `level_id` — 1000/1800/2800 pour niveaux 1/2/3 — pour limiter la triche côté client). **Pas** de policy `update`/`delete` : un score soumis ne peut plus être modifié/supprimé depuis le navigateur. SQL exact :
  ```sql
  create table public.scores (
    id uuid primary key default gen_random_uuid(),
    level_id integer not null check (level_id in (1, 2, 3)),
    pseudo text not null check (char_length(pseudo) between 1 and 16),
    score integer not null check (
      (level_id = 1 and score <= 1000) or
      (level_id = 2 and score <= 1800) or
      (level_id = 3 and score <= 2800)
    ),
    moves integer not null check (moves > 0),
    time_seconds integer not null check (time_seconds > 0),
    created_at timestamptz not null default now()
  );

  alter table public.scores enable row level security;

  create policy "Lecture publique" on public.scores for select using (true);
  create policy "Insertion publique" on public.scores for insert with check (true);
  ```
- **Implication légale** : une fois les identifiants branchés, ça collecte réellement pseudo + score côté serveur → active la section RGPD déjà rédigée dans `legal/confidentialite.html` (actuellement marquée "à adapter" en attendant cette mise en service).

### Suivi des parties jouées / joueurs uniques (Supabase) — table `game_plays` à créer

La table `scores` ne capture qu'une partie qui rentre dans le top 10 d'un niveau (et seulement si le joueur saisit un pseudo) — elle ne dit donc rien du nombre réel de parties jouées. `game_plays` enregistre **toutes** les parties menées jusqu'à la victoire, avec un identifiant anonyme de joueur, pour répondre à "combien de joueurs uniques / combien de parties".

- **Implémenté côté code** (`script.js`, section "Suivi des parties jouées (Supabase)") :
  - `getOrCreatePlayerId()` : génère un UUID anonyme (`crypto.randomUUID()`, avec repli si indisponible) stocké en `localStorage` (clé `memorygame:playerId`) la première fois, puis réutilisé. Identifie un **navigateur/appareil**, pas une personne — se réinitialise en navigation privée, sur un autre navigateur/appareil, ou si le joueur vide son stockage local. Donc "joueurs uniques" ici reste une approximation, jamais un compte exact de personnes.
  - `recordGamePlayed(levelId, score, moves, timeSeconds)` : insertion `game_plays`, appelée à la fin de `showWinModal()` (donc à chaque partie **terminée**, indépendamment du classement). Best-effort : erreurs avalées, ne bloque jamais l'affichage de la modale de victoire.
  - **Limite connue** : seules les parties menées jusqu'à la victoire sont comptées. Le memory n'a pas d'état de "défaite", donc une partie commencée puis abandonnée (le joueur ferme l'onglet, change de niveau en cours de partie) n'est pas enregistrée — pas de moyen fiable de le détecter côté client sans complexifier le suivi (beacon `visibilitychange`/`unload`). À réévaluer si on a besoin du taux d'abandon.
- **Reste à faire côté Supabase** (SQL à exécuter dans le dashboard, SQL Editor) :
  ```sql
  create table public.game_plays (
    id uuid primary key default gen_random_uuid(),
    player_id uuid not null,
    level_id integer not null check (level_id in (1, 2, 3)),
    score integer not null check (
      (level_id = 1 and score <= 1000) or
      (level_id = 2 and score <= 1800) or
      (level_id = 3 and score <= 2800)
    ),
    moves integer not null check (moves > 0),
    time_seconds integer not null check (time_seconds > 0),
    created_at timestamptz not null default now()
  );

  alter table public.game_plays enable row level security;

  create policy "Insertion publique" on public.game_plays for insert with check (true);
  ```
  Volontairement **pas** de policy `select` publique (contrairement à `scores`) : cette table ne doit être lisible que depuis le SQL Editor / Table Editor du dashboard Supabase (qui passe par-dessus les RLS), pas depuis le site par n'importe quel visiteur via la clé anon — ces chiffres d'usage ne regardent que l'éditeur du site.
- **Pour consulter les chiffres** une fois la table créée, dans le SQL Editor Supabase :
  ```sql
  -- Nombre total de parties jouées (toutes terminées)
  select count(*) from public.game_plays;

  -- Joueurs uniques approximatifs (par appareil/navigateur)
  select count(distinct player_id) from public.game_plays;

  -- Détail par niveau
  select level_id, count(*) as parties, count(distinct player_id) as joueurs_uniques
  from public.game_plays
  group by level_id
  order by level_id;
  ```
- **Implication légale** : `player_id` est un identifiant anonyme généré côté client (pas d'email, pas de nom), mais reste une donnée technique liée à un appareil au sens RGPD au sens large — à mentionner dans `legal/confidentialite.html` au même titre que les scores si la section RGPD est complétée.

## État / suivi

- [x] Jeu fonctionnel niveaux 1, 2 et 3.
- [x] Grille adaptative desktop/mobile sans scroll.
- [x] Scoring + compteur de coups + records persistés en local.
- [x] Header mobile optimisé (compact, icône seule).
- [x] Planche-contact `cards/IMG_3017.PNG` découpée en 28 cartes individuelles dans `cards/all28/`.
- [x] Sélection manuelle des 3 niveaux faite par l'utilisateur (10 / 18 / 28 cartes) et synchronisée dans `script.js` (`cardList(...)`).
- [x] Gabarits légaux créés (`legal/mentions-legales.html`, `confidentialite.html`, `cgu.html`) — voir ci-dessous pour ce qui bloque encore.
- [x] **Classement en ligne (top 10/niveau, Supabase, design B)** : Project URL + clé anon configurées dans `script.js`, schéma SQL exécuté côté Supabase, connexion vérifiée, soumission de score testée en conditions réelles (pseudo + score bien arrivés en base). Projet versionné sur GitHub (`github.com/julespariot/Memory-Game`).
- [x] **Mise en ligne** : site déployé via GitHub Pages (Settings → Pages, branche `main`, racine `/`), domaine personnalisé `memory.juliolebarbo.com` (sous-domaine de l'e-shop `juliolebarbo.com`, DNS géré chez IONOS — enregistrement CNAME `memory` → `julespariot.github.io.`), HTTPS actif (certificat Let's Encrypt, "Enforce HTTPS" coché). Le fichier `CNAME` à la racine du repo gère ce rattachement — ne pas le supprimer sans reconfigurer le domaine dans Settings → Pages.
- [x] **Pages légales reliées au site** : footer ajouté dans `index.html` (liens vers les 3 pages `legal/`). Éditeur = Jules Pariot, auto-entrepreneur, contact `juliolebarbo@gmail.com` ; hébergeur = GitHub Pages ; hébergement des données du classement = Supabase (région Europe). Renseigné dans `mentions-legales.html` et `confidentialite.html`.
- [ ] **Mentions légales encore incomplètes** : il manque l'adresse de l'activité et le numéro SIRET de l'auto-entreprise (obligatoires pour une activité professionnelle, loi LCEN art. 6-III) — signalés par un bandeau `[À COMPLÉTER]` dans `legal/mentions-legales.html`.
- [ ] **Suivi des parties jouées (table `game_plays`)** : code en place dans `script.js` (`recordGamePlayed`, voir section dédiée ci-dessus), mais la table n'existe pas encore côté Supabase — tant qu'elle n'est pas créée avec le SQL fourni, l'insert échoue silencieusement (best-effort, aucun impact sur le jeu) et rien n'est compté.
- [ ] `.wireframes-scratch/` : dossier de travail issu de l'analyse de la maquette d'origine, peut être supprimé si plus utile.

## Notes de session

- Design basé sur une maquette (wireframe) fournie par l'utilisateur en HTML "bundlé" (fonts + specs de couleurs/layout) — déjà traduit en CSS, pas besoin d'y revenir sauf nouvelle demande de design.
- Pas de tests automatisés pour l'instant (vérifications faites manuellement via le navigateur / Playwright ponctuellement pour des captures d'écran).
