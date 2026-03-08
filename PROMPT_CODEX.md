# PROMPT_CODEX.md

Je veux développer une application web V1 pour un challenge piscine annuel.

## OBJECTIF GÉNÉRAL

Créer une application web simple, rapide, fiable et réutilisable pour :

- enregistrer les nageurs au début du challenge,
- gérer les clubs et les sections des nageurs,
- saisir rapidement les feuilles papier récupérées pendant l’événement,
- calculer automatiquement les distances,
- éviter les doublons de feuilles,
- afficher les résultats en direct,
- afficher un écran public avec le total global en grand,
- produire des statistiques simples par club et par section.

## STACK TECHNIQUE IMPOSÉE

- Next.js (App Router)
- TypeScript
- React
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Déploiement prévu sur Vercel
- Base de données prévue sur Supabase PostgreSQL

## PRIORITÉ ABSOLUE

L’application doit être pensée pour la rapidité de saisie sur ordinateur portable.

Le design doit rester simple.  
Pas de sophistication inutile.  
Pas de suringénierie.

## CONTEXTE MÉTIER

Le challenge dure 2 heures.  
Il y a 4 tournées de ramassage de feuilles, environ toutes les 30 minutes.

Des bénévoles en bord de ligne utilisent de petites feuilles papier pour noter les longueurs nagées.

Chaque nageur possède un numéro unique pour tout le challenge.

Les nageurs peuvent nager sur des lignes de 25 m ou de 50 m, et changer au cours du challenge.

## COMPTAGE SUR FEUILLES

Les longueurs sont notées avec :

- des carrés
- des traits

## RÈGLE MÉTIER DE COMPTAGE

- 1 carré = 4 longueurs
- 1 trait = 1 longueur

## FORMULES

- totalLengths = squares * 4 + ticks
- distanceM = totalLengths * lane.distanceM

## EXEMPLE

- 9 carrés + 2 traits = 9*4 + 2 = 38 longueurs
- sur une ligne de 25 m => 950 m
- sur une ligne de 50 m => 1900 m

## ORGANISATION DE LA SAISIE

La saisie se fait feuille par feuille, pas nageur par nageur isolément.

Pour chaque feuille :

1. le saisisseur choisit d’abord la tournée
2. puis la ligne
3. l’application déduit automatiquement la distance de ligne (25 m ou 50 m)
4. ensuite le saisisseur entre les nageurs présents sur cette feuille :
   - numéro nageur
   - carrés
   - traits
5. l’application affiche automatiquement :
   - nom/prénom du nageur
   - club
   - section si présente
   - total longueurs
   - distance calculée
6. le saisisseur valide la feuille complète
7. puis passe à une autre feuille

## IMPORTANT

Une feuille correspond à :

- un challenge
- une tournée
- une ligne

## ANTI-DOUBLON

Il faut empêcher la double saisie d’une même feuille.

Une feuille doit être UNIQUE par :

- challengeId
- roundId
- laneId

Si une feuille existe déjà pour la même tournée et la même ligne :

- afficher une alerte claire
- empêcher la création d’un doublon silencieux
- proposer d’ouvrir la feuille existante

## LIGNES À CONFIGURER

Prévoir ces lignes par défaut :

- 25-1
- 25-2
- 25-3
- 25-4
- 50-1
- 50-2
- 50-3
- 50-4
- 50-5
- 50-6

## TOURNÉES À CONFIGURER

Prévoir 4 tournées par défaut :

- round 1 / T1 / 09:30
- round 2 / T2 / 10:00
- round 3 / T3 / 10:30
- round 4 / T4 / 11:00

Les heures peuvent être modifiables plus tard, mais pour la V1 un simple champ texte ou libellé suffit.

## CLUBS ET SECTIONS

Je veux aussi gérer les clubs et les sections des nageurs.

### OBJECTIF
Pouvoir distinguer :

- les nageurs du club organisateur,
- les nageurs extérieurs,
- les différentes sections internes du club organisateur.

### CLUB
Chaque nageur peut être rattaché à un club.

Objectifs :

- distinguer les nageurs internes et extérieurs,
- produire des statistiques par club,
- filtrer les nageurs par club.

Le club organisateur doit être identifiable avec un champ booléen `isHostClub`.

### SECTION
Chaque nageur du club organisateur peut être rattaché à une section.

La section est optionnelle.

Sections prévues :

- Apnéistes
- Plongeurs
- Chasseurs
- Hockeyeurs

Règles :

- chaque nageur peut avoir un club,
- chaque nageur du club organisateur peut avoir une section,
- un nageur extérieur peut ne pas avoir de section,
- le caractère interne / extérieur peut être déduit à partir du club.

## GESTION DES NAGEURS

Chaque nageur doit avoir :

- un numéro unique dans le challenge
- prénom
- nom
- email
- club
- éventuellement section

Le numéro est obligatoire et unique.  
L’email est obligatoire pour la V1.

## FONCTIONNALITÉS À DÉVELOPPER

### 1. PAGE `/swimmers`
Gestion des nageurs

Fonctionnalités :

- lister les nageurs
- créer un nageur
- modifier un nageur
- rechercher par numéro, nom ou prénom

Champs :

- number
- firstName
- lastName
- email
- club
- section

Règles :

- unicité sur `(challengeId, number)`
- validation claire en cas de doublon
- si le club sélectionné est le club organisateur, la section est disponible
- sinon la section peut rester vide ou être désactivée

### 2. PAGE `/sheets/new`
Saisie d’une nouvelle feuille

Flux attendu :

- sélectionner la tournée
- sélectionner la ligne
- afficher automatiquement la distance de ligne
- saisir les nageurs dans un tableau

