# SPEC.md — Cahier des charges technique
# Challenge Apnée — État réel de l'application (avril 2026)

> Ce document décrit l'application **telle qu'elle existe aujourd'hui**, pas telle qu'elle était prévue.
> Il sert de référence pour les évolutions futures.

---

## 1. Vue d'ensemble

Application web Next.js 14 (App Router) de gestion d'un challenge piscine annuel.
Déployée sur Vercel, base PostgreSQL sur Supabase, ORM Prisma.

---

## 2. Stack technique réelle

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.16 |
| Langage | TypeScript | 5.7 |
| UI | React + Tailwind CSS | 18.3 / 3.4 |
| ORM | Prisma | 6.x |
| Base de données | PostgreSQL (Supabase) | - |
| Hébergement app | Vercel | - |
| Auth | Session HTTP-only maison (scrypt + HMAC-SHA256) | - |

---

## 3. Modèle de données réel (Prisma)

### Challenge
```
id, name, eventDate, startTime, endTime, timezone
durationMinutes, roundsCount, lanes25Count, lanes50Count
isActive, isArchived, closedAt
clubOrganisateur, clubOrganisateurLogo
```
Pivot central — toutes les entités métier lui sont rattachées en cascade.

### User
```
id, firstName, lastName, email (unique), passwordHash, isSuperUser
```
Authentification interne. Lié aux challenges via `ChallengeUser`.

### ChallengeUser
Table de liaison `User ↔ Challenge`. Détermine quels challenges un utilisateur peut voir.

### Club
```
id, name (unique)
```
**Global** — non rattaché à un challenge. Partagé entre toutes les éditions.
Rattaché à un challenge via `ChallengeClub`.

### ChallengeClub
Table de liaison `Club ↔ Challenge`. Un club peut participer à plusieurs éditions.

### Section
```
id, name (unique)
```
Valeurs actuelles : Apnéistes, Plongeurs, Chasseurs, Hockeyeurs.
Globale (non liée à un challenge).

### Swimmer
```
id, challengeId, number, firstName, lastName
email (optionnel), clubId (optionnel), sectionId (optionnel)
```
Unicité sur `(challengeId, number)`.

### Lane
```
id, challengeId, code, distanceM, displayOrder, isActive
```
Générée automatiquement. Codes : `25-1`, `25-2`, ..., `50-1`, `50-2`, etc.
Unicité sur `(challengeId, code)`.

### Round
```
id, challengeId, roundNumber, label, scheduledTime, displayOrder
```
Générée automatiquement à partir de l'heure de début et de la durée.
Unicité sur `(challengeId, roundNumber)`.

### Sheet
```
id, challengeId, roundId, laneId, status (DRAFT|VALIDATED)
enteredBy, validatedAt
```
Unicité sur `(challengeId, roundId, laneId)` — règle anti-doublon.

### SheetEntry
```
id, sheetId, swimmerId, squares, ticks, totalLengths, distanceM
```
Saisie brute. Calculs : `totalLengths = squares*4 + ticks`, `distanceM = totalLengths * lane.distanceM`.

### Verification
```
id, sheetId, userId
```
Une vérification = une seconde saisie indépendante d'une feuille par un utilisateur.
Unicité sur `(sheetId, userId)`.

### VerificationLine
```
id, verificationId, swimmerId, squares, ticks, totalLengths, distanceM
```
Lignes de la vérification, comparées aux `SheetEntry` originales.

### FinalResult
```
id, challengeId, roundId, laneId, sheetId, swimmerId
clubId, sectionId, source (original|verification|manual)
squares, ticks, totalLengths, distanceM
validatedByUserId, validatedAt
sourceSheetEntryId, sourceVerificationId, sourceVerificationLineId
```
Résultat consolidé après validation. Unicité sur `(challengeId, roundId, laneId, swimmerId)`.

---

## 4. Fonctionnalités implémentées

### 4.1 Authentification (`lib/auth.ts`)
- Login email + mot de passe
- Hash scrypt (salt aléatoire, 64 octets)
- Session cookie HTTP-only signé HMAC-SHA256, durée 7 jours
- `requireSessionUser()` — protection serveur de toutes les pages

### 4.2 Contrôle d'accès (`lib/access.ts`)
Matrice de permissions par module :

| Module | Utilisateur affilié | Après clôture | SuperUser |
|---|---|---|---|
| events | ✓ | ✗ | ✓ |
| swimmers | ✓ | ✗ | ✓ |
| lengths-entry | ✓ (si actif) | ✓ | ✓ |
| verification | ✓ | ✓ | ✓ |
| dashboard | ✓ | ✓ | ✓ |
| statistics | ✓ | ✓ | ✓ |
| public-screen | ✓ | ✓ | ✓ |
| user-admin | ✗ | ✗ | ✓ |

Fenêtre temporelle de saisie : calculée à partir de `eventDate + startTime + durationMinutes`.

