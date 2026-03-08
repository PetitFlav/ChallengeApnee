# SPEC.md

# Cahier des charges V1 — Application web de saisie des distances du challenge

## 1. Objectif

Créer une **application web simple, rapide et réutilisable** pour un challenge piscine annuel.

L’application doit permettre :

- d’enregistrer les nageurs en début d’événement,
- de gérer les clubs et les sections des nageurs,
- de saisir rapidement les feuilles papier de comptage récupérées pendant le challenge,
- de calculer automatiquement les distances nagées,
- d’éviter les doublons de saisie,
- de consulter les résultats provisoires et finaux,
- d’afficher en direct le total global sur un écran séparé,
- de produire des statistiques par club et par section.

Le challenge dure **2 heures** et comporte **4 tournées de ramassage** de feuilles, environ toutes les 30 minutes.

---

## 2. Contexte métier

### 2.1 Organisation terrain

- En bord de ligne, des bénévoles notent les longueurs sur des **petites feuilles papier**.
- Les nageurs annoncent leur **numéro unique**.
- Les bénévoles comptent les longueurs avec :
  - des **carrés**
  - des **traits**
- Règle de comptage :
  - **1 carré = 4 longueurs**
  - **1 trait = 1 longueur**

### 2.2 Types de lignes

Le bassin comporte :
- **4 lignes de 25 m**
- **4 à 6 lignes de 50 m**

Un nageur peut nager :
- sur du **25 m**
- sur du **50 m**
- et changer au cours du challenge

### 2.3 Ramassage / saisie

- Les feuilles sont ramassées à **4 tournées**.
- Une fois les feuilles récupérées, **1 ou 2 personnes** les saisissent sur ordinateur portable.
- La saisie se fait **feuille par feuille** :
  - on indique d’abord la **tournée**
  - puis la **ligne**
  - puis on saisit les nageurs présents sur cette feuille

---

## 3. Objectifs de la V1

La V1 doit être **fiable, simple, rapide**, sans fonctionnalités inutiles.

Fonctionnalités obligatoires :

1. gestion des nageurs
2. gestion des clubs
3. gestion des sections
4. saisie d’une feuille par tournée et ligne
5. calcul automatique des distances
6. validation d’une feuille complète
7. prévention des doublons de feuilles
8. consultation / contrôle des saisies
9. affichage public du total en direct
10. affichage du meilleur nageur 25 m et 50 m
11. statistiques par club et par section
12. export des résultats

---

## 4. Utilisateurs

### 4.1 Administrateur / organisateur
Peut :
- créer les nageurs
- modifier les nageurs
- créer / modifier les clubs
- créer / modifier les sections
- saisir les feuilles
- corriger les saisies
- voir les résultats
- afficher l’écran public

### 4.2 Saisisseur
Peut :
- saisir des feuilles
- consulter les saisies
- corriger si autorisé

### 4.3 Écran public
Affichage en lecture seule.

---

## 5. Règles métier

### 5.1 Nageur
Chaque nageur possède :
- un **numéro unique**
- un nom
- un prénom
- un mail
- un club
- éventuellement une section

Ce numéro est utilisé pendant tout le challenge.

### 5.2 Club
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

### 5.3 Section
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
- la section est donc **optionnelle**,
- le caractère **interne / extérieur** peut être déduit à partir du club.

### 5.4 Feuille
Une feuille correspond à :
- **une tournée**
- **une ligne**
- donc un **type de distance connu** : 25 m ou 50 m

Une feuille contient ensuite plusieurs lignes nageurs.

### 5.5 Calcul
Pour chaque nageur saisi sur une feuille :

- `total_longueurs = (nombre_carres × 4) + nombre_traits`
- `distance_m = total_longueurs × longueur_de_la_ligne`

Exemple :
- 9 carrés + 2 traits
- total longueurs = 9×4 + 2 = 38
- sur ligne 25 m = 950 m
- sur ligne 50 m = 1900 m

### 5.6 Anti-doublon
Il faut empêcher la double saisie d’une même feuille.

Règle V1 :
- une feuille est identifiée de manière unique par :
  - **challenge_id**
  - **tournée**
  - **ligne**

Donc une seule feuille validée possible pour un couple :
- tournée + ligne

Exemple :
- tournée 2 + ligne 25-3 = une seule feuille

Si tentative de ressaisie :
- afficher une alerte claire
- proposer consultation / modification de la feuille existante
- ne pas créer un doublon silencieux

---

## 6. Écrans à développer

## 6.1 Écran 1 — Gestion des nageurs

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

### Champs
- numéro nageur
- prénom
- nom
- mail
- club
- section (optionnelle)

### Comportement recommandé
- si le club sélectionné est le club organisateur, la section est activée,
- sinon la section peut être laissée vide ou désactivée.

### Contraintes
- numéro unique obligatoire
- mail obligatoire
- empêcher doublon sur le numéro

---

## 6.2 Écran 2 — Saisie d’une feuille

