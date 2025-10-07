
# O-chat

Ce projet est une application web développée avec **Svelte** et **Vite**.
Elle permet d’afficher du contenu en Markdown et de générer une interface, déployée sur GitHub Pages.

---

## Démarrer le projet

### Installation

Clonez le dépôt et installez les dépendances :

```bash
git clone https://github.com/YannMOTTOLA/O-chat.git
cd O-chat
npm install
```

### Lancer le serveur de développement

```bash
npm run dev
```

Ouvrez [http://localhost:5173](http://localhost:5173) dans votre navigateur pour voir le résultat.

---

## Scripts disponibles

Dans le projet, vous pouvez exécuter les commandes suivantes :

| Commande          | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `npm run dev`     | Lance le serveur de développement                            |
| `npm run build`   | Crée la version de production dans le dossier `dist`         |
| `npm run preview` | Lance un serveur local pour prévisualiser la version buildée |
| `npm run deploy`  | Déploie automatiquement sur GitHub Pages                     |

---

## Structure du projet

* `src/` : composants et fichiers sources Svelte
* `public/` : fichiers statiques
* `vite.config.js` : configuration de Vite
* `svelte.config.js` : configuration Svelte
* `package.json` : scripts et dépendances

---

## En savoir plus

Pour plus d’informations sur **Svelte** et **Vite** :

* [Documentation Svelte](https://svelte.dev/docs)
* [Documentation Vite](https://vitejs.dev/guide/)

---

Ce projet est déployé sur :
**[https://YannMOTTOLA.github.io/O-chat/](https://YannMOTTOLA.github.io/O-chat/)**