### 4.3 Gestion des challenges (`lib/challenge.ts`)
- Création avec génération automatique des lignes et tournées
- `buildLaneDefinitions(lanes25Count, lanes50Count)` → codes `25-1`, ..., `50-N`
- `buildRoundDefinitions(startTime, duration, roundsCount)` → horaires calculés
- `regenerateEventStructure()` → supprime et recrée lignes/tournées/feuilles dans une transaction

### 4.4 Saisie de feuille (`app/sheets/new/`)
- Sélection tournée + ligne
- Chargement automatique d'une feuille existante
- Résolution automatique nom/prénom/club/section depuis le numéro nageur
- Calcul en temps réel des distances
- Verrouillage hors tournée active (sauf superUser)
- Validation → statut `VALIDATED`

### 4.5 Vérification (`lib/verification.ts`)
- Double saisie indépendante d'une feuille
- Comparaison ligne par ligne : identique / différent / absent / ajouté
- Statuts : Non vérifiée / Partiellement vérifiée / Vérifiée sans écart / Vérifiée avec écarts / Vérifiée avec écarts (Validé)

### 4.6 Statistiques (`lib/statistics.ts`)
- Fusion `SheetEntry` + `FinalResult` par clé `round-lane-swimmer` (les FinalResult écrasent les SheetEntry)
- Total par nageur : distance totale, distance 25 m, distance 50 m
- Filtres : recherche texte, club, section
- Classement avec gestion des ex-æquo (`isTie`)
- Top 10 nageurs

### 4.7 Écran public (`app/public/`)
- Accès sans authentification
- Données servies par `/public/data` (route API)
- Rafraîchissement automatique

### 4.8 Export
- Impression tableau nageurs (`/swimmers/print`)
- Impression statistiques (`/statistics/print`)

---

## 5. Écrans disponibles

| Route | Accès | Description |
|---|---|---|
| `/login` | Public | Connexion |
| `/` | Connecté | Menu principal |
| `/events` | SuperUser | Liste des challenges |
| `/events/new` | SuperUser | Créer un challenge |
| `/events/[id]` | SuperUser | Configurer un challenge |
| `/events/[id]/counting-sheets` | SuperUser | Feuilles de comptage |
| `/swimmers` | Connecté | Nageurs, clubs, sections |
| `/swimmers/print` | Connecté | Impression tableau |
| `/sheets/new` | Connecté | Saisie feuille |
| `/sheets` | Connecté | Liste des feuilles |
| `/sheets/[id]` | Connecté | Détail / vérification |
| `/dashboard` | Connecté | Tableau de bord |
| `/statistics` | Connecté | Statistiques |
| `/statistics/print` | Connecté | Impression stats |
| `/public` | Public | Écran live |
| `/admin/users` | SuperUser | Gestion utilisateurs |

---

## 6. Règles métier importantes

### Anti-doublon feuille
Contrainte BDD `@@unique([challengeId, roundId, laneId])` sur `Sheet`.
Si une feuille existe déjà → chargement automatique de l'existante.

### Calcul des distances
```
totalLengths = squares * 4 + ticks
distanceM = totalLengths * lane.distanceM
```

### Priorité FinalResult vs SheetEntry
Dans les statistiques, un `FinalResult` sur une clé `(round, lane, swimmer)` écrase le `SheetEntry` correspondant.

### Numérotation des nageurs
Auto-incrémentée par challenge (`max(number) + 1`). Unicité garantie côté serveur avec retry sur conflit `P2002`.

### Email nageur
Optionnel depuis avril 2026.

---

## 7. Points d'attention pour les évolutions futures

### Sécurité
- Ne jamais commiter le `.env` (contient `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`)
- RLS Supabase activé sur toutes les tables (avril 2026)
- `AUTH_SECRET` doit être une chaîne aléatoire longue en production

### Clubs globaux
Les clubs sont partagés entre tous les challenges. Si un club doit être renommé pour une édition, ça impacte toutes les éditions. À surveiller pour une future refactorisation (liaison `ChallengeClub` avec métadonnées).

### Mise à jour Prisma
Version actuelle : 6.x. Une migration vers Prisma 7 nécessite un fichier `prisma.config.ts`.

### Mise à jour Next.js
Version actuelle : 14.2.16. Next.js 15 disponible.

---

## 8. Commandes utiles

```bash
# Développement
npm run dev

# Générer le client Prisma après changement de schéma
npx prisma generate

# Appliquer les migrations en production
npx prisma migrate deploy

# Créer un utilisateur
npm run user:create

# Seeder la base
npm run prisma:seed
```

---

## 9. Déploiement

### Vercel
- Déploiement automatique depuis `main`
- Variables d'environnement à configurer : `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`

### Supabase
- Connexion poolée via PgBouncer (`DATABASE_URL`) pour Prisma Client
- Connexion directe (`DIRECT_URL`) pour les migrations Prisma
- RLS activé sur toutes les tables

### Après chaque évolution du schéma
```bash
# Créer la migration
npx prisma migrate dev --name description_courte

# En production
npx prisma migrate deploy
npx prisma generate
```
