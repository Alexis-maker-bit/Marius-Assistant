<?php
/*
Plugin Name: Loom Chatbot (Version 7.18 - Responsivité Améliorée + Support Universel)
Description: Chatbot expert avec analyse d'images, responsivité complète et gestion avancée du clavier virtuel sur tous appareils.
Version: 7.18
Author: Urooj Shafait (Optimisé par Gemini + Claude)
Company: LoomVision
GitHub Plugin URI: Alexis-maker-bit/Marius-Assistant
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Text Domain: loom-chatbot
*/

// Sécurité
if (!defined('ABSPATH')) {
    exit;
}

final class Loom_Chatbot_Plugin {

    private static $instance;
    private static $parsedown; // Propriété pour stocker l'instance de Parsedown

    public static function get_instance() {
        if (!isset(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->add_hooks();
        $this->create_tables();
    }
     
    private function add_hooks() {
        add_action('init', [$this, 'start_session'], 1);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_shortcode('loom_chatbot', [$this, 'register_shortcode']);
        
        // Affichage automatique du chatbot
        add_action('wp_footer', [$this, 'auto_display_chatbot']);
        
        add_action('wp_ajax_loom_chatbot_respond', [$this, 'chatbot_respond']);
        add_action('wp_ajax_nopriv_loom_chatbot_respond', [$this, 'chatbot_respond']);
        add_action('wp_ajax_loom_chatbot_add_to_cart', [$this, 'add_to_cart_action']);
        add_action('wp_ajax_nopriv_loom_chatbot_add_to_cart', [$this, 'add_to_cart_action']);
        
        // Upload d'images
        add_action('wp_ajax_loom_chatbot_upload_image', [$this, 'handle_image_upload']);
        add_action('wp_ajax_nopriv_loom_chatbot_upload_image', [$this, 'handle_image_upload']);
        
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'settings_init']);
        add_action('admin_notices', [$this, 'admin_notices']);
        
        // AJAX pour la gestion des conversations
        add_action('wp_ajax_loom_chatbot_delete_conversation', [$this, 'delete_conversation']);
        add_action('wp_ajax_loom_chatbot_export_conversations', [$this, 'export_conversations']);
        add_action('wp_ajax_loom_chatbot_get_conversation_details', [$this, 'get_conversation_details']);
    }

    /**
     * Créer les tables nécessaires pour stocker les conversations
     */
    private function create_tables() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            session_id varchar(255) NOT NULL,
            user_id bigint(20) DEFAULT NULL,
            user_question text NOT NULL,
            bot_response longtext NOT NULL,
            user_ip varchar(45) DEFAULT NULL,
            user_agent text DEFAULT NULL,
            has_image tinyint(1) DEFAULT 0,
            image_data longtext DEFAULT NULL,
            device_info text DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY session_id (session_id),
            KEY user_id (user_id),
            KEY created_at (created_at),
            KEY has_image (has_image)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    /**
     * Enregistrer une conversation dans la base de données avec informations device
     */
    private function save_conversation_to_db($session_id, $user_id, $question, $response, $has_image = false, $image_data = null) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        
        // Collecter les informations sur l'appareil
        $device_info = json_encode([
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'viewport_width' => $_POST['viewport_width'] ?? null,
            'viewport_height' => $_POST['viewport_height'] ?? null,
            'is_mobile' => $_POST['is_mobile'] ?? null,
            'is_touch' => $_POST['is_touch'] ?? null,
            'screen_orientation' => $_POST['screen_orientation'] ?? null,
            'visual_viewport_supported' => $_POST['visual_viewport_supported'] ?? null
        ]);
        
