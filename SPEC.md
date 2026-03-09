# SPEC.md

# Cahier des charges V1+ — Application web de saisie des distances du challenge

## 1. Objectif

Créer une application web simple, rapide et réutilisable pour un challenge piscine annuel.

L’application doit permettre :

- d’enregistrer les nageurs en début d’événement,
- de gérer les clubs et les sections des nageurs,
- de configurer un événement,
- de générer automatiquement les lignes et les tournées à partir de cette configuration,
- de saisir rapidement les feuilles papier de comptage récupérées pendant le challenge,
- de calculer automatiquement les distances nagées,
- d’éviter les doublons de saisie de feuilles,
- de charger et modifier une feuille déjà saisie,
- de consulter les résultats provisoires et finaux,
- d’afficher en direct le total global sur un écran séparé,
- de produire des statistiques par club et par section.

---

## 2. Contexte métier

### 2.1 Organisation terrain

- En bord de ligne, des bénévoles notent les longueurs sur des petites feuilles papier.
- Les nageurs annoncent leur numéro unique.
- Les bénévoles comptent les longueurs avec :
  - des carrés,
  - des traits.
- Règle de comptage :
  - 1 carré = 4 longueurs
  - 1 trait = 1 longueur

### 2.2 Types de lignes

Le bassin comporte un certain nombre de lignes de :
- 25 m
- 50 m

Le nombre exact de lignes 25 m et 50 m doit être défini dans la configuration de l’événement.

Un nageur peut nager :
- sur du 25 m,
- sur du 50 m,
- et changer au cours du challenge.

### 2.3 Ramassage / saisie

- Les feuilles sont ramassées à plusieurs tournées.
- Le nombre de tournées est défini dans la configuration de l’événement.
- Une fois les feuilles récupérées, 1 ou 2 personnes les saisissent sur ordinateur portable.
- La saisie se fait feuille par feuille :
  - on indique d’abord la tournée,
  - puis la ligne,
  - puis on saisit les nageurs présents sur cette feuille.

---

## 3. Objectifs de la V1+

La V1+ doit être fiable, simple, rapide, sans fonctionnalités inutiles.

Fonctionnalités obligatoires :

1. gestion des événements
2. gestion des nageurs
3. gestion des clubs
4. gestion des sections
5. configuration de l’événement
6. génération automatique des lignes
7. génération automatique des tournées
8. saisie d’une feuille par tournée et ligne
9. calcul automatique des distances
10. validation d’une feuille complète
11. prévention des doublons de feuilles
12. chargement d’une feuille déjà saisie
13. modification / suppression de lignes d’une feuille existante
14. consultation / contrôle des saisies
15. affichage public du total en direct
16. affichage du meilleur nageur 25 m et 50 m
17. statistiques par club et par section
18. export des résultats

---

## 4. Utilisateurs

### 4.1 Administrateur / organisateur
Peut :
- créer et configurer un événement
- créer / modifier les nageurs
- créer / modifier les clubs
- créer / modifier les sections
- saisir les feuilles
- corriger les saisies
- voir les résultats
- afficher l’écran public

### 4.2 Saisisseur
Peut :
- saisir des feuilles
- charger une feuille déjà saisie
- corriger une feuille si autorisé
- consulter les saisies

### 4.3 Écran public
Affichage en lecture seule.

---

## 5. Règles métier

### 5.1 Événement
Chaque événement possède :
- un nom
- une date
- une heure de début
- une durée en minutes
- une heure de fin calculée ou stockée
- un nombre de tournées
- un nombre de lignes 25 m
- un nombre de lignes 50 m

L’événement sert de cadre à :
- la génération des lignes,
- la génération des tournées,
- la saisie des feuilles,
- les résultats finaux.

### 5.2 Nageur
Chaque nageur possède :
- un numéro unique dans le challenge
- un nom
- un prénom
- un mail
- un club
- éventuellement une section

Ce numéro est utilisé pendant tout le challenge.

### 5.3 Club
Chaque nageur peut être rattaché à un club.

Objectifs :
- distinguer les nageurs du club organisateur et les nageurs extérieurs,
- produire des statistiques par club,
- filtrer les participants selon leur club.

Exemples :
- club organisateur
- club extérieur A
- club extérieur B
- indépendant / sans club

