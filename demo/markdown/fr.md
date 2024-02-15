# stringyfy

## Description

`stringyfy` est une bibliothèque npm simple offrant un ensemble de fonctions utilitaires pour manipuler et transformer des chaînes de caractères en JavaScript. Elle est légère, facile à utiliser et ne dépend d'aucune autre bibliothèque.

## Installation

Pour installer `stringyfy`, utilisez la commande suivante :

```bash
npm install stringyfy
```

## Utilisation

Voici un exemple simple d'utilisation de `stringyfy` :

```javascript
const stringyfy = require('stringyfy');

let str = "Bonjour, le monde !";

let result = stringyfy.reverse(str);

console.log(result); // Affiche : "! ednom el ,ruojnoB"
```

## API

### `reverse(str)`

Inverse la chaîne de caractères donnée.

### `capitalize(str)`

Met en majuscule la première lettre de la chaîne donnée.

### `lowercase(str)`

Convertit tous les caractères de la chaîne donnée en minuscules.

### `uppercase(str)`

Convertit tous les caractères de la chaîne donnée en majuscules.

## Contribution

Les pull requests sont les bienvenues. Pour les changements majeurs, veuillez ouvrir un problème d'abord pour discuter de ce que vous souhaitez modifier.

## Licence

MIT
