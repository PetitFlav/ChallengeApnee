# Challenge Apnée – Application de saisie des distances

## Objectif

Cette application web sert à gérer la saisie des distances nagées pendant un challenge piscine annuel.

Elle doit permettre :

- d’enregistrer les nageurs avant le début du challenge,
- de saisir rapidement les feuilles papier récupérées pendant l’événement,
- de calculer automatiquement les distances nagées,
- d’éviter les doublons de saisie,
- d’afficher les résultats en direct,
- d’afficher un écran public avec le total global en grand,
- de produire des statistiques complémentaires par club et par section.

## Contexte métier

Le challenge dure 2 heures.

Des bénévoles en bord de ligne utilisent des petites feuilles papier pour noter les longueurs nagées par les participants.

Les feuilles sont ramassées en plusieurs tournées pendant le challenge, puis une ou deux personnes les ressaisissent dans l’application sur ordinateur portable.

Chaque nageur possède un numéro unique pour tout le challenge.

Les nageurs peuvent nager sur des lignes de 25 m ou de 50 m, et changer de ligne pendant l’événement.

## Règles de comptage

Les longueurs sont notées avec :

- des carrés
- des traits

Règles :

- 1 carré = 4 longueurs
- 1 trait = 1 longueur

Formules :

- `totalLengths = squares * 4 + ticks`
- `distanceM = totalLengths * lane.distanceM`

Exemple :

- 9 carrés + 2 traits = `9 * 4 + 2 = 38 longueurs`
- sur une ligne de 25 m = `950 m`
- sur une ligne de 50 m = `1900 m`

## Fonctionnement de la saisie

La saisie se fait **feuille par feuille**.

Pour chaque feuille :

1. le saisisseur choisit la tournée,
2. puis la ligne,
3. l’application déduit automatiquement la distance de ligne,
4. puis le saisisseur entre les nageurs présents sur la feuille :
   - numéro nageur
   - carrés
   - traits
5. l’application calcule automatiquement :
   - le nom du nageur
   - le total de longueurs
   - la distance en mètres
6. la feuille est validée,
7. puis le saisisseur passe à la feuille suivante.

## Règle anti-doublon

Une feuille est unique par :

- challenge
- tournée
- ligne

Il ne doit pas être possible de créer deux feuilles pour la même tournée et la même ligne.

## Clubs et sections

L’application doit aussi gérer l’origine des nageurs pour permettre des statistiques supplémentaires.

### Club

Chaque nageur peut être rattaché à un club.

Objectifs :

- distinguer les nageurs du club organisateur et les nageurs extérieurs,
- calculer des statistiques par club,
- filtrer les participants par club.

Exemples :

- club organisateur
- club extérieur A
- club extérieur B
- indépendant / sans club

### Section

Pour les nageurs appartenant au club organisateur, il doit être possible d’indiquer une section interne.

Sections prévues :

- Apnéistes
- Plongeurs
- Chasseurs
- Hockeyeurs

### Règle métier

- chaque nageur peut avoir un club,
- la section est utilisée principalement pour les nageurs internes au club organisateur,
- pour un nageur extérieur, la section peut être vide,
- le caractère interne / extérieur peut être déduit à partir du club.

### Statistiques souhaitées

À terme, l’application doit permettre d’obtenir :

- distance totale par club,
- nombre de nageurs par club,
- distance totale par section,
- nombre de nageurs par section,
- comparaison club organisateur / extérieurs.

## Fonctionnalités prévues en V1

- gestion des nageurs
- gestion des clubs
- gestion des sections
- saisie d’une feuille complète
- validation d’une feuille
- contrôle et correction des feuilles
- tableau de bord interne
- écran public d’affichage
- export CSV

## Écrans prévus

- `/swimmers` : gestion des nageurs
- `/sheets/new` : saisie d’une feuille
- `/sheets` : liste et contrôle des feuilles
- `/dashboard` : résultats internes
- `/public` : affichage public

## Stack technique

- Next.js
- TypeScript
- React
- Tailwind CSS
- PostgreSQL
- Prisma ORM

## Hébergement prévu

- application web : Vercel
- base de données : Supabase PostgreSQL

## Structure métier principale

### Nageur

Chaque nageur possède :

- un numéro unique
- un prénom
- un nom
- un email
- un club
- éventuellement une section

### Club

Chaque club possède :

- un nom
- un indicateur permettant d’identifier le club organisateur

### Section

Chaque section possède :

- un nom

Valeurs prévues :

- Apnéistes
- Plongeurs
- Chasseurs
- Hockeyeurs

### Feuille

Chaque feuille correspond à :

- une tournée
- une ligne
- une distance de ligne connue (25 m ou 50 m)

### Entrée de feuille

Chaque ligne de feuille contient :

- un nageur
- un nombre de carrés
- un nombre de traits
- un total de longueurs
- une distance calculée

## Priorités du projet

1. rapidité de saisie sur ordinateur portable
2. simplicité d’utilisation
3. fiabilité des calculs
4. prévention des doublons
5. réutilisation annuelle
6. statistiques utiles par club et section

## Hors périmètre V1

- application mobile native
- saisie directe par les bénévoles en bord de bassin
- rôles complexes
- statistiques avancées trop détaillées
- websocket temps réel avancé
- design sophistiqué

## Documentation complémentaire

- `SPEC.md` : cahier des charges détaillé
- `AGENTS.md` : règles projet pour Codex
- `PROMPT_CODEX.md` : prompt complet à utiliser avec Codex

## Lancement du projet

À compléter quand le projet Next.js sera généré.

Exemple cible :

```bash
npm install
npm run dev