### 5.4 Section
La section concerne principalement les nageurs internes au club organisateur.

Sections prévues :
- Apnéistes
- Plongeurs
- Chasseurs
- Hockeyeurs

Règle métier :
- un nageur a un club,
- un nageur du club organisateur peut avoir une section,
- un nageur extérieur peut ne pas avoir de section,
- la section est donc optionnelle.

### 5.5 Ligne
Les lignes sont générées automatiquement à partir de la configuration de l’événement.

Exemple :
- si `lane25Count = 4`, créer :
  - 25-1
  - 25-2
  - 25-3
  - 25-4
- si `lane50Count = 6`, créer :
  - 50-1
  - 50-2
  - 50-3
  - 50-4
  - 50-5
  - 50-6

### 5.6 Tournée
Les tournées sont générées automatiquement à partir de :
- l’heure de début,
- l’heure de fin,
- le nombre de tournées.

Règle :
- les tournées doivent être réparties entre l’heure de début et l’heure de fin de l’événement.

Exemple :
- début : 14:00
- durée : 120 min
- fin : 16:00
- 4 tournées

Alors on peut générer :
- T1 : 14:30
- T2 : 15:00
- T3 : 15:30
- T4 : 16:00

### 5.7 Feuille
Une feuille correspond à :
- un événement
- une tournée
- une ligne

Une feuille contient ensuite plusieurs lignes nageurs.

### 5.8 Calcul
Pour chaque nageur saisi sur une feuille :

- `total_longueurs = (nombre_carres × 4) + nombre_traits`
- `distance_m = total_longueurs × longueur_de_la_ligne`

Exemple :
- 9 carrés + 2 traits
- total longueurs = 9×4 + 2 = 38
- sur ligne 25 m = 950 m
- sur ligne 50 m = 1900 m

### 5.9 Anti-doublon de feuille
Il faut empêcher la double création d’une même feuille.

Règle :
- une feuille est identifiée de manière unique par :
  - `challenge_id`
  - `round_id`
  - `lane_id`

Donc une seule feuille possible pour un couple :
- tournée + ligne

### 5.10 Feuille déjà existante
Si une feuille existe déjà pour :
- un événement,
- une tournée,
- une ligne,

alors l’application ne doit pas simplement bloquer.

Comportement attendu :
- charger la feuille existante,
- afficher toutes les lignes déjà saisies,
- permettre :
  - d’ajouter une ligne nageur,
  - de modifier une ligne nageur,
  - de supprimer une ligne nageur,
- recalculer automatiquement :
  - les longueurs,
  - les distances,
  - le total de feuille.

---

## 6. Écrans à développer

## 6.1 Écran 1 — Configuration de l’événement

### Objectif
Créer et configurer un événement.

### Fonctionnalités
- créer un événement
- modifier un événement
- afficher la configuration courante

### Champs
- nom de l’événement
- date
- heure de début
- durée en minutes
- heure de fin calculée ou affichée
- nombre de tournées
- nombre de lignes 25 m
- nombre de lignes 50 m

### Comportements attendus
- calcul automatique de l’heure de fin à partir de début + durée
- génération automatique des lignes
- génération automatique des tournées
- possibilité de régénérer la configuration si besoin

---

## 6.2 Écran 2 — Gestion des nageurs

### Objectif
Créer et consulter les nageurs avant ou pendant le challenge.

### Fonctionnalités
- ajouter un nageur
- modifier un nageur
- rechercher un nageur par :
  - numéro
  - nom
  - prénom
- afficher la liste des nageurs
- pagination par 10 nageurs par page

### Champs
- numéro nageur
- prénom
- nom
- mail
- club
- section (optionnelle)

### Règle numéro
Le numéro nageur ne doit pas être saisi librement si ce mode est activé.

Comportement attendu :
- récupérer le plus grand numéro existant pour le challenge courant,
- proposer automatiquement le numéro suivant (`max + 1`),
- garantir l’unicité côté serveur.

### Comportement recommandé
- si le club sélectionné est le club organisateur, la section est activée,
- sinon la section peut être laissée vide ou désactivée.

---

## 6.3 Écran 3 — Saisie d’une feuille

### Objectif
Saisir rapidement une feuille papier complète.