### Objectif
Saisir rapidement une feuille papier complète.

### Fonctionnement attendu

#### Étape A — ouverture de la feuille
Le saisisseur choisit :
- la **tournée** : 1, 2, 3 ou 4
- la **ligne**

Liste des lignes configurables :
- 25-1
- 25-2
- 25-3
- 25-4
- 50-1
- 50-2
- 50-3
- 50-4
- éventuellement 50-5
- éventuellement 50-6

À partir de la ligne, l’application déduit automatiquement :
- la distance de ligne : 25 m ou 50 m
- l’heure théorique de tournée

### Heures de tournée par défaut
Configurer :
- tournée 1
- tournée 2
- tournée 3
- tournée 4

Les libellés d’heure peuvent être paramétrables, mais pour la V1 il suffit d’un affichage type :
- T1
- T2
- T3
- T4

#### Étape B — saisie des nageurs de la feuille
Pour chaque ligne de la feuille papier, saisir :
- numéro nageur
- nombre de carrés
- nombre de traits

L’application doit afficher automatiquement :
- prénom + nom du nageur
- club
- section si présente
- total longueurs
- distance calculée

#### Étape C — validation de la feuille
Quand toute la feuille est saisie :
- bouton **Valider la feuille**
- enregistrement complet en base
- la feuille passe au statut **validée**
- possibilité ensuite de créer une nouvelle feuille

### Ergonomie attendue
L’écran doit être très rapide à utiliser :
- choix tournée + ligne en haut
- tableau de saisie dessous
- ajout de lignes nageurs une à une
- navigation clavier possible
- validation claire

### Contrôles
- si numéro nageur inexistant : erreur claire
- si carrés ou traits invalides : erreur claire
- si feuille déjà saisie : alerte et blocage
- afficher le total de la feuille avant validation

### Colonnes du tableau de saisie
- numéro nageur
- prénom / nom auto-affiché
- club
- section
- carrés
- traits
- total longueurs
- distance en mètres

---

## 6.3 Écran 3 — Contrôle des feuilles et corrections

### Objectif
Vérifier ce qui a été saisi et corriger en cas d’erreur.

### Fonctionnalités
- liste des feuilles saisies
- filtre par tournée
- filtre par ligne
- filtre par nageur
- filtre par club
- filtre par section
- ouverture d’une feuille pour visualisation
- modification d’une feuille validée
- suppression si nécessaire
- recalcul automatique après modification

### Affichage minimum
Pour chaque feuille :
- tournée
- ligne
- distance ligne
- nombre de nageurs saisis
- total mètres de la feuille
- statut
- date/heure de saisie
- saisi par

### Important
Les corrections doivent rester simples.
Pas besoin de journal d’audit complexe en V1.

---

## 6.4 Écran 4 — Résultats / tableau de bord interne

### Objectif
Voir les résultats provisoires pendant le challenge.

### Fonctionnalités
Afficher :
- distance totale du challenge
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
- **meilleur nageur 25 m** : nageur ayant le plus de mètres cumulés sur feuilles de lignes 25 m
- **meilleur nageur 50 m** : nageur ayant le plus de mètres cumulés sur feuilles de lignes 50 m

---

## 6.5 Écran 5 — Affichage public

### Objectif
Afficher sur un ordinateur ou écran séparé les informations du challenge en grand format.

### Affichage requis
- **distance totale cumulée** en très gros
- meilleur nageur 25 m
- meilleur nageur 50 m
- dernière mise à jour
- éventuellement top 3 général

### Contraintes UX
- très lisible
- gros chiffres
- peu d’informations
- rafraîchissement automatique

### Mise à jour
- rafraîchissement auto toutes les **5 à 10 secondes**
- pas besoin de websocket pour la V1

---

## 6.6 Export

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
Permet de réutiliser l’application chaque année.

Champs :
- `id`
- `name`
- `date`
- `duration_minutes`
- `created_at`

Exemple :
- Challenge Apnée 2026
- 21/03/2026
- 120 minutes

---

## 7.2 Table `clubs`
Champs :
- `id`
- `name`
- `is_host_club`
- `created_at`
- `updated_at`

Exemples :
- Club organisateur
- Club extérieur A
- Club extérieur B
- Indépendant / Sans club

Contraintes :
- nom unique

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

Contraintes :
- nom unique

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
- `section_id` peut être null

---

## 7.5 Table `lanes`
Table de configuration des lignes.

Champs :
- `id`
- `challenge_id`
- `code`
  exemples : `25-1`, `25-2`, `50-1`, `50-2`
- `distance_m`
  valeur : 25 ou 50
- `display_order`

Contraintes :
- unicité sur `(challenge_id, code)`

---

## 7.6 Table `rounds`
Table de configuration des tournées.

Champs :
- `id`
- `challenge_id`
- `round_number`
  1 à 4
- `label`
  exemple : `T1`
- `scheduled_time`
  optionnel
