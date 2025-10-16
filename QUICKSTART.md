# Quick Start Guide - Loom Chatbot v7.18

Guide rapide pour installer et tester le plugin ultra-responsive.

## 📦 Installation Express (5 minutes)

### 1. Upload sur WordPress

```bash
# Zipper le plugin
cd /path/to/Marius-Assistant
zip -r loom-chatbot.zip . -x "*.git*" "test-*" "README.md" "TESTING.md" "CHANGELOG.md"

# Ou via GitHub
git clone https://github.com/Alexis-maker-bit/Marius-Assistant.git
```

### 2. Activation WordPress

1. WordPress Admin → Plugins → Add New → Upload
2. Uploader `loom-chatbot.zip`
3. Activer le plugin
4. Aller dans Settings → Loom Chatbot
5. Entrer au moins une clé API Google Gemini

### 3. Test Rapide

Ouvrir n'importe quelle page du site (sauf checkout):
- ✅ Le chatbot doit apparaître en bas à droite
- ✅ Cliquer pour ouvrir
- ✅ Tester un message

## 🧪 Test Responsive en 2 minutes

### Option 1: Avec test-responsive.html (Local)

```bash
# Ouvrir directement dans le navigateur
open test-responsive.html
# ou
firefox test-responsive.html
```

Tester avec DevTools:
- F12 → Toggle Device Toolbar (Ctrl+Shift+M)
- Tester différentes tailles

### Option 2: Sur site WordPress

1. Ouvrir le site sur mobile
2. Vérifier que le chatbot est en plein écran
3. Tester le clavier virtuel
4. Faire une rotation d'écran

## 🔑 Obtenir une clé API Google Gemini

1. Aller sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Créer un nouveau projet
3. Générer une clé API
4. Copier la clé
5. Coller dans WordPress Admin → Settings → Loom Chatbot

## 📱 Test sur Vrais Appareils

### iPhone (Safari)
```
1. Ouvrir Safari
2. Aller sur votre site
3. Tester l'ouverture du chatbot
4. Taper un message (le clavier doit s'adapter)
5. Faire une rotation portrait ↔ paysage
```

### Android (Chrome)
```
1. Ouvrir Chrome
2. Aller sur votre site
3. Même tests qu'iPhone
4. Vérifier la barre de navigation système
```

## 🎯 Checklist de Validation (30 secondes)

Sur mobile:
- [ ] Bouton flottant visible quand minimisé
- [ ] Ouverture en plein écran
- [ ] Clavier virtuel n'obstrue pas l'input
- [ ] Rotation d'écran fonctionne
- [ ] Messages scrollent correctement

Sur desktop:
- [ ] Chatbot en bas à droite
- [ ] Taille correcte (~460px width)
- [ ] Hover effects fonctionnent
- [ ] Scroll fluide

## 🐛 Troubleshooting Express

### Le chatbot n'apparaît pas
```
1. Vérifier que le plugin est activé
2. Vérifier que vous n'êtes pas sur la page checkout
3. Ouvrir la console (F12) et chercher des erreurs
4. Vider le cache WordPress
```

### Le chatbot n'est pas responsive
```
1. Vider le cache du navigateur (Ctrl+F5)
2. Vérifier que les fichiers CSS/JS sont chargés:
   - DevTools → Network → Filtrer "loom-chatbot"
3. Vérifier les permissions des fichiers (755 pour dossiers, 644 pour fichiers)
```

### Le clavier virtuel pose problème
```
1. Vérifier la version du navigateur (iOS 12+, Android 5+)
2. Tester sur un autre navigateur
3. Activer le debug mode:
   - wp-config.php: define('WP_DEBUG', true);
4. Consulter les logs dans la console
```

### Messages d'erreur API
```
1. Vérifier la clé API Google dans Settings
2. Vérifier les quotas API sur Google Cloud Console
3. Essayer avec une autre clé API (le plugin supporte 5 clés)
4. Consulter les logs WordPress
```

## 🔧 Configuration Avancée

### Modifier les breakpoints

Éditer `css/loom-chatbot-style.css`:

```css
/* Changer le breakpoint mobile */
@media screen and (max-width: 767px) { /* Modifier ici */ }

/* Changer le breakpoint tablette */
@media screen and (min-width: 768px) and (max-width: 1024px) { }
```

### Désactiver sur certaines pages

Éditer `loom-chatbot.php`:

```php
public function auto_display_chatbot() {
    if (is_admin()) return;
    if ($this->is_checkout_page()) return;
    
    // Ajouter vos conditions ici
    if (is_page('contact')) return; // Exemple
    
    echo $this->register_shortcode();
}
```

### Personnaliser les couleurs

Éditer `css/loom-chatbot-style.css`:

```css
/* Couleur principale */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
/* Changer #667eea et #764ba2 */

/* Couleur des messages bot */
.bot-message {
    background: #ffffff; /* Changer ici */
}
```

## 📊 Monitoring & Analytics

### Consulter les statistiques

WordPress Admin → Conversations Bot:
- Total conversations
- Par type d'appareil (mobile/desktop)
- Avec images
- Export CSV disponible

### Debug Mode

Activer dans `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

Logs dans: `wp-content/debug.log`

Console navigateur: Messages préfixés `[Loom Chatbot]`

## 🚀 Optimisations Recommandées

### Cache
```
Plugins recommandés:
- WP Rocket (cache + minification)
- Autoptimize (CSS/JS optimization)
- W3 Total Cache (alternative)
```

### CDN
```
- Cloudflare (gratuit)
- StackPath
- KeyCDN
```

### Images
```
Optimiser images/ avec:
- TinyPNG
- ImageOptim
- ShortPixel
```

## 📚 Ressources

- **Documentation complète:** [README.md](README.md)
- **Guide de test:** [TESTING.md](TESTING.md)
- **Historique des versions:** [CHANGELOG.md](CHANGELOG.md)
- **Fichier de test:** [test-responsive.html](test-responsive.html)

## 🆘 Support

### Communauté
- GitHub Issues pour bugs
- GitHub Discussions pour questions

### Commercial
- Email: support@loomvision.com (si disponible)
- Site web: https://loomvision.com (si disponible)

## ⚡ Prêt à l'emploi!

Le plugin est maintenant configuré et ultra-responsive.

**Prochaines étapes recommandées:**
1. ✅ Tester sur plusieurs appareils
2. ✅ Configurer la base de connaissances
3. ✅ Ajouter des produits WooCommerce
4. ✅ Personnaliser les couleurs si souhaité
5. ✅ Monitorer les conversations

**Enjoy! 🎉**