### Fonctionnement attendu

#### Étape A — ouverture de la feuille
Le saisisseur choisit :
- la tournée
- la ligne

À partir de la ligne, l’application déduit automatiquement :
- la distance de ligne : 25 m ou 50 m
- l’heure de tournée

#### Étape B — chargement éventuel d’une feuille existante
Si une feuille existe déjà pour ce couple :
- événement + tournée + ligne

alors :
- charger automatiquement la feuille existante,
- afficher un message clair :
  - “Cette feuille existe déjà, la saisie existante a été chargée.”

#### Étape C — saisie / modification des nageurs de la feuille
Pour chaque ligne de la feuille :
- numéro nageur
- nombre de carrés
- nombre de traits

L’application doit afficher automatiquement :
- prénom + nom du nageur
- club
- section si présente
- total longueurs
- distance calculée

Actions possibles :
- ajouter une ligne
- modifier une ligne existante
- supprimer une ligne existante

#### Étape D — validation de la feuille
Quand toute la feuille est correcte :
- bouton **Valider la feuille**
- enregistrement complet en base
- la feuille passe au statut `validée`

### Ergonomie attendue
L’écran doit être très rapide à utiliser :
- choix tournée + ligne en haut
- tableau de saisie dessous
- navigation clavier possible
- validation claire

### Contrôles
- si numéro nageur inexistant : erreur claire
- si carrés ou traits invalides : erreur claire
- recalcul automatique des totaux
- affichage du total de la feuille

### Colonnes du tableau de saisie
- numéro nageur
- prénom / nom auto-affiché
- club
- section
- carrés
- traits
- total longueurs
- distance en mètres
- actions (modifier / supprimer)

---

## 6.4 Écran 4 — Contrôle des feuilles et corrections

### Objectif
Vérifier ce qui a été saisi et corriger en cas d’erreur.

### Fonctionnalités
- liste des feuilles saisies
- filtre par événement
- filtre par tournée
- filtre par ligne
- filtre par nageur
- filtre par club
- filtre par section
- ouverture d’une feuille pour visualisation
- modification d’une feuille
- suppression d’une feuille si nécessaire
- recalcul automatique après modification

### Affichage minimum
Pour chaque feuille :
- événement
- tournée
- ligne
- distance ligne
- nombre de nageurs saisis
- total mètres de la feuille
- statut
- date/heure de saisie
- saisi par

---

## 6.5 Écran 5 — Résultats / tableau de bord interne

### Objectif
Voir les résultats provisoires pendant le challenge.

### Fonctionnalités
Afficher :
- distance totale de l’événement
- nombre total de nageurs ayant une distance > 0
- classement général provisoire
- meilleur nageur sur lignes 25 m
- meilleur nageur sur lignes 50 m
- total par nageur
- total par club
- nombre de nageurs par club
- total par section
- nombre de nageurs par section

### Définition des meilleurs nageurs
- meilleur nageur 25 m = nageur ayant le plus de mètres cumulés sur feuilles de lignes 25 m
- meilleur nageur 50 m = nageur ayant le plus de mètres cumulés sur feuilles de lignes 50 m

### Total final événement
Afficher :
- la distance totale cumulée de l’événement
- en mètres
- et éventuellement en kilomètres

---

## 6.6 Écran 6 — Affichage public

### Objectif
Afficher sur un ordinateur ou écran séparé les informations du challenge en grand format.

### Affichage requis
- distance totale cumulée en très gros
- meilleur nageur 25 m
- meilleur nageur 50 m
- dernière mise à jour
- éventuellement top 3 général

### Contraintes UX
- très lisible
- gros chiffres
- peu d’informations
- rafraîchissement automatique

---

## 6.7 Export

### Objectif
Pouvoir récupérer les résultats.

### Exports demandés
- export CSV des nageurs
- export CSV des saisies
- export CSV du classement final
- export CSV des statistiques par club
- export CSV des statistiques par section

---

## 7. Modèle de données

## 7.1 Table `challenges`
Champs :
- `id`
- `name`
- `event_date`
- `start_time`
- `duration_minutes`
- `end_time`
- `round_count`
- `lane25_count`
- `lane50_count`
- `created_at`
- `updated_at`

---