- `display_order`

Contraintes :
- unicité sur `(challenge_id, round_number)`

---

## 7.7 Table `sheets`
Une ligne = une feuille papier saisie.

Champs :
- `id`
- `challenge_id`
- `round_id`
- `lane_id`
- `status`
  valeurs : `draft`, `validated`
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
- feuille déjà saisie
- nageur introuvable
- feuille validée avec succès
- modification enregistrée

---

## 9. Stack technique demandée

## 9.1 Technologies
- **Next.js**
- **TypeScript**
- **React**
- **PostgreSQL**
- **Prisma ORM**
- **hébergement Vercel**
- **base Supabase PostgreSQL**

## 9.2 UI
UI simple, propre, rapide.
Pas de design complexe.
Priorité à la lisibilité.

### Bibliothèque UI possible
- Tailwind CSS
- composants simples
- tableau de saisie lisible

---

## 10. Authentification

Pour la V1, rester simple.

### Besoin minimal
- une page de connexion simple pour les saisisseurs / admins
- un accès protégé pour :
  - gestion nageurs
  - saisie feuilles
  - contrôle
- un accès public lecture seule pour l’écran public

### Option acceptable pour V1
Authentification simple par mot de passe admin unique ou comptes basiques.
Pas besoin d’un système complexe de rôles.

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

## 12. Hors périmètre V1

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

## 13.1 Avant le challenge
1. créer un challenge
2. configurer les lignes
3. configurer les 4 tournées
4. créer les clubs
5. créer les sections
6. enregistrer les nageurs

## 13.2 Pendant le challenge
1. ouvrir l’écran de saisie
2. choisir tournée + ligne
3. saisir les nageurs de la feuille
4. valider la feuille
5. passer à la feuille suivante
6. consulter l’écran public mis à jour

## 13.3 En cas d’erreur
1. ouvrir l’écran contrôle
2. retrouver la feuille
3. modifier ou supprimer
4. recalcul automatique des totaux

## 13.4 Après le challenge
1. consulter le classement final
2. consulter les statistiques par club / section
3. exporter les résultats

---

## 14. Requêtes / calculs attendus

L’application doit fournir :

- total général du challenge
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
- 1 challenge
- 4 tournées
- 4 lignes 25 m
- 6 lignes 50 m
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
9. les exports CSV
10. un README d’installation
11. un README de déploiement Vercel + Supabase

---

## 17. Priorité de développement

Ordre impératif :

### Priorité 1
- structure projet
- BDD
- gestion clubs
- gestion sections
- gestion nageurs

### Priorité 2
- saisie de feuille
- validation
- calcul automatique

### Priorité 3
- écran contrôle
- modification / suppression

### Priorité 4
- tableau de bord résultats
- stats clubs / sections
- écran public

### Priorité 5
- export CSV
- finitions

---

## 18. Prompt final résumé pour Codex

Tu peux aussi joindre ce bloc à Codex :

```text
Développe une application web V1 en Next.js + TypeScript + PostgreSQL + Prisma pour un challenge piscine.

Contexte :
- Des nageurs sont enregistrés au début avec un numéro unique, prénom, nom, mail, club et éventuellement section.
- Les clubs doivent permettre de distinguer le club organisateur et les clubs extérieurs.
- Les sections prévues sont : Apnéistes, Plongeurs, Chasseurs, Hockeyeurs.
- Pendant le challenge, des feuilles papier sont récupérées toutes les 30 minutes, soit 4 tournées au total.
- Chaque feuille correspond à une tournée et à une ligne.
- Les lignes peuvent être de 25 m ou 50 m.
- Codes de lignes attendus : 25-1 à 25-4, et 50-1 à 50-6.
- Sur une feuille, on saisit plusieurs nageurs.
- Pour chaque nageur, on saisit : numéro nageur, nombre de carrés, nombre de traits.
- Règle : 1 carré = 4 longueurs, 1 trait = 1 longueur.
- Calcul : total_longueurs = carrés * 4 + traits.
- Distance = total_longueurs * distance_de_la_ligne.
- Une feuille est unique par challenge + tournée + ligne.
- Il faut empêcher le doublon de feuille.
- Il faut un écran de gestion des nageurs.
- Il faut gérer les clubs et les sections.
- Il faut un écran de saisie d’une feuille complète.
- Il faut un écran de contrôle / correction des feuilles.
- Il faut un tableau de bord résultats.
- Il faut un écran public affichant en grand :
  - distance totale cumulée
  - meilleur nageur 25 m
  - meilleur nageur 50 m
  - dernière mise à jour
- Mise à jour de l’écran public par refresh auto toutes les 5 à 10 secondes.
- Il faut des exports CSV.
- Il faut aussi des statistiques simples par club et par section.
- UI simple, rapide, pensée pour ordinateur portable.
- Fournir schéma Prisma, migrations, pages, logique de calcul, seed de test, README installation et README déploiement sur Vercel + Supabase.