Colonnes du tableau :

- numéro nageur
- nom/prénom auto-affiché
- club
- section auto-affichée si présente
- carrés
- traits
- total longueurs auto-calculé
- distance auto-calculée

Fonctionnalités :

- ajouter une ligne
- supprimer une ligne
- enregistrer en brouillon
- valider la feuille

Règles :

- numéro nageur obligatoire
- si numéro inconnu, afficher une erreur claire
- carrés >= 0
- traits >= 0
- recalcul automatique
- afficher le total de la feuille avant validation

### 3. PAGE `/sheets`
Liste et contrôle des feuilles

Fonctionnalités :

- liste des feuilles
- filtre par tournée
- filtre par ligne
- filtre par nageur
- filtre par club
- filtre par section
- ouvrir une feuille existante
- modifier une feuille
- supprimer une feuille si nécessaire
- recalcul automatique des totaux après modification

Informations affichées par feuille :

- tournée
- ligne
- distance ligne
- nombre de nageurs saisis
- total mètres de la feuille
- statut
- date/heure de saisie
- saisi par

### 4. PAGE `/dashboard`
Tableau de bord interne

Afficher :

- distance totale du challenge
- nombre total de nageurs avec distance > 0
- classement général provisoire
- meilleur nageur sur lignes 25 m
- meilleur nageur sur lignes 50 m
- top 3 général
- total par nageur
- total par club
- nombre de nageurs par club
- total par section
- nombre de nageurs par section

Définitions :

- meilleur nageur 25 m = nageur ayant le plus de mètres cumulés sur les feuilles de lignes 25 m
- meilleur nageur 50 m = nageur ayant le plus de mètres cumulés sur les feuilles de lignes 50 m

### 5. PAGE `/public`
Écran public d’affichage en grand

Afficher en très lisible :

- distance totale cumulée du challenge
- meilleur nageur 25 m
- meilleur nageur 50 m
- top 3 général
- dernière mise à jour

Contraintes :

- gros chiffres
- interface épurée
- lecture à distance possible
- rafraîchissement automatique toutes les 10 secondes
- lecture seule

### 6. EXPORTS CSV
Fournir des exports CSV pour :

- nageurs
- feuilles / saisies
- classement final
- statistiques par club
- statistiques par section

## AUTHENTIFICATION

Pour la V1, faire simple :

- une authentification simple pour protéger l’interface d’administration
- pages protégées :
  - /swimmers
  - /sheets
  - /sheets/new
  - /dashboard
- page /public accessible en lecture seule
- une solution simple est acceptable si elle est rapide à mettre en place

## SCHÉMA PRISMA À UTILISER

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SheetStatus {
  DRAFT
  VALIDATED
}

model Challenge {
  id              String      @id @default(cuid())
  name            String
  eventDate       DateTime
  durationMinutes Int         @default(120)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  swimmers        Swimmer[]
  lanes           Lane[]
  rounds          Round[]
  sheets          Sheet[]

  @@map("challenges")
}

model Club {
  id          String    @id @default(cuid())
  name        String    @unique
  isHostClub  Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  swimmers    Swimmer[]

  @@map("clubs")
}

model Section {
  id          String    @id @default(cuid())
  name        String    @unique
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  swimmers    Swimmer[]

  @@map("sections")
}

model Swimmer {
  id          String      @id @default(cuid())
  challengeId String
  number      Int
  firstName   String
  lastName    String
  email       String
  clubId      String?
  sectionId   String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  challenge   Challenge   @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  club        Club?       @relation(fields: [clubId], references: [id], onDelete: SetNull)
  section     Section?    @relation(fields: [sectionId], references: [id], onDelete: SetNull)
  entries     SheetEntry[]

  @@unique([challengeId, number])
  @@index([challengeId, number])
  @@index([lastName])
  @@index([firstName])
  @@index([clubId])
  @@index([sectionId])
  @@map("swimmers")
}

model Lane {
  id           String    @id @default(cuid())
  challengeId  String
  code         String
  distanceM    Int
  displayOrder Int
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  challenge    Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  sheets       Sheet[]

  @@unique([challengeId, code])
  @@index([challengeId, displayOrder])
  @@map("lanes")
}

model Round {
  id            String    @id @default(cuid())
  challengeId   String
  roundNumber   Int
  label         String
  scheduledTime String?
  displayOrder  Int
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  challenge     Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  sheets        Sheet[]

  @@unique([challengeId, roundNumber])
  @@index([challengeId, displayOrder])
  @@map("rounds")
}

model Sheet {
  id          String      @id @default(cuid())
  challengeId String
  roundId     String
  laneId      String
  status      SheetStatus @default(DRAFT)
  enteredBy   String?
  validatedAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  challenge   Challenge   @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  round       Round       @relation(fields: [roundId], references: [id], onDelete: Restrict)
  lane        Lane        @relation(fields: [laneId], references: [id], onDelete: Restrict)
  entries     SheetEntry[]

  @@unique([challengeId, roundId, laneId])
  @@index([challengeId, status])
  @@index([roundId])
  @@index([laneId])
  @@map("sheets")
}

model SheetEntry {
  id           String    @id @default(cuid())
  sheetId      String
  swimmerId    String
  squares      Int
  ticks        Int
  totalLengths Int
  distanceM    Int
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sheet        Sheet    @relation(fields: [sheetId], references: [id], onDelete: Cascade)
  swimmer      Swimmer  @relation(fields: [swimmerId], references: [id], onDelete: Restrict)

  @@index([sheetId])
  @@index([swimmerId])
  @@index([sheetId, swimmerId])
  @@map("sheet_entries")
}