        $wpdb->insert(
            $table_name,
            [
                'session_id' => $session_id,
                'user_id' => $user_id ?: null,
                'user_question' => $question,
                'bot_response' => $response,
                'user_ip' => $this->get_user_ip(),
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'has_image' => $has_image ? 1 : 0,
                'image_data' => $image_data,
                'device_info' => $device_info,
                'created_at' => current_time('mysql')
            ],
            ['%s', '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s']
        );
    }

    /**
     * Obtenir l'IP de l'utilisateur avec support des proxies
     */
    private function get_user_ip() {
        $ip_keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED', 'HTTP_X_CLUSTER_CLIENT_IP', 'HTTP_FORWARDED_FOR', 'HTTP_FORWARDED', 'REMOTE_ADDR'];
        
        foreach ($ip_keys as $key) {
            if (!empty($_SERVER[$key])) {
                $ips = explode(',', $_SERVER[$key]);
                $ip = trim($ips[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? '';
    }

    /**
     * Générer un ID de session unique
     */
    private function get_session_id() {
        if (!session_id()) {
            session_start();
        }
        
        if (!isset($_SESSION['loom_chatbot_session_id'])) {
            $_SESSION['loom_chatbot_session_id'] = uniqid('loom_', true);
        }
        
        return $_SESSION['loom_chatbot_session_id'];
    }

    /**
     * Vérifier si on est sur la page checkout
     */
    private function is_checkout_page() {
        // Si WooCommerce n'est pas actif, pas de page checkout
        if (!function_exists('is_checkout')) {
            return false;
        }
        
        // Vérifier si on est sur la page checkout de WooCommerce
        return is_checkout();
    }

    /**
     * Afficher automatiquement le chatbot sur toutes les pages (sauf checkout)
     */
    public function auto_display_chatbot() {
        // Ne pas afficher sur les pages admin
        if (is_admin()) {
            return;
        }
        
        // Ne pas afficher sur la page checkout
        if ($this->is_checkout_page()) {
            return;
        }
        
        // Afficher le chatbot
        echo $this->register_shortcode();
    }

    /**
     * Gérer l'upload d'images avec validation renforcée
     */
    public function handle_image_upload() {
        check_ajax_referer('loom_chatbot_nonce', 'security');
        
        if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            wp_send_json_error(['message' => 'Erreur lors de l\'upload de l\'image.']);
            return;
        }
        
        $file = $_FILES['image'];
        
        // Vérifications de sécurité renforcées
        $validation = $this->validate_uploaded_image($file);
        if (!$validation['valid']) {
            wp_send_json_error(['message' => $validation['error']]);
            return;
        }
        
        // Lire et encoder l'image
        $image_data = file_get_contents($file['tmp_name']);
        $base64_image = base64_encode($image_data);
        
        // Redimensionner si nécessaire (optionnel, pour économiser les tokens API)
        $resized_image = $this->resize_image($file['tmp_name'], $file['type']);
        if ($resized_image) {
            $base64_image = base64_encode($resized_image);
        }
        
        wp_send_json_success([
            'image_data' => $base64_image,
            'mime_type' => $file['type'],
            'file_size' => strlen($base64_image),
            'message' => 'Image uploadée avec succès!'
        ]);
    }

    /**
     * Validation renforcée des images uploadées
     */
    private function validate_uploaded_image($file) {
        // Vérifier le type de fichier
        $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!in_array($file['type'], $allowed_types)) {
            return ['valid' => false, 'error' => 'Type de fichier non supporté. Utilisez JPG, PNG, GIF ou WebP.'];
        }
        
        // Vérifier la taille (max 5MB)
        if ($file['size'] > 5 * 1024 * 1024) {
            return ['valid' => false, 'error' => 'L\'image est trop volumineuse. Maximum 5MB.'];
        }
        
        // Vérifier que c'est vraiment une image avec getimagesize
        $image_info = getimagesize($file['tmp_name']);
        if ($image_info === false) {
            return ['valid' => false, 'error' => 'Le fichier n\'est pas une image valide.'];
        }
        
        // Vérifier les dimensions minimales et maximales
        if ($image_info[0] < 50 || $image_info[1] < 50) {
            return ['valid' => false, 'error' => 'L\'image est trop petite (minimum 50x50 pixels).'];
        }
        
        if ($image_info[0] > 4000 || $image_info[1] > 4000) {
            return ['valid' => false, 'error' => 'L\'image est trop grande (maximum 4000x4000 pixels).'];
        }
        
        return ['valid' => true];
    }

    /**
     * Redimensionner l'image pour optimiser les appels API
     */
    private function resize_image($file_path, $mime_type, $max_width = 1024, $max_height = 1024) {
        try {
            switch ($mime_type) {
                case 'image/jpeg':
                    $source = imagecreatefromjpeg($file_path);
                    break;
                case 'image/png':
                    $source = imagecreatefrompng($file_path);
                    break;
                case 'image/gif':
                    $source = imagecreatefromgif($file_path);
                    break;
                case 'image/webp':
                    if (function_exists('imagecreatefromwebp')) {
                        $source = imagecreatefromwebp($file_path);
                    } else {
                        return false;
                    }
                    break;
                default:
                    return false;
            }
            
            if (!$source) return false;
            
            $width = imagesx($source);
            $height = imagesy($source);
            
            // Calculer les nouvelles dimensions
            if ($width <= $max_width && $height <= $max_height) {
                imagedestroy($source);
                return false; // Pas besoin de redimensionner
            }
            
            $ratio = min($max_width / $width, $max_height / $height);
            $new_width = round($width * $ratio);
            $new_height = round($height * $ratio);
            
            // Créer la nouvelle image
            $destination = imagecreatetruecolor($new_width, $new_height);
            
            // Préserver la transparence pour PNG et GIF
            if ($mime_type === 'image/png' || $mime_type === 'image/gif') {
                imagealphablending($destination, false);
                imagesavealpha($destination, true);
                $transparent = imagecolorallocatealpha($destination, 255, 255, 255, 127);
                imagefilledrectangle($destination, 0, 0, $new_width, $new_height, $transparent);
            }
            
            imagecopyresampled($destination, $source, 0, 0, 0, 0, $new_width, $new_height, $width, $height);
            
            // Capturer l'image en mémoire
            ob_start();
            switch ($mime_type) {
                case 'image/jpeg':
                    imagejpeg($destination, null, 85);
                    break;
                case 'image/png':
                    imagepng($destination);
                    break;
                case 'image/gif':
                    imagegif($destination);
                    break;
                case 'image/webp':
                    if (function_exists('imagewebp')) {
                        imagewebp($destination, null, 85);
                    }
                    break;
            }
            $image_data = ob_get_contents();
            ob_end_clean();
            
            imagedestroy($source);
            imagedestroy($destination);
            
            return $image_data;
            
        } catch (Exception $e) {
            error_log('Loom Chatbot - Erreur redimensionnement image: ' . $e->getMessage());
            return false;
        }
    }

    public function add_to_cart_action() {
        check_ajax_referer('loom_chatbot_nonce', 'security');
        if (!function_exists('WC') || !isset($_POST['product_id'])) {
            wp_send_json_error(['message' => 'Erreur de configuration.']);
            return;
        }
        $product_id = absint($_POST['product_id']);
        $product = wc_get_product($product_id);
        if (!$product || !$product->is_purchasable() || !$product->is_in_stock()) {
            wp_send_json_error(['message' => 'Ce produit ne peut pas être ajouté au panier.']);
            return;
        }
        $cart_item_key = WC()->cart->add_to_cart($product_id, 1);
        if ($cart_item_key) {
            wp_send_json_success(['message' => 'Produit ajouté avec succès.']);
        } else {
            wp_send_json_error(['message' => 'Impossible d\'ajouter le produit au panier.']);
        }
    }

    public function start_session() {
        if (!session_id()) {
            session_start();
        }
    }

    public function enqueue_scripts() {
        // Scripts pour le frontend (chatbot)
        if (!is_admin()) {
            // Vérifier si on n'est pas sur la page checkout
            if (!$this->is_checkout_page()) {
                wp_enqueue_script('loom-chatbot-script', plugin_dir_url(__FILE__) . 'js/loom-chatbot-script.js', ['jquery'], '7.18', true);
                wp_localize_script('loom-chatbot-script', 'loom_chatbot_obj', [
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('loom_chatbot_nonce'),
                    'debug' => defined('WP_DEBUG') && WP_DEBUG,
                    'max_file_size' => 5 * 1024 * 1024, // 5MB
                    'allowed_types' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                    'plugin_url' => plugin_dir_url(__FILE__),
                    'device_detection' => [
                        'breakpoint_mobile' => 768,
                        'breakpoint_tablet' => 1024,
                        'touch_detection' => true,
                        'orientation_support' => true,
                        'visual_viewport_fallback' => true
                    ]
                ]);
                wp_enqueue_style('loom-chatbot-styles', plugin_dir_url(__FILE__) . 'css/loom-chatbot-style.css', [], '7.18');
            }
        }
        
        // Scripts pour l'admin uniquement
        if (is_admin()) {
            $screen = get_current_screen();
            if ($screen && strpos($screen->id, 'loom_chatbot') !== false) {
                wp_enqueue_script('loom-chatbot-admin', plugin_dir_url(__FILE__) . 'js/loom-chatbot-admin.js', ['jquery'], '7.18', true);
                wp_localize_script('loom-chatbot-admin', 'loom_chatbot_admin_obj', [
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('loom_chatbot_nonce')
                ]);
            }
        }
    }

    public function register_shortcode() {
        ob_start();
        ?>
        <div class="loom-chatbot-container minimized">
             <div class="loom-chatbot-header">
                <div class="icon-container"><img src="<?php echo esc_url(plugin_dir_url(__FILE__)); ?>images/taupier-quicktaupe-assistant-ia.png" alt="Marius"></div>
                <div class="header-details">
                    <span class="header-title">Marius, Assistant taupier</span>
                    <div class="online-status"><div class="status-icon"></div><span><?php _e('En ligne', 'loom-chatbot'); ?></span></div>
                </div>
                <div class="minimize-button">&#x2212;</div>
            </div>
            <div class="loom-chatbot-body">
                <div class="loom-chatbot-messages" aria-live="polite">
                    <div class="bot-message"><p>Bonjour ! Je suis Marius, votre expert taupier. Comment puis-je vous aider ? Vous pouvez aussi m'envoyer une photo de votre jardin pour un diagnostic personnalisé !</p></div>
                </div>
                <div class="loom-chatbot-loading">
                    <div class="typing-indicator">
                        <div class="typing-avatar">
                            <img src="<?php echo esc_url(plugin_dir_url(__FILE__)); ?>images/taupier-quicktaupe-assistant-ia.png" alt="Marius">
                        </div>
                        <div class="typing-content">
                            <span class="typing-text">Marius analyse</span>
                            <div class="typing-dots">
                                <div class="typing-dot"></div>
                                <div class="typing-dot"></div>
                                <div class="typing-dot"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="loom-chatbot-footer">
                <div class="footer-input-wrapper">
                    <input id="loom-chatbot-input" type="text" placeholder="<?php esc_attr_e('Posez votre question...', 'loom-chatbot'); ?>" maxlength="500">
                    <input type="file" id="loom-chatbot-image-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display: none;">
                    <button id="loom-chatbot-photo-btn" type="button" title="<?php esc_attr_e('Envoyer une photo', 'loom-chatbot'); ?>">📷</button>
                    <button id="loom-chatbot-send" title="<?php esc_attr_e('Envoyer', 'loom-chatbot'); ?>">
                        <img src="<?php echo esc_url(plugin_dir_url(__FILE__)); ?>images/envoyer-message.png" alt="<?php esc_attr_e('Envoyer', 'loom-chatbot'); ?>" class="send-icon">
                    </button>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
     
    private function get_cached_response($question) {
        return get_transient('loom_chatbot_' . md5(strtolower(trim($question))));
    }
     
    private function set_cached_response($question, $answer) {
        set_transient('loom_chatbot_' . md5(strtolower(trim($question))), $answer, 24 * HOUR_IN_SECONDS);
    }

    private function get_fallback_api_keys() {
        $api_keys = array_filter([
            get_option('loom_chatbot_api_key'), get_option('loom_chatbot_api_key_2'), get_option('loom_chatbot_api_key_3'),
            get_option('loom_chatbot_api_key_4'), get_option('loom_chatbot_api_key_5')
        ]);
        if (empty($api_keys)) return false;
        $rotation_key = (date('H') * 60 + date('i')) % count($api_keys);
        $selected_key = $api_keys[array_keys($api_keys)[$rotation_key]];
        return ['primary' => $selected_key, 'fallbacks' => array_diff($api_keys, [$selected_key])];
    }
     
    public function chatbot_respond() {
        if (!check_ajax_referer('loom_chatbot_nonce', 'security', false)) {
            wp_send_json_error(['answer' => __('Erreur de sécurité.', 'loom-chatbot')]);
        }
        
        $question = isset($_POST['question']) ? sanitize_text_field(trim($_POST['question'])) : '';
        $has_image = isset($_POST['has_image']) && $_POST['has_image'] === 'true';
        $image_data = isset($_POST['image_data']) ? $_POST['image_data'] : '';
        $mime_type = isset($_POST['mime_type']) ? sanitize_text_field($_POST['mime_type']) : '';
        
        if (empty($question) && !$has_image) {
            wp_send_json_error(['answer' => __('Veuillez poser une question ou envoyer une image.', 'loom-chatbot')]);
        }
        
        $user_id = get_current_user_id();
        $session_id = $this->get_session_id();
        $conversation_history = $this->get_conversation_history($user_id);
        
        // Construire le message utilisateur
        $user_message_parts = [];
        
        if (!empty($question)) {
            $user_message_parts[] = ['text' => $question];
        }
        
        if ($has_image && !empty($image_data)) {
            $user_message_parts[] = [
                'inline_data' => [
                    'mime_type' => $mime_type,
                    'data' => $image_data
                ]
            ];
            
            // Si pas de question, ajouter un texte par défaut
            if (empty($question)) {
                $question = "Analyse de photo de jardin";
                $user_message_parts[] = ['text' => 'Analysez cette photo de mon jardin et donnez-moi des recommandations pour traiter les problèmes de taupes.'];
            }
        }
        
        $conversation_history[] = [
            'role' => 'user', 
            'parts' => $user_message_parts
        ];

        // Pour les images, ne pas utiliser le cache
        if (!$has_image) {
            $cached_answer = $this->get_cached_response($question);
            if ($cached_answer) {
                $this->save_conversation_to_db($session_id, $user_id, $question, $cached_answer, $has_image, $has_image ? $image_data : null);
                $this->update_and_send_response($cached_answer, $conversation_history, $user_id, $session_id, $question);
                return;
            }
        }
         
        $this->try_api_with_fallbacks($conversation_history, $user_id, $question, $session_id, $has_image, $has_image ? $image_data : null);
    }
     
    private function try_api_with_fallbacks($conversation_history, $user_id, $question, $session_id, $has_image = false, $image_data = null) {
        $api_keys_info = $this->get_fallback_api_keys();
        if (!$api_keys_info) {
            $response = "🔧 Service indisponible (pas de clé API).";
            $this->save_conversation_to_db($session_id, $user_id, $question, $response, $has_image, $image_data);
            $this->update_and_send_response($response, $conversation_history, $user_id, $session_id, $question);
            return;
        }
         
        $result = $this->try_single_api_call($conversation_history, $api_keys_info['primary']);
        if ($result['success']) {
            if (!$has_image) {
                $this->set_cached_response($question, $result['answer']);
            }
            $this->save_conversation_to_db($session_id, $user_id, $question, $result['answer'], $has_image, $image_data);
            $this->update_and_send_response($result['answer'], $conversation_history, $user_id, $session_id, $question);
            return;
        }
         
        foreach ($api_keys_info['fallbacks'] as $fallback_key) {
            $result = $this->try_single_api_call($conversation_history, $fallback_key);
            if ($result['success']) {
                if (!$has_image) {
                    $this->set_cached_response($question, $result['answer']);
                }
                $this->save_conversation_to_db($session_id, $user_id, $question, $result['answer'], $has_image, $image_data);
                $this->update_and_send_response($result['answer'], $conversation_history, $user_id, $session_id, $question);
                return;
            }
            usleep(100000);
        }
         
        $response = "🚨 Service temporairement surchargé. Veuillez réessayer.";
        $this->save_conversation_to_db($session_id, $user_id, $question, $response, $has_image, $image_data);
        $this->update_and_send_response($response, $conversation_history, $user_id, $session_id, $question);
    }
     
    private function get_woocommerce_products_context() {
        if (!function_exists('wc_get_products')) {
            return "NOTE : WooCommerce n'est pas actif.";
        }
        $products_context = "### CATALOGUE DE PRODUITS WOOCOMMERCE ###\n\n";
        $products = wc_get_products(['status' => 'publish', 'limit' => -1]);
        if (empty($products)) {
            return $products_context . "Aucun produit trouvé.\n\n";
        }
        foreach ($products as $product) {
            $clean_name = preg_replace('/[\r\n\t]+/', ' ', $product->get_name());
            $clean_desc = preg_replace('/[\r\n\t]+/', ' ', strip_tags($product->get_short_description() ?: $product->get_description()));
            $clean_price = preg_replace('/[\r\n\t]+/', ' ', strip_tags($product->get_price_html()));

            $products_context .= "--- DEBUT PRODUIT ---\n";
            $products_context .= "ID: " . $product->get_id() . "\n";
            $products_context .= "Nom: " . $clean_name . "\n";
            $products_context .= "Type: " . $product->get_type() . "\n";
            $products_context .= "Description: " . $clean_desc . "\n";
            $products_context .= "Prix: " . $clean_price . "\n";
            $products_context .= "URL: " . $product->get_permalink() . "\n";
            $products_context .= "URL_Image: " . wp_get_attachment_url($product->get_image_id()) . "\n";
            $products_context .= "--- FIN PRODUIT ---\n\n";
        }
        $products_context .= "### FIN DU CATALOGUE ###\n\n";
        return $products_context;
    }

    private function try_single_api_call($conversation_history, $api_key) {
        try {
            $knowledge_base_path = plugin_dir_path(__FILE__) . 'sources/knowledge-base.txt';
            $static_knowledge = file_exists($knowledge_base_path) ? file_get_contents($knowledge_base_path) : '';
            $product_knowledge = $this->get_woocommerce_products_context();
            $full_knowledge_base = $static_knowledge . "\n\n" . $product_knowledge;

            $system_instruction = "Tu es Marius, un expert taupier. Ton ton doit être celui d'une conversation humaine, amicale et experte.

**RÈGLES STRICTES :**
1. Base TOUTES tes réponses EXCLUSIVEMENT sur les informations du CONTEXTE. Utilise le format Markdown pour la mise en forme (gras, listes).
2. Donne toujours un maximum d'informations avant de proposer l'achat d'un produit. Tu dois délivrer un maximum de valeur gratuite ilustrée, avant de tenter une avance commerciale.
3. **RÈGLE ILLUSTRATION :** Si une phrase que tu utilises est associée à une balise `[image:URL]`, tu DOIS inclure cette balise exacte dans ta réponse, juste après la phrase concernée pour l'illustrer.
4. **TONE & STYLE :** Parle comme un humain. N'utilise JAMAIS de formatage de titre (comme `### Titre`). Intègre tes réponses naturellement dans des phrases fluides. Pour les listes à puces, utilise un tiret `-` au début de chaque ligne.
5. Pour les questions sur des produits, utilise le CATALOGUE. Pour présenter un produit, utilise la balise à 5 parties : `[product:ID|URL_Image|Nom|Prix|URL]`.
6. Si un utilisateur demande d'ajouter un produit au panier, vérifie son type. S'il est 'simple', réponds par une confirmation et utilise la balise d'action `[action:add_to_cart|ID_PRODUIT]`. S'il est 'variable', explique qu'il faut choisir une option et présente la carte produit.
7. Ne JAMAIS afficher une URL brute.
8. Si une liste est demandée, présente CHAQUE produit dans une carte `[product:...]` séparée.
9. Si la réponse ne se trouve pas dans le CONTEXTE, dis que tu n'as pas l'information.
10. Termine toujours par une question ouverte.

**ANALYSE D'IMAGES :**
Quand tu reçois une photo :
- Analyse attentivement l'image pour identifier les signes de présence de taupes (taupinières, galeries, dégâts aux pelouses, etc.)
- Évalue la gravité de l'infestation (légère, modérée, sévère)
- Identifie le type de terrain et la végétation
- Recommande des solutions spécifiques basées sur ton expertise
- Propose des produits adaptés de ton catalogue si pertinents
- Donne des conseils de prévention

CONTEXTE :
---
" . $full_knowledge_base . "
---";

            $api_url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' . $api_key;
            $body = [
                'contents' => $conversation_history,
                'systemInstruction' => ['parts' => [['text' => $system_instruction]]],
                'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 2048],
                'safetySettings' => [
                    ['category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_NONE'], 
                    ['category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_NONE'],
                    ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_NONE'], 
                    ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_NONE']
                ]
            ];
            $args = ['method' => 'POST', 'headers' => ['Content-Type' => 'application/json'], 'body' => json_encode($body), 'timeout' => 30];
            $response = wp_remote_post($api_url, $args);
             
            if (is_wp_error($response)) return ['success' => false];
            if (wp_remote_retrieve_response_code($response) !== 200) return ['success' => false];
            $decoded = json_decode(wp_remote_retrieve_body($response), true);
            if (!isset($decoded['candidates'][0]['content']['parts'][0]['text'])) return ['success' => false];
            $answer = trim($decoded['candidates'][0]['content']['parts'][0]['text']);
            if (empty($answer)) return ['success' => false];
             
            return ['success' => true, 'answer' => $answer];
             
        } catch (Exception $e) {
            error_log('Loom Chatbot API Error: ' . $e->getMessage());
            return ['success' => false];
        }
    }

    private function update_and_send_response($answer, $conversation_history, $user_id, $session_id = null, $question = null) {
        $action_to_send = null;
        $final_html = '';
     
        // Gérer les balises [action:...] qui n'ont pas de rendu visuel.
        $answer = preg_replace_callback('/\[action:(.*?)\]/is', function($matches) use (&$action_to_send) {
            $action_parts = explode('|', $matches[1]);
            if (count($action_parts) === 2 && $action_parts[0] === 'add_to_cart') {
                $action_to_send = ['type' => $action_parts[0], 'product_id' => $action_parts[1]];
            }
            return '';
        }, $answer);
     
        // Découper la réponse en segments.
        $segments = preg_split('/(\[image:.*?\]|\[product:.*?\])/is', $answer, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
     
        if (!empty($segments)) {
            $final_html .= '<div class="bot-message-group">';
     
            foreach ($segments as $segment) {
                $segment = trim($segment);
                if (empty($segment)) continue;
     
                if (preg_match('/\[image:(.*?)\]/is', $segment, $matches)) {
                    $imageUrl = esc_url($matches[1]);
                    $final_html .= '<div class="bot-message-photo"><img src="' . $imageUrl . '" alt="Illustration" class="chatbot-image"></div>';
                 
                } elseif (preg_match('/\[product:(.*?)\]/is', $segment, $matches)) {
                    $parts = explode('|', $matches[1]);
                    if (count($parts) === 5) {
                        $productId = esc_attr($parts[0]);
                        $imageUrl = esc_url($parts[1]);
                        $title = esc_html($parts[2]);
                        $price = esc_html($parts[3]);
                        $productUrl = esc_url($parts[4]);
                        $product = wc_get_product($productId);
                        if ($product) {
                            $card_actions = '';
                            if ($product->is_type('simple')) {
                                $card_actions = '<div class="product-card-actions"><button type="button" class="product-card-button primary add-to-cart-button" data-product-id="' . $productId . '">Ajouter au panier</button></div>';
                            } else {
                                $card_actions = '<div class="product-card-actions"><a href="' . $productUrl . '" target="_blank" rel="noopener noreferrer" class="product-card-button primary">Choisir une option</a></div>';
                            }
                            $final_html .= '<div class="bot-message-product"><div class="product-card"><a href="' . $productUrl . '" target="_blank" rel="noopener noreferrer" class="product-card-link-wrapper"><img src="' . $imageUrl . '" alt="' . $title . '" class="product-card-image"><div class="product-card-info"><h3 class="product-card-title">' . $title . '</h3><div class="product-card-price">' . $price . '</div></div></a>' . $card_actions . '</div></div>';
                        }
                    }
                 
                } else {
                    // Formatage du texte avec Parsedown
                    $segment_with_emoji = preg_replace('/^[\*\-]\s+/m', '👉 ', $segment);

                    if (!isset(self::$parsedown)) {
                        require_once plugin_dir_path(__FILE__) . 'Parsedown.php';
                        self::$parsedown = new Parsedown();
                        self::$parsedown->setSafeMode(true);
                    }
                     
                    $formatted_text = self::$parsedown->text($segment_with_emoji);
                     
                    $final_html .= '<div class="bot-message">' . $formatted_text . '</div>';
                }
            }
            $final_html .= '</div>';
        }
         
        $allowed_html = [
            'img'    => ['src' => [], 'alt' => [], 'class' => []],
            'div'    => ['class' => []],
            'h3'     => ['class' => []],
            'a'      => ['href' => [], 'target' => [], 'rel' => [], 'class' => []],
            'button' => ['type' => [], 'class' => [], 'data-product-id' => []],
            'br'     => [], 'p' => [], 'strong' => [], 'em' => [], 'ul' => [], 'ol' => [], 'li' => [],
        ];
        $sanitized_answer = wp_kses(trim($final_html), $allowed_html);
         
        $response_data = ['answer' => $sanitized_answer];
        if ($action_to_send) {
            $response_data['action'] = $action_to_send;
        }
     
        $conversation_history[] = ['role' => 'model', 'parts' => [['text' => $answer]]];
        $this->save_conversation_history($conversation_history, $user_id);
         
        wp_send_json_success($response_data);
        wp_die();
    }

    private function get_conversation_history($user_id) {
        if ($user_id > 0) return get_user_meta($user_id, 'loom_chatbot_conversation', true) ?: [];
        return $_SESSION['loom_chatbot_conversation'] ?? [];
    }

    private function save_conversation_history($history, $user_id) {
        $max_history_items = 20;
        if (count($history) > $max_history_items) {
            $history = array_slice($history, -$max_history_items);
        }
        if ($user_id > 0) {
            update_user_meta($user_id, 'loom_chatbot_conversation', $history);
        } else {
            $_SESSION['loom_chatbot_conversation'] = $history;
        }
    }

    public function add_admin_menu() {
        add_options_page('Loom Chatbot Settings', 'Loom Chatbot', 'manage_options', 'loom_chatbot', [$this, 'settings_page_html']);
        add_menu_page(
            'Conversations Chatbot',
            'Conversations Bot',
            'manage_options',
            'loom_chatbot_conversations',
            [$this, 'conversations_page_html'],
            'dashicons-format-chat',
            26
        );
    }

    /**
     * Page de gestion des conversations avec statistiques d'appareils
     */
    public function conversations_page_html() {
        if (!current_user_can('manage_options')) return;
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        
        // Pagination
        $per_page = 50;
        $current_page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $offset = ($current_page - 1) * $per_page;
        
        // Filtres
        $date_filter = isset($_GET['date_filter']) ? sanitize_text_field($_GET['date_filter']) : '';
        $search_filter = isset($_GET['search_filter']) ? sanitize_text_field($_GET['search_filter']) : '';
        $device_filter = isset($_GET['device_filter']) ? sanitize_text_field($_GET['device_filter']) : '';
        
        // Construction de la requête
        $where_conditions = ['1=1'];
        $where_values = [];
        
        if ($date_filter) {
            $where_conditions[] = 'DATE(created_at) = %s';
            $where_values[] = $date_filter;
        }
        
        if ($search_filter) {
            $where_conditions[] = '(user_question LIKE %s OR bot_response LIKE %s)';
            $where_values[] = '%' . $wpdb->esc_like($search_filter) . '%';
            $where_values[] = '%' . $wpdb->esc_like($search_filter) . '%';
        }
        
        if ($device_filter) {
            if ($device_filter === 'mobile') {
                $where_conditions[] = 'device_info LIKE %s';
                $where_values[] = '%"is_mobile":true%';
            } elseif ($device_filter === 'desktop') {
                $where_conditions[] = '(device_info LIKE %s OR device_info IS NULL)';
                $where_values[] = '%"is_mobile":false%';
            }
        }
        
        $where_clause = implode(' AND ', $where_conditions);
        
        // Compter le total
        $total_query = "SELECT COUNT(*) FROM $table_name WHERE $where_clause";
        if (!empty($where_values)) {
            $total_conversations = $wpdb->get_var($wpdb->prepare($total_query, $where_values));
        } else {
            $total_conversations = $wpdb->get_var($total_query);
        }
        
        // Récupérer les conversations
        $conversations_query = "SELECT * FROM $table_name WHERE $where_clause ORDER BY created_at DESC LIMIT %d OFFSET %d";
        $query_values = array_merge($where_values, [$per_page, $offset]);
        $conversations = $wpdb->get_results($wpdb->prepare($conversations_query, $query_values));
        
        // Calcul pagination
        $total_pages = ceil($total_conversations / $per_page);
        
        ?>
        <div class="wrap">
            <h1>💬 Conversations du Chatbot (v7.18)</h1>
            
            <!-- Statistiques avec infos appareils -->
            <div class="conversation-stats">
                <div class="stat-box">
                    <h3>📊 Statistiques générales</h3>
                    <p><strong>Total conversations:</strong> <?php echo number_format($total_conversations); ?></p>
                    <p><strong>Aujourd'hui:</strong> <?php echo $this->get_today_conversations_count(); ?></p>
                    <p><strong>Cette semaine:</strong> <?php echo $this->get_week_conversations_count(); ?></p>
                    <p><strong>Avec images:</strong> <?php echo $this->get_image_conversations_count(); ?></p>
                </div>
                <div class="stat-box">
                    <h3>📱 Statistiques appareils</h3>
                    <p><strong>Mobile:</strong> <?php echo $this->get_mobile_conversations_count(); ?></p>
                    <p><strong>Desktop:</strong> <?php echo $this->get_desktop_conversations_count(); ?></p>
                    <p><strong>Avec clavier virtuel:</strong> <?php echo $this->get_virtual_keyboard_conversations_count(); ?></p>
                </div>
            </div>
            
            <!-- Filtres étendus -->
            <form method="get" class="conversation-filters">
                <input type="hidden" name="page" value="loom_chatbot_conversations">
                <table class="form-table">
                    <tr>
                        <th>📅 Date:</th>
                        <td><input type="date" name="date_filter" value="<?php echo esc_attr($date_filter); ?>"></td>
                        <th>🔍 Recherche:</th>
                        <td><input type="text" name="search_filter" value="<?php echo esc_attr($search_filter); ?>" placeholder="Rechercher dans les questions/réponses..."></td>
                        <th>📱 Appareil:</th>
                        <td>
                            <select name="device_filter">
                                <option value="">Tous les appareils</option>
                                <option value="mobile" <?php selected($device_filter, 'mobile'); ?>>Mobile</option>
                                <option value="desktop" <?php selected($device_filter, 'desktop'); ?>>Desktop</option>
                            </select>
                        </td>
                        <td><input type="submit" value="Filtrer" class="button"></td>
                        <td><a href="<?php echo admin_url('admin.php?page=loom_chatbot_conversations'); ?>" class="button">Réinitialiser</a></td>
                    </tr>
                </table>
            </form>
            
            <!-- Actions groupées -->
            <div class="conversation-actions">
                <button id="export-conversations" class="button button-secondary">📤 Exporter (CSV)</button>
                <button id="delete-selected" class="button button-secondary" style="color: #d63638;">🗑️ Supprimer sélectionnés</button>
            </div>
            
            <!-- Liste des conversations -->
            <form id="conversations-form">
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <td class="check-column"><input type="checkbox" id="select-all"></td>
                            <th>📅 Date</th>
                            <th>👤 Utilisateur</th>
                            <th>❓ Question</th>
                            <th>🤖 Réponse</th>
                            <th>📷 Image</th>
                            <th>📱 Appareil</th>
                            <th>🌐 IP</th>
                            <th>⚡ Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (!empty($conversations)): ?>
                            <?php foreach ($conversations as $conversation): ?>
                                <?php 
                                $device_info = json_decode($conversation->device_info, true);
                                $is_mobile = isset($device_info['is_mobile']) ? $device_info['is_mobile'] : null;
                                $viewport_width = isset($device_info['viewport_width']) ? $device_info['viewport_width'] : null;
                                ?>
                                <tr>
                                    <th class="check-column">
                                        <input type="checkbox" name="conversation_ids[]" value="<?php echo $conversation->id; ?>">
                                    </th>
                                    <td><?php echo esc_html(mysql2date('d/m/Y H:i', $conversation->created_at)); ?></td>
                                    <td>
                                        <?php if ($conversation->user_id): ?>
                                            <?php 
                                            $user = get_user_by('id', $conversation->user_id);
                                            echo $user ? esc_html($user->display_name) : 'Utilisateur supprimé';
                                            ?>
                                        <?php else: ?>
                                            <em>Visiteur</em>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <div class="conversation-preview">
                                            <?php echo esc_html(wp_trim_words($conversation->user_question, 10)); ?>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="conversation-preview">
                                            <?php echo esc_html(wp_trim_words(strip_tags($conversation->bot_response), 10)); ?>
                                        </div>
                                    </td>
                                    <td>
                                        <?php if ($conversation->has_image): ?>
                                            <span class="image-indicator" title="Cette conversation contient une image">📷 Oui</span>
                                        <?php else: ?>
                                            <span style="color: #999;">Non</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <?php if ($is_mobile === true): ?>
                                            <span class="device-mobile" title="Conversation depuis mobile">📱 Mobile</span>
                                            <?php if ($viewport_width): ?>
                                                <br><small><?php echo $viewport_width; ?>px</small>
                                            <?php endif; ?>
                                        <?php elseif ($is_mobile === false): ?>
                                            <span class="device-desktop" title="Conversation depuis desktop">🖥️ Desktop</span>
                                            <?php if ($viewport_width): ?>
                                                <br><small><?php echo $viewport_width; ?>px</small>
                                            <?php endif; ?>
                                        <?php else: ?>
                                            <span style="color: #999;">Non détecté</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo esc_html($conversation->user_ip); ?></td>
                                    <td>
                                        <button type="button" class="button button-small view-conversation" 
                                                data-id="<?php echo $conversation->id; ?>">👁️ Voir</button>
                                        <button type="button" class="button button-small delete-conversation" 
                                                data-id="<?php echo $conversation->id; ?>" 
                                                style="color: #d63638;">🗑️</button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <tr>
                                <td colspan="9" style="text-align: center; padding: 20px;">
                                    <em>Aucune conversation trouvée.</em>
                                </td>
                            </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </form>
            
            <!-- Pagination -->
            <?php if ($total_pages > 1): ?>
                <div class="tablenav bottom">
                    <div class="tablenav-pages">
                        <?php
                        $pagination_args = [
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => '« Précédent',
                            'next_text' => 'Suivant »',
                            'current' => $current_page,
                            'total' => $total_pages
                        ];
                        echo paginate_links($pagination_args);
                        ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        
        <!-- Modal pour voir une conversation -->
        <div id="conversation-modal" class="conversation-modal" style="display: none;">
            <div class="conversation-modal-content">
                <div class="conversation-modal-header">
                    <h2>💬 Détails de la conversation</h2>
                    <span class="conversation-modal-close">&times;</span>
                </div>
                <div class="conversation-modal-body">
                    <!-- Le contenu sera chargé via AJAX -->
                </div>
            </div>
        </div>
        
        <style>
        .conversation-stats {
            background: #fff;
            border: 1px solid #ccd0d4;
            border-radius: 4px;
            padding: 20px;
            margin: 20px 0;
            display: flex;
            gap: 20px;
        }
        .stat-box {
            flex: 1;
        }
        .stat-box h3 {
            margin-top: 0;
            color: #1d2327;
        }
        .conversation-filters {
            background: #fff;
            border: 1px solid #ccd0d4;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
        .conversation-actions {
            margin: 10px 0;
        }
        .conversation-preview {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .device-mobile {
            color: #0073aa;
            font-weight: bold;
        }
        .device-desktop {
            color: #50575e;
            font-weight: bold;
        }
        .conversation-modal {
            position: fixed;
            z-index: 100000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        .conversation-modal-content {
            background-color: #fefefe;
            margin: 5% auto;
            padding: 0;
            border-radius: 8px;
            width: 80%;
            max-width: 800px;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .conversation-modal-header {
            padding: 20px;
            background: #f1f1f1;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .conversation-modal-header h2 {
            margin: 0;
        }
        .conversation-modal-close {
            color: #aaa;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        .conversation-modal-close:hover {
            color: #000;
        }
        .conversation-modal-body {
            padding: 20px;
            max-height: 60vh;
            overflow-y: auto;
        }
        .conversation-detail {
            margin-bottom: 20px;
            padding: 15px;
            border-radius: 8px;
        }
        .conversation-detail.user {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
        }
        .conversation-detail.bot {
            background: #f3e5f5;
            border-left: 4px solid #9c27b0;
        }
        .conversation-detail h4 {
            margin: 0 0 10px 0;
            color: #1d2327;
        }
        .conversation-meta {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
        }
        .image-indicator {
            color: #0073aa;
            font-weight: bold;
        }
        .conversation-image {
            max-width: 200px;
            max-height: 150px;
            border-radius: 8px;
            margin: 10px 0;
        }
        </style>
        <?php
    }

    /**
     * Obtenir le nombre de conversations aujourd'hui
     */
    private function get_today_conversations_count() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        return $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE DATE(created_at) = CURDATE()");
    }

    /**
     * Obtenir le nombre de conversations cette semaine
     */
    private function get_week_conversations_count() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        return $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
    }

    /**
     * Obtenir le nombre de conversations avec images
     */
    private function get_image_conversations_count() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        return $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE has_image = 1");
    }

    /**
     * Obtenir le nombre de conversations depuis mobile
     */
    private function get_mobile_conversations_count() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        return $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE device_info LIKE '%\"is_mobile\":true%'");
    }

    /**
     * Obtenir le nombre de conversations depuis desktop
     */
    private function get_desktop_conversations_count() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        return $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE device_info LIKE '%\"is_mobile\":false%' OR device_info IS NULL");
    }

    /**
     * Obtenir le nombre de conversations avec clavier virtuel
     */
    private function get_virtual_keyboard_conversations_count() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        return $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE device_info LIKE '%\"visual_viewport_supported\":true%'");
    }

    /**
     * AJAX: Obtenir les détails d'une conversation avec infos device
     */
    public function get_conversation_details() {
        check_ajax_referer('loom_chatbot_nonce', 'security');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permissions insuffisantes']);
        }
        
        $conversation_id = intval($_POST['conversation_id']);
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        
        $conversation = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table_name WHERE id = %d",
            $conversation_id
        ));
        
        if (!$conversation) {
            wp_send_json_error(['message' => 'Conversation non trouvée']);
        }
        
        $user_info = 'Visiteur anonyme';
        if ($conversation->user_id) {
            $user = get_user_by('id', $conversation->user_id);
            $user_info = $user ? $user->display_name . ' (' . $user->user_email . ')' : 'Utilisateur supprimé';
        }
        
        $device_info = json_decode($conversation->device_info, true);
        
        $html = '<div class="conversation-detail user">';
        $html .= '<h4>👤 Question de l\'utilisateur</h4>';
        $html .= '<p>' . esc_html($conversation->user_question) . '</p>';
        
        // Afficher l'image si présente
        if ($conversation->has_image && !empty($conversation->image_data)) {
            $html .= '<div class="user-image">';
            $html .= '<h5>📷 Image envoyée:</h5>';
            $html .= '<img src="data:image/jpeg;base64,' . esc_attr($conversation->image_data) . '" alt="Image utilisateur" class="conversation-image">';
            $html .= '</div>';
        }
        
        $html .= '<div class="conversation-meta">';
        $html .= '<strong>Utilisateur:</strong> ' . esc_html($user_info) . '<br>';
        $html .= '<strong>IP:</strong> ' . esc_html($conversation->user_ip) . '<br>';
        $html .= '<strong>Date:</strong> ' . esc_html(mysql2date('d/m/Y à H:i:s', $conversation->created_at)) . '<br>';
        $html .= '<strong>Session:</strong> ' . esc_html($conversation->session_id) . '<br>';
        $html .= '<strong>Avec image:</strong> ' . ($conversation->has_image ? 'Oui' : 'Non') . '<br>';
        
        // Afficher les informations d'appareil si disponibles
        if ($device_info) {
            $html .= '<strong>Type d\'appareil:</strong> ';
            if (isset($device_info['is_mobile'])) {
                $html .= $device_info['is_mobile'] ? 'Mobile' : 'Desktop';
            } else {
                $html .= 'Non détecté';
            }
            $html .= '<br>';
            
            if (isset($device_info['viewport_width']) && isset($device_info['viewport_height'])) {
                $html .= '<strong>Résolution:</strong> ' . $device_info['viewport_width'] . 'x' . $device_info['viewport_height'] . 'px<br>';
            }
            
            if (isset($device_info['is_touch'])) {
                $html .= '<strong>Écran tactile:</strong> ' . ($device_info['is_touch'] ? 'Oui' : 'Non') . '<br>';
            }
            
            if (isset($device_info['screen_orientation'])) {
                $html .= '<strong>Orientation:</strong> ' . esc_html($device_info['screen_orientation']) . '<br>';
            }
            
            if (isset($device_info['visual_viewport_supported'])) {
                $html .= '<strong>Support Visual Viewport:</strong> ' . ($device_info['visual_viewport_supported'] ? 'Oui' : 'Non') . '<br>';
            }
        }
        
        $html .= '</div>';
        $html .= '</div>';
        
        $html .= '<div class="conversation-detail bot">';
        $html .= '<h4>🤖 Réponse du bot</h4>';
        $html .= '<div>' . wp_kses_post($conversation->bot_response) . '</div>';
        $html .= '</div>';
        
        wp_send_json_success(['html' => $html]);
    }

    /**
     * AJAX: Supprimer une ou plusieurs conversations
     */
    public function delete_conversation() {
        check_ajax_referer('loom_chatbot_nonce', 'security');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permissions insuffisantes']);
        }
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        
        if (isset($_POST['conversation_id'])) {
            // Supprimer une seule conversation
            $conversation_id = intval($_POST['conversation_id']);
            $result = $wpdb->delete($table_name, ['id' => $conversation_id], ['%d']);
        } elseif (isset($_POST['conversation_ids']) && is_array($_POST['conversation_ids'])) {
            // Supprimer plusieurs conversations
            $conversation_ids = array_map('intval', $_POST['conversation_ids']);
            $placeholders = implode(',', array_fill(0, count($conversation_ids), '%d'));
            $result = $wpdb->query($wpdb->prepare(
                "DELETE FROM $table_name WHERE id IN ($placeholders)",
                $conversation_ids
            ));
        } else {
            wp_send_json_error(['message' => 'Aucun ID fourni']);
        }
        
        if ($result !== false) {
            wp_send_json_success(['message' => 'Conversation(s) supprimée(s) avec succès']);
        } else {
            wp_send_json_error(['message' => 'Erreur lors de la suppression']);
        }
    }

    /**
     * AJAX: Exporter les conversations en CSV avec données d'appareil
     */
    public function export_conversations() {
        check_ajax_referer('loom_chatbot_nonce', 'security');
        
        if (!current_user_can('manage_options')) {
            wp_die('Permissions insuffisantes');
        }
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        
        $conversations = $wpdb->get_results("SELECT * FROM $table_name ORDER BY created_at DESC");
        
        $filename = 'conversations_chatbot_' . date('Y-m-d_H-i-s') . '.csv';
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filename);
        header('Pragma: no-cache');
        header('Expires: 0');
        
        $output = fopen('php://output', 'w');
        
        // En-têtes CSV étendus
        fputcsv($output, [
            'ID',
            'Session ID',
            'User ID',
            'Question',
            'Réponse',
            'IP',
            'User Agent',
            'Avec Image',
            'Type Appareil',
            'Résolution',
            'Écran Tactile',
            'Orientation',
            'Support Visual Viewport',
            'Date'
        ]);
        
        // Données
        foreach ($conversations as $conversation) {
            $device_info = json_decode($conversation->device_info, true);
            
            $device_type = 'Non détecté';
            if (isset($device_info['is_mobile'])) {
                $device_type = $device_info['is_mobile'] ? 'Mobile' : 'Desktop';
            }
            
            $resolution = '';
            if (isset($device_info['viewport_width']) && isset($device_info['viewport_height'])) {
                $resolution = $device_info['viewport_width'] . 'x' . $device_info['viewport_height'];
            }
            
            $is_touch = '';
            if (isset($device_info['is_touch'])) {
                $is_touch = $device_info['is_touch'] ? 'Oui' : 'Non';
            }
            
            $orientation = isset($device_info['screen_orientation']) ? $device_info['screen_orientation'] : '';
            $visual_viewport = '';
            if (isset($device_info['visual_viewport_supported'])) {
                $visual_viewport = $device_info['visual_viewport_supported'] ? 'Oui' : 'Non';
            }
            
            fputcsv($output, [
                $conversation->id,
                $conversation->session_id,
                $conversation->user_id ?: 'Anonyme',
                $conversation->user_question,
                strip_tags($conversation->bot_response),
                $conversation->user_ip,
                $conversation->user_agent,
                $conversation->has_image ? 'Oui' : 'Non',
                $device_type,
                $resolution,
                $is_touch,
                $orientation,
                $visual_viewport,
                $conversation->created_at
            ]);
        }
        
        fclose($output);
        exit;
    }

    public function settings_init() {
        register_setting('loom_chatbot_options', 'loom_chatbot_api_key', ['sanitize_callback' => 'sanitize_text_field']);
        for ($i = 2; $i <= 5; $i++) {
            register_setting('loom_chatbot_options', "loom_chatbot_api_key_$i", ['sanitize_callback' => 'sanitize_text_field']);
        }
    }

    public function settings_page_html() {
        if (!current_user_can('manage_options')) return;
        if (isset($_POST['submit']) && check_admin_referer('loom_chatbot_settings', 'loom_chatbot_nonce')) {
            for ($i = 1; $i <= 5; $i++) {
                $key_name = $i === 1 ? 'loom_chatbot_api_key' : "loom_chatbot_api_key_$i";
                update_option($key_name, sanitize_text_field($_POST[$key_name] ?? ''));
            }
            echo '<div class="notice notice-success"><p>🚀 Configuration sauvegardée !</p></div>';
        }
        $is_woocommerce_active = function_exists('wc_get_products');
        ?>
        <div class="wrap">
            <h1>🛡️ <?php echo esc_html(get_admin_page_title()); ?> (v7.18)</h1>
            <div class="card">
                <h2>🔑 Configuration Clés API Google</h2>
                <form method="post" action="">
                    <?php wp_nonce_field('loom_chatbot_settings', 'loom_chatbot_nonce'); ?>
                    <table class="form-table">
                        <?php for ($i = 1; $i <= 5; $i++): $key_name = $i === 1 ? 'loom_chatbot_api_key' : "loom_chatbot_api_key_$i"; ?>
                        <tr>
                            <th scope="row">🔐 Clé API #<?php echo $i; ?></th>
                            <td><input type="password" name="<?php echo $key_name; ?>" value="<?php echo esc_attr(get_option($key_name, '')); ?>" class="regular-text"></td>
                        </tr>
                        <?php endfor; ?>
                    </table>
                    <?php submit_button('💾 Sauvegarder les clés', 'primary', 'submit', false); ?>
                </form>
            </div>
            
            <div class="card">
                <h2>🔧 État du Système</h2>
                <table class="widefat">
                     <tr><td><strong>🔌 Connexion WooCommerce</strong></td><td><?php echo $is_woocommerce_active ? '<span style="color: green;">✅ Actif</span>' : '<span style="color: red;">❌ Inactif</span>'; ?></td></tr>
                     <tr><td><strong>📚 Base de connaissances</strong></td><td><?php echo file_exists(plugin_dir_path(__FILE__) . 'sources/knowledge-base.txt') ? '<span style="color: green;">✅ Fichier trouvé</span>' : '<span style="color: orange;">🟡 Optionnel</span>'; ?></td></tr>
                     <tr><td><strong>💬 Conversations enregistrées</strong></td><td><span style="color: green;">✅ <?php echo $this->get_total_conversations_count(); ?> conversations</span></td></tr>
                     <tr><td><strong>📷 Support d'images</strong></td><td><span style="color: green;">✅ Activé (GD Library)</span></td></tr>
                     <tr><td><strong>🖼️ Conversations avec images</strong></td><td><span style="color: green;">✅ <?php echo $this->get_image_conversations_count(); ?> images analysées</span></td></tr>
                     <tr><td><strong>📱 Conversations mobiles</strong></td><td><span style="color: green;">✅ <?php echo $this->get_mobile_conversations_count(); ?> depuis mobile</span></td></tr>
                     <tr><td><strong>🖥️ Conversations desktop</strong></td><td><span style="color: green;">✅ <?php echo $this->get_desktop_conversations_count(); ?> depuis desktop</span></td></tr>
                </table>
            </div>
            <div class="card">
                <h2>📊 Accès rapide</h2>
                <p><a href="<?php echo admin_url('admin.php?page=loom_chatbot_conversations'); ?>" class="button button-primary">💬 Voir toutes les conversations</a></p>
                <p><a href="<?php echo admin_url('admin.php?page=loom_chatbot_conversations&search_filter=image'); ?>" class="button button-secondary">📷 Conversations avec images</a></p>
                <p><a href="<?php echo admin_url('admin.php?page=loom_chatbot_conversations&device_filter=mobile'); ?>" class="button button-secondary">📱 Conversations mobiles</a></p>
                <p><a href="<?php echo admin_url('admin.php?page=loom_chatbot_conversations&device_filter=desktop'); ?>" class="button button-secondary">🖥️ Conversations desktop</a></p>
            </div>
            
            <div class="card">
                <h2>ℹ️ Guide d'utilisation - Version 7.18</h2>
                <h4>📱 Responsivité améliorée</h4>
                <p>Cette version inclut des améliorations majeures pour la responsivité :</p>
                <ul>
                    <li>✅ Détection d'appareil robuste (mobile, tablette, desktop)</li>
                    <li>✅ Gestion avancée du clavier virtuel sur iOS et Android</li>
                    <li>✅ Fallbacks pour navigateurs non supportés</li>
                    <li>✅ Support des encoches (iPhone X+) et zones sûres</li>
                    <li>✅ Adaptation automatique aux rotations d'écran</li>
                    <li>✅ Statistiques détaillées par type d'appareil</li>
                </ul>
                
                <h4>📷 Analyse d'images</h4>
                <p>Vos utilisateurs peuvent maintenant envoyer des photos de leur jardin pour recevoir des recommandations personnalisées de Marius :</p>
                <ul>
                    <li>✅ Formats supportés : JPG, PNG, GIF, WebP</li>
                    <li>✅ Taille maximale : 5MB</li>
                    <li>✅ Validation de sécurité renforcée</li>
                    <li>✅ Redimensionnement automatique pour optimisation</li>
                    <li>✅ Analyse intelligente des taupinières et dégâts</li>
                </ul>
                
                <h4>🛒 Intégration WooCommerce</h4>
                <p>Le chatbot peut recommander et ajouter automatiquement vos produits au panier selon l'analyse.</p>
                
                <h4>📊 Gestion des conversations</h4>
                <p>Suivez les interactions, exportez les données et analysez les performances dans la section Conversations.</p>
                
                <h4>🔧 Tests de responsivité recommandés</h4>
                <ul>
                    <li>✅ iPhone Safari (anciennes et nouvelles versions)</li>
                    <li>✅ Android Chrome (différentes versions)</li>
                    <li>✅ iPad en mode portrait/paysage</li>
                    <li>✅ Appareils avec encoches (iPhone X+)</li>
                    <li>✅ Tablettes Android en mode portrait</li>
                    <li>✅ Changements d'orientation pendant l'utilisation</li>
                </ul>
            </div>
        </div>
        <style>.card{background:#fff;border:1px solid #ccd0d4;padding:20px;margin:20px 0;}</style>
        <?php
    }

    /**
     * Obtenir le nombre total de conversations
     */
    private function get_total_conversations_count() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'loom_chatbot_conversations';
        return $wpdb->get_var("SELECT COUNT(*) FROM $table_name");
    }
     
    public function admin_notices() {
        if (!current_user_can('manage_options')) return;
        $screen = get_current_screen();
        if ($screen && strpos($screen->id, 'loom_chatbot') === false) return;
        
        if (!function_exists('wc_get_products')) {
             echo '<div class="notice notice-error"><p><strong>🚨 Loom Chatbot:</strong> Le plugin WooCommerce est requis mais n\'est pas activé.</p></div>';
        }
        
        $configured_keys = 0;
        for ($i = 1; $i <= 5; $i++) {
            if (!empty(get_option($i === 1 ? 'loom_chatbot_api_key' : "loom_chatbot_api_key_$i"))) $configured_keys++;
        }
        if ($configured_keys === 0) {
            echo '<div class="notice notice-error"><p><strong>🚨 Loom Chatbot:</strong> Aucune clé API Google configurée. <a href="' . admin_url('options-general.php?page=loom_chatbot') . '">Configurez-en au moins une.</a></p></div>';
        }
        
        // Vérifier les extensions PHP nécessaires
        if (!extension_loaded('gd')) {
            echo '<div class="notice notice-warning"><p><strong>⚠️ Loom Chatbot:</strong> L\'extension GD Library n\'est pas activée. Le support d\'images sera limité.</p></div>';
        }
        
        if (!function_exists('imagecreatefromjpeg')) {
            echo '<div class="notice notice-warning"><p><strong>⚠️ Loom Chatbot:</strong> Support JPEG manquant dans GD Library.</p></div>';
        }
        
        // Vérification du support WebP
        if (!function_exists('imagecreatefromwebp')) {
            echo '<div class="notice notice-info"><p><strong>ℹ️ Loom Chatbot:</strong> Support WebP non disponible (PHP < 7.0). JPG, PNG et GIF restent supportés.</p></div>';
        }
    }
}

// Instanciation du plugin
Loom_Chatbot_Plugin::get_instance();
