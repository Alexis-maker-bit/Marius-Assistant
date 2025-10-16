/**
 * Loom Chatbot - Ultra Responsive Script v7.18
 * Advanced device detection, virtual keyboard handling, touch support
 */

(function($) {
    'use strict';

    // ===========================
    // DEVICE DETECTION & UTILITIES
    // ===========================
    
    const DeviceDetector = {
        isMobile: function() {
            return window.innerWidth < loom_chatbot_obj.device_detection.breakpoint_mobile;
        },
        
        isTablet: function() {
            return window.innerWidth >= loom_chatbot_obj.device_detection.breakpoint_mobile && 
                   window.innerWidth < loom_chatbot_obj.device_detection.breakpoint_tablet;
        },
        
        isDesktop: function() {
            return window.innerWidth >= loom_chatbot_obj.device_detection.breakpoint_tablet;
        },
        
        isTouchDevice: function() {
            return ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
        },
        
        getOrientation: function() {
            if (window.matchMedia("(orientation: portrait)").matches) {
                return 'portrait';
            }
            return 'landscape';
        },
        
        hasVisualViewport: function() {
            return 'visualViewport' in window;
        },
        
        getViewportData: function() {
            return {
                viewport_width: window.innerWidth,
                viewport_height: window.innerHeight,
                is_mobile: this.isMobile(),
                is_touch: this.isTouchDevice(),
                screen_orientation: this.getOrientation(),
                visual_viewport_supported: this.hasVisualViewport()
            };
        }
    };

    // ===========================
    // VIRTUAL KEYBOARD HANDLER
    // ===========================
    
    const VirtualKeyboardHandler = {
        originalHeight: null,
        isKeyboardOpen: false,
        
        init: function() {
            if (!DeviceDetector.isMobile()) return;
            
            this.originalHeight = window.innerHeight;
            
            // Modern approach: Visual Viewport API
            if (DeviceDetector.hasVisualViewport()) {
                window.visualViewport.addEventListener('resize', this.handleVisualViewportResize.bind(this));
                window.visualViewport.addEventListener('scroll', this.handleVisualViewportScroll.bind(this));
            } else {
                // Fallback for older browsers
                this.setupFallbackMethod();
            }
            
            // Handle input focus events
            $('#loom-chatbot-input').on('focus', this.onInputFocus.bind(this));
            $('#loom-chatbot-input').on('blur', this.onInputBlur.bind(this));
        },
        
        handleVisualViewportResize: function() {
            const currentHeight = window.visualViewport.height;
            const heightDifference = this.originalHeight - currentHeight;
            
            // If height decreased significantly, keyboard is likely open
            if (heightDifference > 150) {
                this.isKeyboardOpen = true;
                this.adjustChatForKeyboard();
            } else {
                this.isKeyboardOpen = false;
                this.resetChatLayout();
            }
        },
        
        handleVisualViewportScroll: function() {
            if (this.isKeyboardOpen) {
                // Keep the input visible when keyboard is open
                const input = document.getElementById('loom-chatbot-input');
                if (input && document.activeElement === input) {
                    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        },
        
        setupFallbackMethod: function() {
            // Fallback: Monitor window resize events
            let resizeTimer;
            $(window).on('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const currentHeight = window.innerHeight;
                    const heightDifference = this.originalHeight - currentHeight;
                    
                    if (heightDifference > 150) {
                        this.isKeyboardOpen = true;
                        this.adjustChatForKeyboard();
                    } else {
                        this.isKeyboardOpen = false;
                        this.resetChatLayout();
                    }
                }, 100);
            });
        },
        
        onInputFocus: function() {
            // Ensure messages scroll to bottom when input is focused
            setTimeout(() => {
                this.scrollToBottom();
            }, 300);
        },
        
        onInputBlur: function() {
            // Small delay to handle keyboard closing
            setTimeout(() => {
                if (!this.isKeyboardOpen) {
                    this.resetChatLayout();
                }
            }, 100);
        },
        
        adjustChatForKeyboard: function() {
            const $container = $('.loom-chatbot-container');
            $container.addClass('keyboard-open');
            this.scrollToBottom();
        },
        
        resetChatLayout: function() {
            $('.loom-chatbot-container').removeClass('keyboard-open');
        },
        
        scrollToBottom: function() {
            const $messages = $('.loom-chatbot-messages');
            $messages.scrollTop($messages[0].scrollHeight);
        }
    };

    // ===========================
    // RESPONSIVE CHAT HANDLER
    // ===========================
    
    const ResponsiveChatHandler = {
        init: function() {
            this.setupOrientationChange();
            this.setupResponsiveAdjustments();
            this.applyInitialResponsiveState();
        },
        
        setupOrientationChange: function() {
            // Modern approach
            if (window.screen && window.screen.orientation) {
                window.screen.orientation.addEventListener('change', this.handleOrientationChange.bind(this));
            }
            
            // Fallback for older browsers
            window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
            
            // Additional fallback using media query
            const orientationQuery = window.matchMedia('(orientation: portrait)');
            if (orientationQuery.addEventListener) {
                orientationQuery.addEventListener('change', this.handleOrientationChange.bind(this));
            } else if (orientationQuery.addListener) {
                // Safari < 14 support
                orientationQuery.addListener(this.handleOrientationChange.bind(this));
            }
        },
        
        handleOrientationChange: function() {
            // Small delay to let the browser finish orientation change
            setTimeout(() => {
                this.applyResponsiveAdjustments();
                VirtualKeyboardHandler.scrollToBottom();
            }, 200);
        },
        
        setupResponsiveAdjustments: function() {
            let resizeTimer;
            $(window).on('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.applyResponsiveAdjustments();
                }, 150);
            });
        },
        
        applyInitialResponsiveState: function() {
            this.applyResponsiveAdjustments();
        },
        
        applyResponsiveAdjustments: function() {
            const $container = $('.loom-chatbot-container');
            
            // Remove all device classes
            $container.removeClass('device-mobile device-tablet device-desktop');
            
            // Add appropriate class based on screen size
            if (DeviceDetector.isMobile()) {
                $container.addClass('device-mobile');
            } else if (DeviceDetector.isTablet()) {
                $container.addClass('device-tablet');
            } else {
                $container.addClass('device-desktop');
            }
            
            // Add touch class if applicable
            if (DeviceDetector.isTouchDevice()) {
                $container.addClass('touch-device');
            }
            
            // Add orientation class
            $container.removeClass('orientation-portrait orientation-landscape');
            $container.addClass('orientation-' + DeviceDetector.getOrientation());
        }
    };

    // ===========================
    // CHATBOT MAIN CLASS
    // ===========================
    
    const LoomChatbot = {
        $container: null,
        $messages: null,
        $input: null,
        $sendBtn: null,
        $photoBtn: null,
        $loading: null,
        currentImage: null,
        isMinimized: true,
        
        init: function() {
            this.$container = $('.loom-chatbot-container');
            this.$messages = $('.loom-chatbot-messages');
            this.$input = $('#loom-chatbot-input');
            this.$sendBtn = $('#loom-chatbot-send');
            this.$photoBtn = $('#loom-chatbot-photo-btn');
            this.$loading = $('.loom-chatbot-loading');
            
            this.setupEventListeners();
            this.initializeResponsive();
            this.debugLog('Chatbot initialized');
        },
        
        initializeResponsive: function() {
            // Initialize responsive features
            ResponsiveChatHandler.init();
            VirtualKeyboardHandler.init();
            
            this.debugLog('Responsive features initialized', DeviceDetector.getViewportData());
        },
        
        setupEventListeners: function() {
            // Header click to toggle minimize
            $('.loom-chatbot-header').on('click', (e) => {
                if (!$(e.target).closest('.minimize-button').length) {
                    this.toggleMinimize();
                }
            });
            
            // Minimize button
            $('.minimize-button').on('click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });
            
            // Send button
            this.$sendBtn.on('click', () => {
                this.sendMessage();
            });
            
            // Enter key to send
            this.$input.on('keypress', (e) => {
                if (e.which === 13 && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Photo button
            this.$photoBtn.on('click', () => {
                $('#loom-chatbot-image-input').click();
            });
            
            // Image upload
            $('#loom-chatbot-image-input').on('change', (e) => {
                this.handleImageUpload(e);
            });
            
            // Dynamic add to cart buttons
            this.$messages.on('click', '.add-to-cart-button', (e) => {
                this.addToCart($(e.currentTarget).data('product-id'));
            });
            
            // Prevent default touch behaviors that might interfere
            if (DeviceDetector.isTouchDevice()) {
                this.$container.on('touchmove', (e) => {
                    // Allow scrolling within messages area
                    if ($(e.target).closest('.loom-chatbot-messages').length) {
                        return;
                    }
                    e.preventDefault();
                }, { passive: false });
            }
        },
        
        toggleMinimize: function() {
            this.isMinimized = !this.isMinimized;
            this.$container.toggleClass('minimized', this.isMinimized);
            
            if (!this.isMinimized) {
                // Scroll to bottom when opening
                setTimeout(() => {
                    this.scrollToBottom();
                }, 300);
                
                // Focus input if not on touch device
                if (!DeviceDetector.isTouchDevice()) {
                    this.$input.focus();
                }
            }
            
            this.debugLog('Toggled minimize:', this.isMinimized);
        },
        
        sendMessage: function() {
            const message = this.$input.val().trim();
            
            if (!message && !this.currentImage) {
                return;
            }
            
            this.debugLog('Sending message:', message, 'Has image:', !!this.currentImage);
            
            // Add user message to UI
            this.addUserMessage(message || 'Photo de jardin');
            
            // Clear input
            this.$input.val('');
            
            // Show loading
            this.showLoading();
            
            // Prepare data
            const data = {
                action: 'loom_chatbot_respond',
                security: loom_chatbot_obj.nonce,
                question: message,
                has_image: !!this.currentImage,
                ...DeviceDetector.getViewportData()
            };
            
            if (this.currentImage) {
                data.image_data = this.currentImage.data;
                data.mime_type = this.currentImage.mime_type;
            }
            
            // Send AJAX request
            $.ajax({
                url: loom_chatbot_obj.ajax_url,
                method: 'POST',
                data: data,
                success: (response) => {
                    this.hideLoading();
                    
                    if (response.success && response.data.answer) {
                        this.addBotMessage(response.data.answer);
                        
                        // Handle actions (like add to cart)
                        if (response.data.action) {
                            this.handleAction(response.data.action);
                        }
                    } else {
                        this.addBotMessage('Désolé, une erreur est survenue. Veuillez réessayer.');
                    }
                    
                    this.currentImage = null;
                },
                error: (xhr, status, error) => {
                    this.hideLoading();
                    this.debugLog('Error:', error);
                    this.addBotMessage('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
                    this.currentImage = null;
                }
            });
        },
        
        handleImageUpload: function(e) {
            const file = e.target.files[0];
            
            if (!file) return;
            
            this.debugLog('Image selected:', file.name, file.size, file.type);
            
            // Validate file type
            if (!loom_chatbot_obj.allowed_types.includes(file.type)) {
                alert('Type de fichier non supporté. Utilisez JPG, PNG, GIF ou WebP.');
                return;
            }
            
            // Validate file size
            if (file.size > loom_chatbot_obj.max_file_size) {
                alert('L\'image est trop volumineuse. Maximum 5MB.');
                return;
            }
            
            // Show loading
            this.showLoading();
            
            // Prepare form data
            const formData = new FormData();
            formData.append('action', 'loom_chatbot_upload_image');
            formData.append('security', loom_chatbot_obj.nonce);
            formData.append('image', file);
            
            // Upload image
            $.ajax({
                url: loom_chatbot_obj.ajax_url,
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: (response) => {
                    this.hideLoading();
                    
                    if (response.success && response.data.image_data) {
                        this.currentImage = {
                            data: response.data.image_data,
                            mime_type: response.data.mime_type
                        };
                        
                        // Show feedback
                        this.$input.attr('placeholder', '📷 Photo prête - Décrivez votre situation...');
                        this.debugLog('Image uploaded successfully');
                    } else {
                        alert(response.data.message || 'Erreur lors de l\'upload de l\'image.');
                    }
                },
                error: () => {
                    this.hideLoading();
                    alert('Impossible d\'uploader l\'image. Veuillez réessayer.');
                }
            });
            
            // Reset input
            e.target.value = '';
        },
        
        addUserMessage: function(message) {
            const html = `<div class="user-message">${this.escapeHtml(message)}</div>`;
            this.$messages.append(html);
            this.scrollToBottom();
        },
        
        addBotMessage: function(html) {
            this.$messages.append(html);
            this.scrollToBottom();
            
            // Reset placeholder
            this.$input.attr('placeholder', 'Posez votre question...');
        },
        
        showLoading: function() {
            this.$loading.addClass('active');
            this.scrollToBottom();
        },
        
        hideLoading: function() {
            this.$loading.removeClass('active');
        },
        
        scrollToBottom: function() {
            setTimeout(() => {
                this.$messages.scrollTop(this.$messages[0].scrollHeight);
            }, 100);
        },
        
        handleAction: function(action) {
            if (action.type === 'add_to_cart' && action.product_id) {
                this.addToCart(action.product_id);
            }
        },
        
        addToCart: function(productId) {
            this.debugLog('Adding to cart:', productId);
            
            $.ajax({
                url: loom_chatbot_obj.ajax_url,
                method: 'POST',
                data: {
                    action: 'loom_chatbot_add_to_cart',
                    security: loom_chatbot_obj.nonce,
                    product_id: productId
                },
                success: (response) => {
                    if (response.success) {
                        this.addBotMessage('<div class="bot-message"><p>✅ ' + response.data.message + '</p></div>');
                    } else {
                        this.addBotMessage('<div class="bot-message"><p>❌ ' + response.data.message + '</p></div>');
                    }
                },
                error: () => {
                    this.addBotMessage('<div class="bot-message"><p>❌ Erreur lors de l\'ajout au panier.</p></div>');
                }
            });
        },
        
        escapeHtml: function(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        },
        
        debugLog: function(...args) {
            if (loom_chatbot_obj.debug) {
                console.log('[Loom Chatbot]', ...args);
            }
        }
    };

    // ===========================
    // INITIALIZATION
    // ===========================
    
    $(document).ready(function() {
        LoomChatbot.init();
    });

})(jQuery);
