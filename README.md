# Challenge Apnée — Application de gestion d'événement

## Objectif

Application web de gestion complète d'un challenge piscine annuel.

Elle permet :

- de configurer l'événement (lignes, tournées, durée)
- d'enregistrer les nageurs avant le challenge
- de saisir rapidement les feuilles papier pendant l'événement
- de calculer automatiquement les distances nagées
- d'éviter les doublons de saisie
- de vérifier les saisies via un système de double saisie
- d'afficher les résultats en direct
- d'afficher un écran public avec le total global
- de produire des statistiques par nageur, club et section
- de gérer plusieurs éditions annuelles (multi-challenges)

---

## Contexte métier

Le challenge dure 2 heures. Des bénévoles en bord de ligne notent les longueurs nagées sur des petites feuilles papier. Les feuilles sont ramassées en plusieurs tournées, puis 1 ou 2 personnes les ressaisissent dans l'application sur ordinateur portable.

Chaque nageur possède un numéro unique pour tout le challenge. Les nageurs peuvent nager sur des lignes de 25 m ou 50 m, et changer de ligne pendant l'événement.

---

## Règles de comptage

Les longueurs sont notées avec des carrés et des traits :

- 1 carré = 4 longueurs
- 1 trait = 1 longueur

Formules :

- `totalLengths = squares * 4 + ticks`
- `distanceM = totalLengths * lane.distanceM`

Exemple : 9 carrés + 2 traits = 38 longueurs → 950 m sur ligne 25 m / 1900 m sur ligne 50 m

---

## Stack technique

- **Next.js 14** (App Router) + **TypeScript**
- **React 18** + **Tailwind CSS**
- **Prisma ORM** + **PostgreSQL**
- **Hébergement** : Vercel
- **Base de données** : Supabase PostgreSQL

---

## Installation

```bash
npm install
npx prisma generate
npm run dev
```

### Variables d'environnement

Créer un fichier `.env` à la racine (ne jamais commiter ce fichier) :

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
AUTH_SECRET="une-chaine-aleatoire-longue"
```

### Initialiser la base de données

```bash
npx prisma migrate deploy
npx prisma db seed
```

### Créer un utilisateur

```bash
TEST_USER_EMAIL=admin@example.com \
TEST_USER_PASSWORD='MotDePasse123!' \
TEST_USER_FIRST_NAME='Admin' \
TEST_USER_LAST_NAME='Challenge' \
npm run user:create
```

Pour un accès super-utilisateur (tous les challenges), passer `isSuperUser = true` directement en base.

---

## Authentification

Login email + mot de passe avec session HTTP-only (cookie signé HMAC-SHA256, durée 7 jours).

- `/login` : connexion
- Bouton **Se déconnecter** : suppression de session
- Pages métier protégées côté serveur
- Accès filtré selon les challenges affiliés à l'utilisateur

---

## Écrans disponibles

| Route | Description |
|---|---|
| `/` | Menu principal |
| `/login` | Connexion |
| `/events` | Gestion des challenges (superUser) |
| `/events/new` | Créer un challenge |
| `/swimmers` | Gestion des nageurs, clubs, sections |
| `/swimmers/print` | Impression tableau nageurs |
| `/sheets/new` | Saisie d'une feuille |
| `/sheets` | Liste et contrôle des feuilles |
| `/sheets/[id]` | Détail / vérification d'une feuille |
| `/dashboard` | Tableau de bord + vérification |
| `/statistics` | Statistiques par nageur / club / section |
| `/statistics/print` | Version imprimable des statistiques |
| `/public` | Écran public live (accès libre) |
| `/admin/users` | Administration des utilisateurs (superUser) |

---

## Modèle de données

### Challenge
Événement annuel pivot. Contient : nom, date, heure de début, durée, nombre de tournées, nombre de lignes 25 m / 50 m, statut actif/archivé, date de clôture, club organisateur.

### Nageur
Rattaché à un challenge. Possède un numéro unique par challenge, prénom, nom, email (optionnel), club (optionnel), section (optionnelle).

### Club
Global (partagé entre challenges). Rattaché à un challenge via `ChallengeClub`. Permet de distinguer le club organisateur des clubs extérieurs.

### Section
Valeurs : Apnéistes, Plongeurs, Chasseurs, Hockeyeurs. Optionnelle, principalement pour les nageurs du club organisateur.

### Lane (Ligne)
Générée automatiquement à la création du challenge. Code : `25-1`, `25-2`, ..., `50-1`, `50-2`, etc.

### Round (Tournée)
Générée automatiquement. Horaires calculés à partir de l'heure de début et de la durée.

### Sheet (Feuille)
Unique par `(challenge, round, lane)`. Statut : `DRAFT` ou `VALIDATED`.

### SheetEntry (Ligne de feuille)
Un nageur sur une feuille. Contient : carrés, traits, total longueurs, distance calculée.

### Verification / VerificationLine
Système de double saisie pour contrôle. Une vérification compare la saisie originale avec une seconde saisie indépendante.

### FinalResult
Résultat consolidé par nageur après validation. Source : `original`, `verification`, ou `manual`.

---

## Processus de validation

1. **Saisie** → création d'une `Sheet` avec ses `SheetEntry` (statut `DRAFT`)
2. **Vérification** → double saisie indépendante (`Verification` + `VerificationLine`)
3. **Comparaison** → l'application détecte les écarts entre saisie et vérification
4. **Validation** → création des `FinalResult` (source selon résultat)

---

## Gestion des accès

| Profil | Accès |
|---|---|
| Super-utilisateur | Tous les challenges, tous les modules |
| Utilisateur affilié | Challenge(s) assigné(s) uniquement |
| Après clôture | Vérification, saisie, dashboard, écran public uniquement |
| Écran public | Accès libre sans connexion |

---

## Réutilisation annuelle

Chaque édition est un nouveau `Challenge`. Les clubs sont partagés entre éditions. Les nageurs, lignes, tournées et feuilles sont propres à chaque challenge.

---

## Déploiement

- **Vercel** : déploiement automatique depuis GitHub (branche `main`)
- **Supabase** : base PostgreSQL hébergée
- Variables d'environnement à configurer dans Vercel (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`)
- Migrations : `npx prisma migrate deploy` (à lancer une fois après chaque évolution du schéma)
