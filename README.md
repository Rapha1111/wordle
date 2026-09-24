# LE MOT

Un clone du jeu **Wordle** en français, entièrement autonome (*standalone*) : aucun serveur, aucune base de données, aucune dépendance externe. Juste du HTML, CSS et JavaScript "vanilla".

## Jouer

Ouvrez simplement `index.html` dans un navigateur, ou servez le dossier avec n'importe quel serveur statique :

```bash
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

## Règles

Devinez le mot mystère de 5 lettres en 6 essais. Après chaque essai, chaque lettre est colorée :

- 🟩 **Vert** : la lettre est à la bonne position.
- 🟨 **Orange** : la lettre est dans le mot mais à une mauvaise position.
- ⬛ **Gris** : la lettre n'est pas dans le mot.

Un nouveau mot est **tiré au hasard** parmi plus de 500 mots possibles à chaque nouvelle partie (bouton "Nouvelle partie" ou rechargement).

## Fonctionnalités

- 929 mots français (5 lettres, sans accents) tirés au sort à chaque partie.
- Clavier virtuel AZERTY avec retour visuel des lettres essayées.
- Statistiques persistantes (parties jouées, % de victoires, séries) via `localStorage`.
- Mode difficile optionnel (réutiliser les indices révélés).
- Thème clair/sombre et palette adaptée au daltonisme.
- Partage du résultat façon Wordle (🟩🟨⬛) dans le presse-papiers.

## Structure

```
index.html   – structure de la page et des modales
style.css    – thème et mise en page
words.js     – liste des mots possibles
script.js    – logique du jeu
```

## Ajouter des mots

Éditez `words.js` : `WORDS` est un simple tableau de chaînes en majuscules, sans accents, de 5 lettres chacune.
