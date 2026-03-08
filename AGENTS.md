# AGENTS.md

## Objectif

Construire une V1 simple, rapide, fiable et réutilisable pour la saisie des feuilles de distances d’un challenge piscine.

L’application doit permettre :
- d’enregistrer les nageurs,
- de gérer les clubs et les sections,
- de saisir rapidement les feuilles papier,
- de calculer automatiquement les distances,
- d’éviter les doublons de feuilles,
- d’afficher les résultats en direct,
- d’afficher un écran public lisible,
- de produire des statistiques simples par club et par section.

## Priorités

1. Rapidité de saisie sur ordinateur portable
2. Simplicité d’utilisation
3. Fiabilité des calculs
4. Anti-doublon des feuilles
5. Réutilisabilité annuelle
6. Statistiques utiles par club et par section
7. Pas de suringénierie

## Contexte métier

- Le challenge dure 2 heures.
- Il y a 4 tournées de ramassage de feuilles.
- Les saisies se font après ramassage, par 1 ou 2 personnes sur ordinateur portable.
- La saisie se fait feuille par feuille.
- Chaque feuille correspond à une tournée et à une ligne.
- Les lignes peuvent être de 25 m ou 50 m.
- Les nageurs ont un numéro unique pendant tout le challenge.

## Règles métier

### Comptage
- 1 carré = 4 longueurs
- 1 trait = 1 longueur
- totalLengths = squares * 4 + ticks
- distanceM = totalLengths * lane.distanceM

### Feuille
- une feuille est unique par challenge + tournée + ligne
- il faut empêcher les doublons de feuilles
- si une feuille existe déjà, afficher une alerte claire et empêcher la création silencieuse d’un doublon

### Nageur
- chaque nageur a :
  - un numéro unique dans le challenge
  - un prénom
  - un nom
  - un email
  - un club
  - éventuellement une section

### Clubs
- chaque nageur peut être rattaché à un club
- le club organisateur doit être identifiable avec `isHostClub = true`
- les nageurs extérieurs sont ceux dont le club n’est pas le club organisateur
- prévoir des statistiques simples par club

### Sections
- la section concerne principalement les nageurs internes au club organisateur
- la section est optionnelle
- sections prévues :
  - Apnéistes
  - Plongeurs
  - Chasseurs
  - Hockeyeurs
- prévoir des statistiques simples par section

## Stack technique

- Next.js
- TypeScript
- React
- Tailwind CSS
- Prisma
- PostgreSQL
- Déploiement Vercel
- Base Supabase

## Structure métier attendue

### Entités principales
- Challenge
- Club
- Section
- Swimmer
- Lane
- Round
- Sheet
- SheetEntry

### Relations attendues
- un challenge possède des swimmers, lanes, rounds, sheets
- un swimmer appartient à un challenge
- un swimmer peut avoir un club
- un swimmer peut avoir une section
- une sheet appartient à un challenge, une round et une lane
- une sheet contient plusieurs sheet entries
- une sheet entry relie une sheet et un swimmer

## UX / UI

### Principes
- interface simple
- rapide à utiliser
- pensée pour laptop
- peu de clics
- erreurs explicites
- calculs affichés immédiatement
- navigation clavier correcte

### Saisie feuille
- sélectionner d’abord la tournée
- sélectionner ensuite la ligne
- déduire automatiquement la distance de ligne
- saisir ensuite les nageurs dans un tableau
- afficher automatiquement :
  - nom / prénom
  - club
  - section si présente
  - total longueurs
  - distance calculée
- afficher le total de la feuille avant validation

### Écran public
- très lisible
- gros chiffres
- peu d’informations
- auto-refresh toutes les 10 secondes
- lecture seule

## Pages minimales attendues

- `/login`
- `/swimmers`
- `/sheets`
- `/sheets/new`
- `/sheets/[id]`
- `/dashboard`
- `/public`

## Fonctionnalités minimales V1

1. Gestion des clubs
2. Gestion des sections
3. Gestion des nageurs
4. Saisie d’une feuille complète
5. Validation d’une feuille
6. Contrôle / correction des feuilles
7. Dashboard interne
8. Écran public
9. Exports CSV

## Requêtes et statistiques attendues

### Calculs principaux
- total général du challenge
- total par nageur
- total par nageur sur 25 m
- total par nageur sur 50 m
- meilleur nageur 25 m
- meilleur nageur 50 m
- top 3 général
- total d’une feuille
- nombre de feuilles validées

### Statistiques complémentaires
- total par club
- nombre de nageurs par club
- total par section
- nombre de nageurs par section

## Ordre de travail imposé

1. Schéma Prisma
2. Migrations
3. Seed
4. CRUD clubs
5. CRUD sections
6. CRUD nageurs
7. Saisie de feuille
8. Liste / contrôle des feuilles
9. Dashboard interne
10. Écran public
11. Exports CSV
12. README installation et déploiement

## Contraintes de développement

- pas de suringénierie
- pas de complexité inutile
- code clair et lisible
- composants simples
- validations côté serveur
- cohérence stricte des calculs
- stockage de `totalLengths` et `distanceM` en base
- anti-doublon sur les feuilles
- README installation locale
- README déploiement Vercel + Supabase

## Hors périmètre V1

Ne pas développer :
- application mobile native
- saisie directe au bord du bassin
- rôles complexes
- audit complet des modifications
- websocket temps réel avancé
- statistiques trop détaillées
- design sophistiqué
- fonctionnalités non demandées

## Style de code attendu

- TypeScript strict si possible
- fonctions métier séparées dans `lib/`
- composants clairs
- logique de calcul centralisée
- requêtes dashboard/public factorisées
- noms de variables explicites
- code maintenable et lisible
