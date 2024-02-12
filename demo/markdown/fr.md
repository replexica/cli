# stringyfy

## Description

`stringyfy` est une simple bibliothèque npm qui fournit un ensemble de fonctions utilitaires pour manipuler et transformer des chaînes de caractères en JavaScript. Elle est légère, facile à utiliser et ne nécessite aucune dépendance.

## Installation

Pour installer `stringyfy`, utilisez la commande suivante :

```bash
npm install stringyfy
```

## Utilisation

Voici un exemple simple d'utilisation de `stringyfy` :

```javascript
const stringyfy = require('stringyfy');

let str = "Hello, World!";

let result = stringyfy.reverse(str);

console.log(result); // Résultat : "!dlroW ,olleH"
```

## API

### `reverse(str)`

Inverse la chaîne de caractères donnée.

### `capitalize(str)`

Met en majuscule la première lettre de la chaîne de caractères donnée.

### `lowercase(str)`

Convertit tous les caractères de la chaîne de caractères donnée en minuscules.

### `uppercase(str)`

Convertit tous les caractères de la chaîne de caractères donnée en majuscules.

## Contribuer

Les pull requests sont les bienvenues. Pour les changements majeurs, veuillez d'abord ouvrir une issue pour discuter de ce que vous souhaitez modifier.

## Licence

MIT
