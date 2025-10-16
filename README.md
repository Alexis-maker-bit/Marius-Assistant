# Loom Chatbot - Ultra Responsive Version 7.18

Plugin WordPress de chatbot IA ultra-responsive avec support complet pour tous les appareils.

## 🎯 Caractéristiques de responsivité

### 📱 Support Mobile
- **Design mobile-first** avec interface plein écran sur smartphones
- **Gestion du clavier virtuel** (iOS et Android)
  - Détection automatique de l'ouverture du clavier
  - Ajustement dynamique de l'interface
  - Scroll automatique pour garder l'input visible
- **Mode minimisé en bouton flottant** sur mobile
- **Cibles tactiles optimisées** (minimum 44x44px)
- **Support des encoches** (iPhone X et plus récents)
- **Zones sûres** (safe areas) respectées

### 🖥️ Support Desktop
- Interface compacte dans un coin de l'écran
- Largeur et hauteur adaptatives selon la résolution
- Hover effects pour une meilleure UX

### 📲 Support Tablette
- Design adaptatif entre mobile et desktop
- Support mode portrait et paysage
- Interface optimisée pour les écrans moyens (768px-1024px)

### 🔄 Détection d'appareil avancée
- Détection du type d'appareil (mobile/tablette/desktop)
- Détection des capacités tactiles
- Support de l'API Visual Viewport (moderne)
- Fallbacks pour navigateurs anciens
- Détection de l'orientation (portrait/paysage)
- Adaptation en temps réel aux changements d'orientation

## 📐 Breakpoints responsifs

```css
Mobile: < 768px (plein écran)
Tablette portrait: 768px - 1024px (420px width)
Tablette paysage: 1025px - 1366px (440px width)
Desktop: > 1366px (460px width)
```

## 🎨 Caractéristiques CSS

- **Mobile-first approach**
- **Flexbox layouts** pour une flexibilité maximale
- **Media queries** pour tous les breakpoints
- **Support du mode sombre** (prefers-color-scheme)
- **Animations réduites** (prefers-reduced-motion)
- **Support Retina** (high DPI displays)
- **Safe areas CSS** pour appareils avec encoche
- **Touch-friendly** avec désactivation des effets hover sur tactile

## 🔧 Compatibilité navigateurs

✅ Chrome/Edge (desktop & mobile)
✅ Firefox (desktop & mobile)
✅ Safari (iOS 12+, macOS)
✅ Samsung Internet
✅ Opera
✅ Brave

### Fallbacks inclus
- Visual Viewport API → Window resize events
- Screen Orientation API → orientationchange event
- Modern CSS → Graceful degradation

## 📊 Statistiques collectées

Le plugin collecte des statistiques anonymes pour améliorer l'expérience :
- Type d'appareil (mobile/desktop)
- Résolution viewport
- Support tactile
- Orientation écran
- Support Visual Viewport

Ces données sont visibles dans l'interface admin WordPress.

## 🚀 Installation

1. Uploadez le plugin dans `/wp-content/plugins/`
2. Activez le plugin dans WordPress
3. Configurez les clés API Google Gemini
4. Le chatbot apparaît automatiquement sur toutes les pages (sauf checkout)

## 🎯 Tests recommandés

### Devices à tester
- iPhone (Safari) - anciennes et nouvelles versions
- Android phones (Chrome)
- iPad (Safari) - portrait et paysage
- Tablettes Android
- Ordinateurs de bureau

### Scénarios de test
1. Ouverture/fermeture du chatbot
2. Envoi de messages avec clavier virtuel ouvert
3. Rotation de l'écran pendant utilisation
4. Upload d'images
5. Scroll des messages
6. Clic sur cartes produits
7. Changement de fenêtre/onglet

## 🔐 Sécurité

- Validation AJAX avec nonces WordPress
- Sanitization de toutes les entrées
- Validation des uploads d'images
- Échappement de toutes les sorties HTML

## 📝 Structure des fichiers

```
loom-chatbot/
├── loom-chatbot.php          # Plugin principal
├── Parsedown.php              # Parser Markdown
├── css/
│   └── loom-chatbot-style.css # Styles responsifs
├── js/
│   ├── loom-chatbot-script.js # Script frontend
│   └── loom-chatbot-admin.js  # Script admin
├── images/
│   ├── taupier-quicktaupe-assistant-ia.png
│   └── envoyer-message.png
└── sources/
    └── knowledge-base.txt     # Base de connaissances (optionnel)
```

## 🐛 Debug

Pour activer le mode debug, ajoutez dans `wp-config.php` :
```php
define('WP_DEBUG', true);
```

Les logs apparaîtront dans la console du navigateur.

## 📞 Support

Version: 7.18
Auteur: Urooj Shafait (Optimisé par Gemini + Claude)
Company: LoomVision
License: GPL2

## 🎉 Nouveautés v7.18

- ✅ Responsivité complète tous appareils
- ✅ Gestion avancée du clavier virtuel
- ✅ Support des encoches iPhone X+
- ✅ Détection d'appareil robuste
- ✅ Fallbacks pour anciens navigateurs
- ✅ Mode sombre automatique
- ✅ Animations réduites pour accessibilité
- ✅ Touch-friendly sur tous appareils
- ✅ Statistiques par type d'appareil
