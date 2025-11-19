# Better Timesheet

Une extension Chrome moderne pour suivre le temps passé sur vos projets et sites web.

## 🚀 Fonctionnalités

### Gestion de Projets
- **Créer des projets** pour organiser vos sites
- **Grouper des sites** par projet
- **Voir le temps total** par projet et par site
- **Ajouter des notes** à chaque projet (style post-it)

### Suivi du Temps
- **Tracking automatique** du temps passé sur chaque site
- **Support des wildcards** (ex: `google.com/*` pour tracker tous les sous-domaines)
- **Mise à jour en temps réel** toutes les 10 secondes
- **Sauvegarde périodique** pour éviter la perte de données

### Gestion des Sites
- **Ajouter manuellement** des sites à tracker
- **Renommer** les sites et projets
- **Supprimer** des sites ou projets
- **Mode édition** pour modifier facilement vos données

### Organisation de l'Interface
- **Accordéons repliables** pour chaque projet
- **Liste de sites masquable** dans chaque projet
- **État de l'UI persistant** (se souvient de ce qui est ouvert/fermé)
- **Thème sombre** moderne et élégant

### Outils de Gestion
- **Réinitialiser les temps** par projet ou globalement
- **Exporter/Importer** vos données en JSON
- **Lien rapide** vers votre feuille de temps (configurable)

## 📦 Installation

1. Clonez ou téléchargez ce repository
2. Ouvrez Chrome et allez sur `chrome://extensions/`
3. Activez le "Mode développeur" (en haut à droite)
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier `Better_timesheet`

## 🎯 Utilisation

### Premiers pas

1. **Ouvrez le side panel** en cliquant sur l'icône de l'extension
2. **Créez un projet** avec l'input en haut
3. **Ajoutez des sites** à tracker dans chaque projet

### Ajouter un site

- Ouvrez un projet (cliquez sur son nom)
- Dépliez la liste des sites si nécessaire
- Utilisez l'input en bas de la liste pour ajouter un site
- Exemples :
  - `github.com` - Track exactement github.com
  - `*.google.com` - Track tous les sous-domaines de Google
  - `https://example.com/*` - Track toutes les pages d'example.com

### Mode Édition

1. **Cliquez sur le crayon (✏️)** à côté du nom du projet
2. Le projet passe en mode édition (fond coloré)
3. **Cliquez sur un nom** (projet ou site) pour le renommer
4. Les **boutons de suppression (🗑️)** apparaissent
5. **Cliquez sur la coche (✓)** pour quitter le mode édition

### Ajouter des Notes

- Ouvrez un projet
- Utilisez la zone de texte jaune (style post-it) pour ajouter des notes
- Les notes sont sauvegardées automatiquement

### Réinitialiser les Temps

- **Par projet** : Bouton rouge en bas des notes du projet
- **Tous les temps** : Bouton orange en bas de l'interface

### Exporter/Importer

- **Export** : Sauvegarde toutes vos données en JSON
- **Import** : Restaure des données depuis un fichier JSON
- Utile pour sauvegarder ou partager vos configurations

### Lien Feuille de Temps

- **Clic gauche** : Ouvre l'URL configurée
- **Clic droit** : Configure l'URL de votre feuille de temps

## 🛠️ Technologies

- **Manifest V3** - Dernière version de l'API Chrome Extensions
- **Chrome Side Panel API** - Interface latérale moderne
- **Chrome Alarms API** - Sauvegarde périodique fiable
- **Chrome Storage API** - Stockage local des données
- **Vanilla JavaScript** - Pas de dépendances externes
- **CSS moderne** - Thème sombre avec variables CSS

## 📁 Structure du Projet

```
Better_timesheet/
├── manifest.json       # Configuration de l'extension
├── background.js       # Service worker (tracking du temps)
├── popup.html          # Interface du side panel
├── popup.css           # Styles de l'interface
├── popup.js            # Logique de l'interface
├── icon.png            # Icône de l'extension
└── README.md           # Ce fichier
```

## 🔧 Développement

### Débugger le Tracking

1. Allez sur `chrome://extensions/`
2. Trouvez "Better Timesheet"
3. Cliquez sur "service worker"
4. Consultez les logs `[TimeTracker]` dans la console

### Modifier l'Interface

- Éditez `popup.html`, `popup.css`, ou `popup.js`
- Rechargez l'extension dans `chrome://extensions/`
- Fermez et rouvrez le side panel pour voir les changements

## 📊 Stockage des Données

Les données sont stockées dans `chrome.storage.local` :

- **Sites** : `{ "site.com": 3600 }` (temps en secondes)
- **Projets** : `{ "__projects__": { "Mon Projet": ["site1.com", "site2.com"] } }`
- **Notes** : `{ "__notes__": { "Mon Projet": "Mes notes..." } }`
- **État UI** : `{ "__ui_state__": { "Mon Projet_open": true } }`
- **URL Timesheet** : `{ "__timesheet_url__": "https://..." }`

## 🎨 Personnalisation

### Changer les Couleurs

Éditez les variables CSS dans `popup.css` :

```css
:root {
  --bg-color: #1a1a1a;
  --card-bg: #2a2a2a;
  --primary-color: #6366f1;
  --text-color: #e0e0e0;
  /* ... */
}
```

### Changer la Fréquence de Rafraîchissement

Dans `popup.js`, ligne ~13 :
```javascript
setInterval(() => {
  location.reload();
}, 10000); // 10 secondes
```

## 🐛 Problèmes Connus

- Le tracking ne fonctionne que sur les sites ajoutés manuellement
- Le service worker peut s'endormir (utilise Alarms API pour compenser)
- Les wildcards utilisent une syntaxe simple (pas de regex complexe)

## 📝 Licence

Ce projet est libre d'utilisation et de modification.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

---

Développé avec ❤️ pour une meilleure gestion du temps