## 7.2 Table `clubs`
Champs :
- `id`
- `name`
- `is_host_club`
- `created_at`
- `updated_at`

---

## 7.3 Table `sections`
Champs :
- `id`
- `name`
- `created_at`
- `updated_at`

Valeurs prévues :
- Apnéistes
- Plongeurs
- Chasseurs
- Hockeyeurs

---

## 7.4 Table `swimmers`
Champs :
- `id`
- `challenge_id`
- `number`
- `first_name`
- `last_name`
- `email`
- `club_id`
- `section_id`
- `created_at`
- `updated_at`

Contraintes :
- unicité sur `(challenge_id, number)`
- `section_id` nullable

---

## 7.5 Table `lanes`
Table de configuration des lignes générées automatiquement.

Champs :
- `id`
- `challenge_id`
- `code`
- `distance_m`
- `display_order`
- `is_active`

Contraintes :
- unicité sur `(challenge_id, code)`

---

## 7.6 Table `rounds`
Table des tournées générées automatiquement.

Champs :
- `id`
- `challenge_id`
- `round_number`
- `label`
- `scheduled_time`
- `display_order`

Contraintes :
- unicité sur `(challenge_id, round_number)`

---

## 7.7 Table `sheets`
Une ligne = une feuille papier.

Champs :
- `id`
- `challenge_id`
- `round_id`
- `lane_id`
- `status`
- `entered_by`
- `validated_at`
- `created_at`
- `updated_at`

Contraintes :
- unicité sur `(challenge_id, round_id, lane_id)`

---

## 7.8 Table `sheet_entries`
Une ligne = un nageur sur une feuille.

Champs :
- `id`
- `sheet_id`
- `swimmer_id`
- `squares`
- `ticks`
- `total_lengths`
- `distance_m`
- `created_at`
- `updated_at`

Règles :
- `squares >= 0`
- `ticks >= 0`
- calcul automatique de `total_lengths`
- calcul automatique de `distance_m`

---

## 8. Règles d’interface importantes

### 8.1 Performance de saisie
L’appli doit privilégier la vitesse :
- peu de clics
- champs clairs
- erreurs explicites
- saisie clavier fluide

### 8.2 Recherche nageur
Quand on tape le numéro nageur :
- retrouver immédiatement le nageur
- afficher nom/prénom
- afficher club / section si présents
- bloquer si numéro inexistant

### 8.3 Résumé feuille
Avant validation, afficher :
- tournée
- ligne
- distance de ligne
- nombre de nageurs saisis
- total mètres de la feuille

### 8.4 Messages
Prévoir messages simples :
- feuille déjà chargée
- nageur introuvable
- feuille validée avec succès
- modification enregistrée
- ligne supprimée

---

## 9. Stack technique demandée

### Technologies
- Next.js
- TypeScript
- React
- PostgreSQL
- Prisma ORM
- hébergement Vercel
- base Supabase PostgreSQL

### UI
UI simple, propre, rapide.
Pas de design complexe.
Priorité à la lisibilité.

---

## 10. Authentification

Pour la V1+, rester simple.

### Besoin minimal
- une page de connexion simple pour les saisisseurs / admins
- un accès protégé pour :
  - configuration événement
  - gestion nageurs
  - saisie feuilles
  - contrôle
- un accès public lecture seule pour l’écran public

---

## 11. Contraintes non fonctionnelles

- application accessible depuis plusieurs ordinateurs en même temps
- une seule base distante partagée
- données centralisées
- pas de doublons de feuilles
- rafraîchissement du tableau public sans action manuelle
- interface utilisable sur ordinateur portable
- réutilisable pour les éditions futures

---

## 12. Hors périmètre V1+

Ne pas développer dans cette version :
- application mobile dédiée
- saisie en direct depuis le bord du bassin
- système de rôles avancé
- audit complet des modifications
- statistiques avancées très détaillées
- notifications temps réel complexes
- multi-challenges simultanés sophistiqués
- impression automatique des feuilles papier

---

## 13. Parcours utilisateur attendus

### 13.1 Avant le challenge
1. créer un événement
2. configurer l’événement
3. générer les lignes
4. générer les tournées
5. créer les clubs
6. créer les sections
7. enregistrer les nageurs

