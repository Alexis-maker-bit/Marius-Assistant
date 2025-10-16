// js/loom-chatbot-script.js (VERSION 7.18 - Layout messagerie final)
jQuery(document).ready(function($) {
    'use strict';
     
    const $container = $('.loom-chatbot-container');
    const $messagesContainer = $('.loom-chatbot-messages');
    const $body = $('.loom-chatbot-body');
    const $input = $('#loom-chatbot-input');
    const $sendButton = $('#loom-chatbot-send');
    const $photoButton = $('#loom-chatbot-photo-btn');
    const $imageInput = $('#loom-chatbot-image-input');
    const $loading = $('.loom-chatbot-loading');
    const $header = $('.loom-chatbot-header');
     
    // Variables de détection d'appareil
    let deviceInfo = {};
    let isCurrentlyMobile = false;
    let isTablet = false;
    let currentImage = null;
    let currentImageType = null;
    let orientationChangeTimeout = null;
    let keyboardTimeout = null;

    // Vérifier que les éléments existent
    if ($container.length === 0) {
        console.log('Loom Chatbot: Container not found');
        return;
    }

    // === DÉTECTION D'APPAREIL ROBUSTE ===
    function detectDevice() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const userAgent = navigator.userAgent;
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const visualViewportSupported = 'visualViewport' in window;
        
        const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isMobileWidth = width <= (loom_chatbot_obj.device_detection?.breakpoint_mobile || 768);
        const isMobileTouch = hasTouch && width <= 1024;
        
        isCurrentlyMobile = isMobileUA || isMobileWidth || isMobileTouch;
        
        const isTabletWidth = width > 768 && width <= (loom_chatbot_obj.device_detection?.breakpoint_tablet || 1024);
        const isTabletUA = /iPad/i.test(userAgent) || (hasTouch && !isMobileUA && isTabletWidth);
        isTablet = isTabletUA;
        
        deviceInfo = {
            is_mobile: isCurrentlyMobile,
            is_tablet: isTablet,
            is_touch: hasTouch,
            viewport_width: width,
            viewport_height: height,
            screen_width: screen.width || null,
            screen_height: screen.height || null,
            screen_orientation: getOrientation(),
            visual_viewport_supported: visualViewportSupported,
            user_agent: userAgent,
            device_pixel_ratio: window.devicePixelRatio || 1,
            browser_type: getBrowserType(),
            os_type: getOSType(),
            has_notch: hasNotch()
        };
        
        if (loom_chatbot_obj.debug) {
            console.log('Loom Chatbot - Device Detection:', deviceInfo);
        }
        
        return deviceInfo;
    }
    
    function getBrowserType() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edg')) return 'Edge';
        return 'Other';
    }
    
    function getOSType() {
        const ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
        if (/Android/i.test(ua)) return 'Android';
        if (/Windows/i.test(ua)) return 'Windows';
        if (/Mac/i.test(ua)) return 'macOS';
        if (/Linux/i.test(ua)) return 'Linux';
        return 'Other';
    }
    
    function getOrientation() {
        if (screen.orientation && screen.orientation.angle !== undefined) {
            return screen.orientation.angle === 0 || screen.orientation.angle === 180 ? 'portrait' : 'landscape';
        }
        if (window.orientation !== undefined) {
            return Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
        }
        return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }
    
    function hasNotch() {
        const hasEnvSupport = CSS.supports('padding-top: env(safe-area-inset-top)');
        const isIPhoneX = /iPhone/i.test(navigator.userAgent) && screen.height >= 812;
        return hasEnvSupport || isIPhoneX;
    }
     
    // === GESTION DU CLAVIER VIRTUEL (NOUVELLE VERSION) ===
    function handleViewportChange() {
        if (!isCurrentlyMobile || !$container.hasClass('mobile-fullscreen')) {
            return;
        }

        clearTimeout(keyboardTimeout);
        keyboardTimeout = setTimeout(() => {
            let keyboardHeight = 0;

            // On utilise l'API moderne si disponible
            if (window.visualViewport) {
                const vv = window.visualViewport;
                // La hauteur du clavier est la différence entre la hauteur totale de la fenêtre et ce qui est visible
                keyboardHeight = window.innerHeight - vv.height;
            }
            
            // Si la hauteur calculée est négative (bugs sur certains navigateurs), on la met à 0
            if (keyboardHeight < 0) {
                keyboardHeight = 0;
            }

            // On met à jour la variable CSS --keyboard-height sur le conteneur
            // Le CSS s'occupera du reste grâce à la règle de "padding-bottom"
            $container.css('--keyboard-height', `${keyboardHeight}px`);
            
            // On s'assure de toujours voir le dernier message après le redimensionnement
            setTimeout(() => {
                scrollToBottom(true);
            }, 50);

        }, 50);
    }
     
    // === GESTION STORAGE SÉCURISÉE ===
    function saveMessages() { 
        try { 
            sessionStorage.setItem('loom_chatbot_messages', $messagesContainer.html()); 
        } catch (e) {
            console.log('Loom Chatbot: Cannot save to sessionStorage');
        } 
    }
    
    function restoreMessages() { 
        try { 
            const saved = sessionStorage.getItem('loom_chatbot_messages'); 
            if (saved) $messagesContainer.html(saved); 
        } catch (e) {
            console.log('Loom Chatbot: Cannot restore from sessionStorage');
        } 
    }
    
    function saveState(state) { 
        try { 
            sessionStorage.setItem('loom_chatbot_state', state);
            sessionStorage.setItem('loom_chatbot_device_info', JSON.stringify(deviceInfo));
        } catch (e) {
            console.log('Loom Chatbot: Cannot save state');
        } 
    }
    
    function getState() { 
        try { 
            return sessionStorage.getItem('loom_chatbot_state'); 
        } catch (e) { 
            return null; 
        } 
    }
     
    // === GESTION INTERFACE (VERSION SIMPLIFIÉE) ===
    function activateMobileLayout() {
        isCurrentlyMobile = true;
        $container.addClass('mobile-fullscreen');
        
        // On bloque juste le scroll de la page derrière
        $('body').addClass('chatbot-no-scroll');
        
        // Attacher les écouteurs pour le clavier
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportChange);
        } else {
            window.addEventListener('resize', handleViewportChange);
        }
        
        // Appeler une première fois pour ajuster la vue
        handleViewportChange();
    }
     
    function deactivateMobileLayout() {
        isCurrentlyMobile = false;
        $container.removeClass('mobile-fullscreen');
        
        // On réactive le scroll de la page
        $('body').removeClass('chatbot-no-scroll');
        
        // On remet la variable CSS à zéro au cas où
        $container.css('--keyboard-height', '0px');
        
        // Nettoyer les écouteurs pour éviter les fuites de mémoire
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', handleViewportChange);
        } else {
            window.removeEventListener('resize', handleViewportChange);
        }
    }

    function maximize() {
        $container.removeClass('minimized').addClass('maximized');
        saveState('maximized');
        
        if (isCurrentlyMobile || isTablet) {
            activateMobileLayout();
        }
        
        scrollToBottom(true);
        
        if (!isCurrentlyMobile) {
            setTimeout(() => $input.focus(), 300);
        }
    }
     
    function minimize() {
        $container.addClass('minimized').removeClass('maximized');
        saveState('minimized');
        
        if (isCurrentlyMobile || $container.hasClass('mobile-fullscreen')) {
            deactivateMobileLayout();
        }
        
        $input.blur();
    }
     
    function scrollToBottom(force = false) {
        if ($body.length === 0) return;
        
        const scrollHeight = $body[0].scrollHeight;
        const clientHeight = $body[0].clientHeight;
        
        if (scrollHeight <= clientHeight) return;
        
        if (force) {
            $body.scrollTop(scrollHeight);
        } else {
            $body.animate({ scrollTop: scrollHeight }, 300);
        }
    }
     
    // === GESTION DES IMAGES AMÉLIORÉE ===
    function validateImageFile(file) {
        const allowedTypes = loom_chatbot_obj.allowed_types || ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: 'Type de fichier non supporté. Utilisez JPG, PNG, GIF ou WebP.' };
        }
        
        const maxSize = loom_chatbot_obj.max_file_size || (5 * 1024 * 1024);
        if (file.size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            return { valid: false, error: `L'image est trop volumineuse. Maximum ${maxSizeMB}MB.` };
        }
        
        if (file.type.startsWith('image/')) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = function() {
                    if (this.width < 50 || this.height < 50) {
                        resolve({ valid: false, error: 'L\'image est trop petite (minimum 50x50 pixels).' });
                    } else if (this.width > 4000 || this.height > 4000) {
                        resolve({ valid: false, error: 'L\'image est trop grande (maximum 4000x4000 pixels).' });
                    } else {
                        resolve({ valid: true });
                    }
                };
                img.onerror = function() {
                    resolve({ valid: false, error: 'Le fichier n\'est pas une image valide.' });
                };
                img.src = URL.createObjectURL(file);
            });
        }
        
        return { valid: true };
    }
    
    function displayImagePreview(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageHtml = `
                <div class="user-message image-message">
                    <div class="image-preview">
                        <img src="${e.target.result}" alt="Image envoyée" style="max-width: 200px; max-height: 150px; border-radius: 8px;">
                        <span class="image-caption">Photo de jardin envoyée</span>
                    </div>
                </div>
            `;
            $messagesContainer.append(imageHtml);
            saveMessages();
            scrollToBottom();
        };
        reader.readAsDataURL(file);
    }
    
    async function uploadImage(file, question = '') {
        let validation = validateImageFile(file);
        if (validation instanceof Promise) {
            validation = await validation;
        }
        
        if (!validation.valid) {
            displayMessage('bot', `<div class="bot-message-group"><div class="bot-message error">${validation.error}</div></div>`, true);
            return;
        }
        
        displayImagePreview(file);
        
        const formData = new FormData();
        formData.append('action', 'loom_chatbot_upload_image');
        formData.append('security', loom_chatbot_obj.nonce);
        formData.append('image', file);
        
        Object.keys(deviceInfo).forEach(key => {
            formData.append(key, deviceInfo[key]);
        });
        
        $loading.show();
        $('.typing-text').text('Marius analyse votre photo');
        scrollToBottom(true);
        
        $.ajax({
            url: loom_chatbot_obj.ajax_url,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            timeout: 60000,
            success: function(response) {
                if (response.success) {
                    currentImage = response.data.image_data;
                    currentImageType = response.data.mime_type;
                    
                    if (loom_chatbot_obj.debug) {
                        console.log('Image uploaded successfully:', response.data.file_size, 'bytes');
                    }
                    
                    if (question.trim()) {
                        sendMessageWithImage(question);
                    } else {
                        sendMessageWithImage('Analysez cette photo de mon jardin et donnez-moi des recommandations pour traiter les problèmes de taupes.');
                    }
                } else {
                    $loading.hide();
                    displayMessage('bot', `<div class="bot-message-group"><div class="bot-message error">${response.data.message || 'Erreur lors de l\'upload'}</div></div>`, true);
                }
            },
            error: function(xhr, status, error) {
                $loading.hide();
                console.error('Upload error:', status, error);
                
                let errorMessage = 'Erreur lors de l\'upload de l\'image.';
                if (status === 'timeout') {
                    errorMessage = 'Timeout lors de l\'upload. Veuillez réessayer avec une image plus petite.';
                } else if (xhr.status === 413) {
                    errorMessage = 'L\'image est trop volumineuse pour le serveur.';
                }
                
                displayMessage('bot', `<div class="bot-message-group"><div class="bot-message error">${errorMessage}</div></div>`, true);
            }
        });
    }
    
    function sendMessageWithImage(question) {
        if (!currentImage) {
            sendMessage();
            return;
        }
        
        const requestData = {
            action: 'loom_chatbot_respond',
            security: loom_chatbot_obj.nonce,
            question: question,
            has_image: 'true',
            image_data: currentImage,
            mime_type: currentImageType,
            ...deviceInfo
        };
        
        $.ajax({
            url: loom_chatbot_obj.ajax_url,
            type: 'POST',
            data: requestData,
            timeout: 60000,
            success: function(response) {
                if (response && response.success) {
                    const answer = response.data.answer || '';
                    if (answer.trim()) {
                        displayMessage('bot', answer);
                    }
                    if (response.data.action && response.data.action.type === 'add_to_cart') {
                        triggerAddToCart(response.data.action.product_id, null, true);
                    }
                } else {
                    const errorMsg = response.data ? response.data.answer : 'Désolé, une erreur est survenue lors de l\'analyse.';
                    displayMessage('bot', '<div class="bot-message-group"><div class="bot-message error">' + errorMsg + '</div></div>', true);
                }
            },
            error: function(xhr, status, error) {
                console.error('Loom Chatbot Image Analysis Error:', status, error);
                
                let errorMessage = 'Erreur lors de l\'analyse de l\'image.';
                if (status === 'timeout') {
                    errorMessage = 'L\'analyse prend plus de temps que prévu. Veuillez réessayer.';
                }
                
                displayMessage('bot', '<div class="bot-message-group"><div class="bot-message error">' + errorMessage + '</div></div>', true);
            },
            complete: function() {
                $loading.hide();
                $('.typing-text').text('Marius écrit');
                currentImage = null;
                currentImageType = null;
                scrollToBottom(true);
            }
        });
    }
     
    // === AFFICHAGE DES MESSAGES ===
    // Déclaration de la variable en dehors pour pouvoir la wrapper
    let displayMessage = function(role, message, isError = false) {
        if (role === 'user') {
            const content = $('<div>').text(message).html();
            const $message = $('<div>').addClass('user-message').html(content);
            $messagesContainer.append($message);
        } else { 
            $messagesContainer.append(message);
        }
        saveMessages();
        scrollToBottom();
    };
     
    // === GESTION MESSAGES AMÉLIORÉE ===
    function sendMessage() {
        const question = $input.val().trim();
        if (!question) return;
        
        displayMessage('user', question);
        $input.val('');
        $loading.show();
        scrollToBottom(true);
        
        if (typeof loom_chatbot_obj === 'undefined') {
            console.error('Loom Chatbot: loom_chatbot_obj not defined');
            $loading.hide();
            displayMessage('bot', '<div class="bot-message-group"><div class="bot-message error">Erreur de configuration du chatbot.</div></div>', true);
            return;
        }
        
        const requestData = {
            action: 'loom_chatbot_respond', 
            security: loom_chatbot_obj.nonce, 
            question: question,
            ...deviceInfo
        };
        
        $.ajax({
            url: loom_chatbot_obj.ajax_url, 
            type: 'POST',
            data: requestData,
            timeout: 45000,
            success: function(response) {
                if (response && response.success) {
                    const answer = response.data.answer || '';
                    if (answer.trim()) {
                        displayMessage('bot', answer);
                    }
                    if (response.data.action && response.data.action.type === 'add_to_cart') {
                        triggerAddToCart(response.data.action.product_id, null, true);
                    }
                } else {
                    const errorMsg = response.data ? response.data.answer : 'Désolé, une erreur est survenue.';
                    displayMessage('bot', '<div class="bot-message-group"><div class="bot-message error">' + errorMsg + '</div></div>', true);
                }
            },
            error: function(xhr, status, error) { 
                console.error('Loom Chatbot AJAX Error:', status, error);
                
                let errorMessage = 'Erreur de communication avec le serveur.';
                if (status === 'timeout') {
                    errorMessage = 'Le serveur met trop de temps à répondre. Veuillez réessayer.';
                } else if (xhr.status === 0) {
                    errorMessage = 'Problème de connexion internet.';
                } else if (xhr.status >= 500) {
                    errorMessage = 'Erreur serveur temporaire. Veuillez réessayer.';
                }
                
                displayMessage('bot', '<div class="bot-message-group"><div class="bot-message error">' + errorMessage + '</div></div>', true); 
            },
            complete: function() { 
                $loading.hide(); 
                scrollToBottom(true); 
            }
        });
    }
     
    function triggerAddToCart(productId, $button, isDirectAction = false) {
        if (!productId) return;
        if ($button) $button.text('Ajout...').prop('disabled', true);
        
        $.ajax({
            url: loom_chatbot_obj.ajax_url, 
            type: 'POST',
            data: { 
                action: 'loom_chatbot_add_to_cart', 
                security: loom_chatbot_obj.nonce, 
                product_id: productId 
            },
            success: function(response) {
                if (response.success) {
                    displayMessage('bot', "<div class='bot-message-group'><div class='bot-message'>✅ Produit ajouté au panier !</div></div>");
                    $(document.body).trigger('wc_fragment_refresh');
                    if ($button) $button.text('Ajouté !').css('background-color', '#4CAF50');
                } else {
                    const errorMsg = response.data ? response.data.message : "Erreur lors de l'ajout.";
                    displayMessage('bot', "<div class='bot-message-group'><div class='bot-message error'>" + errorMsg + "</div></div>", true);
                    if ($button) $button.text('Ajouter au panier').prop('disabled', false);
                }
            },
            error: function() {
                displayMessage('bot', "<div class='bot-message-group'><div class='bot-message error'>Erreur réseau.</div></div>", true);
                if ($button) $button.text('Ajouter au panier').prop('disabled', false);
            },
            complete: scrollToBottom
        });
    }
     
    // === GESTION DES ORIENTATIONS ET ROTATIONS ===
    function handleOrientationChange() {
        clearTimeout(orientationChangeTimeout);
        orientationChangeTimeout = setTimeout(() => {
            detectDevice();
            
            if ($container.hasClass('mobile-fullscreen')) {
                setTimeout(() => {
                    handleViewportChange();
                    scrollToBottom(true);
                }, 100);
            }
            
            if (loom_chatbot_obj.debug) {
                console.log('Orientation changed:', deviceInfo.screen_orientation);
            }
        }, 500);
    }
     
    // === ÉVÉNEMENTS ===
    $header.on('click', function(e) { 
        if (!$(e.target).is('.minimize-button') && $container.hasClass('minimized')) {
            maximize(); 
        } 
    });
    
    $('.minimize-button').on('click', function(e) { 
        e.stopPropagation(); 
        minimize(); 
    });
    
    $sendButton.on('click', sendMessage);
    
    $photoButton.on('click', function(e) {
        e.preventDefault();
        $imageInput.click();
    });
    
    $imageInput.on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const currentQuestion = $input.val().trim();
            uploadImage(file, currentQuestion);
            $input.val('');
            $(this).val('');
        }
    });
    
    $input.on('keypress', function(e) { 
        if (e.which === 13) { 
            e.preventDefault(); 
            sendMessage(); 
        } 
    });
    
    $input.on('focus', function() {
        if (isCurrentlyMobile && $container.hasClass('mobile-fullscreen')) {
            setTimeout(() => {
                handleViewportChange();
            }, 300);
        }
    });

    $input.on('blur', function() {
        if (isCurrentlyMobile && $container.hasClass('mobile-fullscreen')) {
            setTimeout(handleViewportChange, 300);
        }
    });
    
    $(document).on('click', '.add-to-cart-button', function() { 
        triggerAddToCart($(this).data('product-id'), $(this)); 
    });
     
    if ('onorientationchange' in window) {
        $(window).on('orientationchange', handleOrientationChange);
    } else {
        let lastOrientation = getOrientation();
        $(window).on('resize', function() {
            const currentOrientation = getOrientation();
            if (currentOrientation !== lastOrientation) {
                lastOrientation = currentOrientation;
                handleOrientationChange();
            }
        });
    }
    
    // === GESTION DE L'ACCESSIBILITÉ ===
    $container.on('keydown', function(e) {
        if (e.key === 'Escape' && $container.hasClass('maximized')) {
            minimize();
        }
    });
    
    $container.attr('role', 'application');
    $container.attr('aria-label', 'Assistant chatbot Marius');
    $messagesContainer.attr('aria-live', 'polite');
    $messagesContainer.attr('aria-label', 'Messages de conversation');
    
    // Wrapper pour l'accessibilité
    const originalDisplayMessage = displayMessage;
    displayMessage = function(role, message, isError = false) {
        originalDisplayMessage(role, message, isError);
        
        if (role === 'bot') {
            const textContent = $('<div>').html(message).text();
            const announcement = `Marius dit: ${textContent.substring(0, 100)}${textContent.length > 100 ? '...' : ''}`;
            
            const $announcement = $('<div>')
                .attr('aria-live', 'assertive')
                .addClass('sr-only')
                .text(announcement)
                .appendTo($body);
            
            setTimeout(() => $announcement.remove(), 3000);
        }
    };
    
    // === INITIALISATION ===
    detectDevice();
    restoreMessages();
    const savedState = getState();
    if (savedState === 'maximized') {
        maximize();
    }
    
    $(window).on('resize', function() {
        const previousMobile = isCurrentlyMobile;
        detectDevice();
        if (previousMobile !== isCurrentlyMobile) {
            if (isCurrentlyMobile && $container.hasClass('maximized')) {
                activateMobileLayout();
            } else if (!isCurrentlyMobile && $container.hasClass('maximized')) {
                deactivateMobileLayout();
            }
        }
    });

});