### 13.2 Pendant le challenge
1. ouvrir l’écran de saisie
2. choisir tournée + ligne
3. charger la feuille si elle existe déjà
4. saisir / modifier les lignes nageurs
5. valider la feuille
6. passer à la feuille suivante
7. consulter l’écran public mis à jour

### 13.3 En cas d’erreur
1. ouvrir l’écran contrôle
2. retrouver la feuille
3. modifier ou supprimer une ligne
4. recalcul automatique des totaux

### 13.4 Après le challenge
1. consulter le classement final
2. consulter les statistiques par club / section
3. afficher le total final de l’événement
4. exporter les résultats

---

## 14. Requêtes / calculs attendus

L’application doit fournir :

- total général de l’événement
- total par nageur
- total par nageur sur 25 m
- total par nageur sur 50 m
- meilleur nageur 25 m
- meilleur nageur 50 m
- top 3 général
- total par feuille
- nombre de feuilles validées
- total par club
- nombre de nageurs par club
- total par section
- nombre de nageurs par section

---

## 15. Données de test à prévoir

Créer des données de démonstration :
- 1 événement
- configuration :
  - début
  - durée
  - nombre de tournées
  - nombre de lignes 25
  - nombre de lignes 50
- 1 club organisateur
- 2 ou 3 clubs extérieurs
- sections :
  - Apnéistes
  - Plongeurs
  - Chasseurs
  - Hockeyeurs
- 20 nageurs
- plusieurs feuilles avec entrées fictives

---

## 16. Livrables demandés à Codex

Codex doit produire :

1. le projet Next.js complet
2. le schéma Prisma
3. les migrations BDD
4. les pages principales
5. les composants de saisie
6. les API routes / server actions nécessaires
7. les calculs de classement
8. les calculs par club et par section
9. la configuration événement
10. la génération automatique des lignes et tournées
11. l’édition de feuille existante
12. les exports CSV
13. un README d’installation
14. un README de déploiement Vercel + Supabase

---

## 17. Priorité de développement

### Priorité 1
- structure projet
- BDD
- configuration événement
- génération lignes / tournées
- gestion clubs
- gestion sections
- gestion nageurs

### Priorité 2
- saisie de feuille
- chargement feuille existante
- modification / suppression de lignes
- validation
- calcul automatique

### Priorité 3
- écran contrôle
- tableau de bord résultats

### Priorité 4
- stats clubs / sections
- écran public

### Priorité 5
- export CSV
- finitions

---

## 18. Prompt final résumé pour Codex

Tu peux aussi joindre ce bloc à Codex :

```text
Développe une application web V1+ en Next.js + TypeScript + PostgreSQL + Prisma pour un challenge piscine.

Contexte :
- L’application gère un événement configurable.
- Un événement possède :
  - un nom
  - une date
  - une heure de début
  - une durée
  - un nombre de tournées
  - un nombre de lignes 25 m
  - un nombre de lignes 50 m
- Les lignes doivent être générées automatiquement.
- Les tournées doivent être générées automatiquement entre l’heure de début et l’heure de fin.
- Des nageurs sont enregistrés avec numéro, prénom, nom, mail, club et éventuellement section.
- Les clubs permettent de distinguer le club organisateur et les clubs extérieurs.
- Les sections prévues sont : Apnéistes, Plongeurs, Chasseurs, Hockeyeurs.
- Chaque feuille correspond à une tournée et une ligne.
- Sur une feuille, on saisit plusieurs nageurs.
- Pour chaque nageur : numéro nageur, carrés, traits.
- Règle : 1 carré = 4 longueurs, 1 trait = 1 longueur.
- Calcul : total_longueurs = carrés * 4 + traits.
- Distance = total_longueurs * distance_de_la_ligne.
- Une feuille est unique par challenge + tournée + ligne.
- Si une feuille existe déjà, il faut la charger avec ses lignes existantes et permettre modification / suppression / ajout.
- Il faut un écran de configuration événement.
- Il faut un écran de gestion des nageurs.
- Il faut un écran de saisie / édition de feuille.
- Il faut un écran de contrôle.
- Il faut un tableau de bord résultats.
- Il faut un écran public affichant la distance totale cumulée.
- Il faut des statistiques simples par club et par section.
- UI simple, rapide, pensée pour ordinateur portable.
