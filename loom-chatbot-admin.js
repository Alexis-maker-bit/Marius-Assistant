// js/loom-chatbot-admin.js (VERSION 7.18 - Interface admin complète avec analytics d'appareils)
jQuery(document).ready(function($) {
    'use strict';
    
    // Variables globales
    let ajaxurl = loom_chatbot_admin_obj.ajax_url;
    let nonce = loom_chatbot_admin_obj.nonce;
    let isLoading = false;
    let selectedConversations = new Set();
    let currentPage = 1;
    let totalPages = 1;
    let filters = {
        date: '',
        search: '',
        device: ''
    };
    
    // === INITIALISATION ET DÉTECTION ===
    
    function initializeAdmin() {
        updatePageInfo();
        initializeCharts();
        bindEvents();
        loadQuickStats();
        initializeTooltips();
        
        if (typeof loom_chatbot_admin_obj.debug !== 'undefined' && loom_chatbot_admin_obj.debug) {
            console.log('🎯 Loom Chatbot Admin v7.18 initialized');
            window.loomAdminDebug = {
                selectedConversations,
                filters,
                exportData: exportConversations,
                refreshStats: loadQuickStats
            };
        }
    }
    
    function updatePageInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        currentPage = parseInt(urlParams.get('paged')) || 1;
        
        // Extraire les informations de pagination depuis la page
        const paginationInfo = $('.tablenav-pages .displaying-num').text();
        const match = paginationInfo.match(/(\d+)\s+éléments?/);
        if (match) {
            const totalItems = parseInt(match[1]);
            totalPages = Math.ceil(totalItems / 50); // 50 items par page
        }
        
        filters.date = urlParams.get('date_filter') || '';
        filters.search = urlParams.get('search_filter') || '';
        filters.device = urlParams.get('device_filter') || '';
    }
    
    // === GESTION DES ÉVÉNEMENTS ===
    
    function bindEvents() {
        // Sélection multiple
        $('#select-all').on('change', handleSelectAll);
        $(document).on('change', 'input[name="conversation_ids[]"]', handleIndividualSelect);
        
        // Actions sur les conversations
        $(document).on('click', '.view-conversation', handleViewConversation);
        $(document).on('click', '.delete-conversation', handleDeleteSingle);
        $('#delete-selected').on('click', handleDeleteSelected);
        $('#export-conversations').on('click', handleExportConversations);
        
        // Modal
        $('.conversation-modal-close').on('click', closeConversationModal);
        $('.conversation-modal').on('click', handleModalBackdropClick);
        
        // Filtres
        $('input[name="search_filter"]').on('input', debounce(handleSearchFilter, 500));
        $('input[name="date_filter"], select[name="device_filter"]').on('change', handleFilterChange);
        
        // Actions rapides
        $(document).on('click', '#filter-today', () => setDateFilter('today'));
        $(document).on('click', '#filter-week', () => setDateFilter('week'));
        $(document).on('click', '#filter-images', () => setSearchFilter('image'));
        $(document).on('click', '#filter-mobile', () => setDeviceFilter('mobile'));
        $(document).on('click', '#filter-desktop', () => setDeviceFilter('desktop'));
        $(document).on('click', '#clear-filters', clearAllFilters);
        
        // Navigation clavier
        $(document).on('keydown', handleKeyboardShortcuts);
        
        // Refresh automatique (optionnel)
        if ($('#auto-refresh').is(':checked')) {
            setInterval(refreshPage, 30000);
        }
    }
    
    // === GESTION DE LA SÉLECTION ===
    
    function handleSelectAll() {
        const isChecked = this.checked;
        $('input[name="conversation_ids[]"]').prop('checked', isChecked);
        
        selectedConversations.clear();
        if (isChecked) {
            $('input[name="conversation_ids[]"]').each(function() {
                selectedConversations.add($(this).val());
            });
        }
        
        updateActionButtons();
        updateSelectionStats();
    }
    
    function handleIndividualSelect() {
        const conversationId = $(this).val();
        
        if (this.checked) {
            selectedConversations.add(conversationId);
        } else {
            selectedConversations.delete(conversationId);
            $('#select-all').prop('checked', false);
        }
        
        // Vérifier si tout est sélectionné
        const totalCheckboxes = $('input[name="conversation_ids[]"]').length;
        const checkedCheckboxes = $('input[name="conversation_ids[]"]:checked').length;
        
        if (totalCheckboxes === checkedCheckboxes && totalCheckboxes > 0) {
            $('#select-all').prop('checked', true);
        }
        
        updateActionButtons();
        updateSelectionStats();
    }
    
    function updateActionButtons() {
        const selectedCount = selectedConversations.size;
        const $deleteButton = $('#delete-selected');
        const $exportButton = $('#export-conversations');
        
        $deleteButton.prop('disabled', selectedCount === 0);
        
        if (selectedCount > 0) {
            $deleteButton.text(`🗑️ Supprimer sélectionnés (${selectedCount})`);
        } else {
            $deleteButton.text('🗑️ Supprimer sélectionnés');
        }
        
        // Mise à jour du bouton d'export
        $exportButton.prop('disabled', false); // L'export est toujours disponible
    }
    
    function updateSelectionStats() {
        const selectedCount = selectedConversations.size;
        const totalVisible = $('input[name="conversation_ids[]"]').length;
        
        let $statsDiv = $('#selection-stats');
        if ($statsDiv.length === 0) {
            $statsDiv = $('<div id="selection-stats" class="selection-stats"></div>');
            $('.conversation-actions').after($statsDiv);
        }
        
        if (selectedCount > 0) {
            $statsDiv.html(`
                <div class="stats-info">
                    <strong>📊 Sélection:</strong> ${selectedCount} conversation(s) sélectionnée(s) sur ${totalVisible} visible(s)
                    <span class="quick-actions-inline">
                        | <a href="#" id="select-none">Tout désélectionner</a>
                        | <a href="#" id="select-all-page">Sélectionner toute la page</a>
                    </span>
                </div>
            `).show();
        } else {
            $statsDiv.hide();
        }
    }
    
    // Actions de sélection rapide
    $(document).on('click', '#select-none', function(e) {
        e.preventDefault();
        $('input[type="checkbox"]').prop('checked', false);
        selectedConversations.clear();
        updateActionButtons();
        updateSelectionStats();
    });
    
    $(document).on('click', '#select-all-page', function(e) {
        e.preventDefault();
        $('input[name="conversation_ids[]"]').prop('checked', true);
        $('#select-all').prop('checked', true);
        
        selectedConversations.clear();
        $('input[name="conversation_ids[]"]').each(function() {
            selectedConversations.add($(this).val());
        });
        
        updateActionButtons();
        updateSelectionStats();
    });
    
    // === GESTION DES CONVERSATIONS ===
    
    function handleViewConversation() {
        const conversationId = $(this).data('id');
        openConversationModal(conversationId);
    }
    
    function openConversationModal(conversationId) {
        $('#conversation-modal').show();
        $('.conversation-modal-body').html(`
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>🔄 Chargement des détails...</p>
            </div>
        `);
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'loom_chatbot_get_conversation_details',
                security: nonce,
                conversation_id: conversationId
            },
            success: function(response) {
                if (response.success) {
                    $('.conversation-modal-body').html(response.data.html);
                    initializeModalContent();
                } else {
                    $('.conversation-modal-body').html(`
                        <div class="error-message">
                            <p>❌ Erreur lors du chargement: ${response.data.message || 'Erreur inconnue'}</p>
                        </div>
                    `);
                }
            },
            error: function(xhr, status, error) {
                console.error('Erreur AJAX:', status, error);
                $('.conversation-modal-body').html(`
                    <div class="error-message">
                        <p>❌ Erreur de communication avec le serveur.</p>
                        <details>
                            <summary>Détails techniques</summary>
                            <p>Status: ${status}</p>
                            <p>Error: ${error}</p>
                            <p>Code: ${xhr.status}</p>
                        </details>
                    </div>
                `);
            }
        });
    }
    
    function initializeModalContent() {
        // Ajouter des fonctionnalités à la modal
        $('.conversation-modal-body img').on('click', function() {
            const $img = $(this);
            const src = $img.attr('src');
            
            // Créer une lightbox simple
            const $lightbox = $(`
                <div class="image-lightbox" style="
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.9); z-index: 999999;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                ">
                    <img src="${src}" style="max-width: 90%; max-height: 90%; border-radius: 8px;">
                    <div style="position: absolute; top: 20px; right: 20px; color: white; font-size: 24px;">✕</div>
                </div>
            `);
            
            $('body').append($lightbox);
            
            $lightbox.on('click', function() {
                $(this).remove();
            });
        });
    }
    
    function closeConversationModal() {
        $('#conversation-modal').hide();
        $('.image-lightbox').remove();
    }
    
    function handleModalBackdropClick(e) {
        if (e.target === this) {
            closeConversationModal();
        }
    }
    
    // === SUPPRESSION DE CONVERSATIONS ===
    
    function handleDeleteSingle() {
        const conversationId = $(this).data('id');
        const $row = $(this).closest('tr');
        
        if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cette conversation ?')) {
            return;
        }
        
        deleteConversations([conversationId], $row);
    }
    
    function handleDeleteSelected() {
        const selectedIds = Array.from(selectedConversations);
        
        if (selectedIds.length === 0) {
            showNotification('⚠️ Veuillez sélectionner au moins une conversation à supprimer.', 'warning');
            return;
        }
        
        const confirmMessage = selectedIds.length === 1 ? 
            'Êtes-vous sûr de vouloir supprimer cette conversation ?' :
            `Êtes-vous sûr de vouloir supprimer ces ${selectedIds.length} conversations ?`;
        
        if (!confirm(confirmMessage + '\n\n⚠️ Cette action est irréversible.')) {
            return;
        }
        
        deleteConversations(selectedIds);
    }
    
    function deleteConversations(conversationIds, $specificRow = null) {
        if (isLoading) return;
        
        isLoading = true;
        $('.delete-conversation, #delete-selected').prop('disabled', true);
        
        const data = {
            action: 'loom_chatbot_delete_conversation',
            security: nonce
        };
        
        if (conversationIds.length === 1) {
            data.conversation_id = conversationIds[0];
        } else {
            data.conversation_ids = conversationIds;
        }
        
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: data,
            timeout: 30000,
            success: function(response) {
                if (response.success) {
                    if ($specificRow) {
                        // Suppression d'une seule ligne
                        $specificRow.fadeOut(400, function() {
                            $(this).remove();
                            updateConversationCount();
                            checkEmptyState();
                        });
                        showNotification('✅ Conversation supprimée avec succès.', 'success');
                    } else {
                        // Suppression multiple - rechargement avec message
                        const count = conversationIds.length;
                        showNotification(`✅ ${count} conversation(s) supprimée(s) avec succès.`, 'success');
                        
                        // Mettre à jour l'URL pour conserver les filtres
                        const currentUrl = new URL(window.location);
                        currentUrl.searchParams.set('deleted', 'success');
                        
                        setTimeout(() => {
                            window.location.href = currentUrl.toString();
                        }, 1500);
                    }
                    
                    // Nettoyer la sélection
                    conversationIds.forEach(id => selectedConversations.delete(id));
                    updateSelectionStats();
                    loadQuickStats(); // Rafraîchir les statistiques
                    
                } else {
                    showNotification('❌ Erreur lors de la suppression: ' + (response.data.message || 'Erreur inconnue'), 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('Erreur suppression:', status, error);
                
                let errorMessage = '❌ Erreur de communication lors de la suppression.';
                if (status === 'timeout') {
                    errorMessage = '❌ La suppression prend trop de temps. Actualisez la page pour vérifier.';
                } else if (xhr.status === 403) {
                    errorMessage = '❌ Permissions insuffisantes.';
                }
                
                showNotification(errorMessage, 'error');
            },
            complete: function() {
                isLoading = false;
                $('.delete-conversation, #delete-selected').prop('disabled', false);
                updateActionButtons();
            }
        });
    }
    
    // === EXPORT DE CONVERSATIONS ===
    
    function handleExportConversations() {
        const $button = $(this);
        const originalText = $button.text();
        
        if (isLoading) return;
        
        $button.text('📤 Préparation...').prop('disabled', true);
        
        // Construire l'URL d'export avec les filtres actuels
        const exportUrl = new URL(ajaxurl);
        exportUrl.searchParams.set('action', 'loom_chatbot_export_conversations');
        exportUrl.searchParams.set('security', nonce);
        
        // Ajouter les filtres actifs
        if (filters.date) exportUrl.searchParams.set('date_filter', filters.date);
        if (filters.search) exportUrl.searchParams.set('search_filter', filters.search);
        if (filters.device) exportUrl.searchParams.set('device_filter', filters.device);
        
        // Ajouter les conversations sélectionnées si applicable
        if (selectedConversations.size > 0) {
            exportUrl.searchParams.set('selected_only', '1');
            Array.from(selectedConversations).forEach(id => {
                exportUrl.searchParams.append('conversation_ids[]', id);
            });
        }
        
        // Créer et déclencher le téléchargement
        const downloadLink = document.createElement('a');
        downloadLink.href = exportUrl.toString();
        downloadLink.download = `conversations_chatbot_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Feedback utilisateur
        setTimeout(() => {
            $button.text(originalText).prop('disabled', false);
            
            const count = selectedConversations.size;
            const message = count > 0 
                ? `📥 Export lancé ! ${count} conversations sélectionnées.`
                : '📥 Export lancé ! Toutes les conversations filtrées.';
                
            showNotification(message, 'success');
        }, 1000);
    }
    
    // === GESTION DES FILTRES ===
    
    function handleSearchFilter() {
        const searchTerm = $(this).val();
        filters.search = searchTerm;
        
        if (searchTerm.length >= 2 || searchTerm.length === 0) {
            applyFilters();
        }
    }
    
    function handleFilterChange() {
        const $this = $(this);
        const filterName = $this.attr('name').replace('_filter', '');
        filters[filterName] = $this.val();
        
        applyFilters();
    }
    
    function setDateFilter(period) {
        const today = new Date();
        let targetDate;
        
        switch (period) {
            case 'today':
                targetDate = today;
                break;
            case 'week':
                targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - 7);
                break;
            default:
                return;
        }
        
        const dateString = targetDate.toISOString().split('T')[0];
        $('input[name="date_filter"]').val(dateString);
        filters.date = dateString;
        applyFilters();
    }
    
    function setSearchFilter(term) {
        $('input[name="search_filter"]').val(term);
        filters.search = term;
        applyFilters();
    }
    
    function setDeviceFilter(device) {
        $('select[name="device_filter"]').val(device);
        filters.device = device;
        applyFilters();
    }
    
    function clearAllFilters() {
        $('input[name="date_filter"], input[name="search_filter"]').val('');
        $('select[name="device_filter"]').val('');
        
        filters = { date: '', search: '', device: '' };
        applyFilters();
    }
    
    function applyFilters() {
        const url = new URL(window.location);
        
        // Mettre à jour les paramètres d'URL
        Object.keys(filters).forEach(key => {
            const filterKey = key + '_filter';
            if (filters[key]) {
                url.searchParams.set(filterKey, filters[key]);
            } else {
                url.searchParams.delete(filterKey);
            }
        });
        
        // Reset de la pagination
        url.searchParams.delete('paged');
        
        // Naviguer vers la nouvelle URL
        window.location.href = url.toString();
    }
    
    // === STATISTIQUES ET ANALYTICS ===
    
    function loadQuickStats() {
        // Extraire les stats depuis les éléments existants de la page
        const $statBoxes = $('.stat-box');
        if ($statBoxes.length === 0) return;
        
        const stats = {
            total: extractStatNumber($statBoxes.first(), 'Total conversations'),
            today: extractStatNumber($statBoxes.first(), 'Aujourd\'hui'),
            week: extractStatNumber($statBoxes.first(), 'Cette semaine'),
            images: extractStatNumber($statBoxes.first(), 'Avec images'),
            mobile: extractStatNumber($statBoxes.last(), 'Mobile'),
            desktop: extractStatNumber($statBoxes.last(), 'Desktop')
        };
        
        updateStatsDisplay(stats);
        updateChartsData(stats);
    }
    
    function extractStatNumber(element, label) {
        const text = element.text();
        const regex = new RegExp(label + ':\\s*(\\d+)', 'i');
        const match = text.match(regex);
        return match ? parseInt(match[1]) : 0;
    }
    
    function updateStatsDisplay(stats) {
        // Ajouter des métriques calculées
        const mobilePercentage = stats.total > 0 ? ((stats.mobile / stats.total) * 100).toFixed(1) : 0;
        const imagePercentage = stats.total > 0 ? ((stats.images / stats.total) * 100).toFixed(1) : 0;
        
        // Créer ou mettre à jour le panneau de métriques
        let $metricsPanel = $('#metrics-panel');
        if ($metricsPanel.length === 0) {
            $metricsPanel = $(`
                <div id="metrics-panel" class="metrics-panel">
                    <h3>📈 Métriques en temps réel</h3>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-value" id="mobile-percentage">${mobilePercentage}%</div>
                            <div class="metric-label">Trafic Mobile</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value" id="image-percentage">${imagePercentage}%</div>
                            <div class="metric-label">Avec Images</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value" id="growth-rate">--</div>
                            <div class="metric-label">Croissance</div>
                        </div>
                    </div>
                </div>
            `);
            $('.conversation-stats').after($metricsPanel);
        } else {
            // Mise à jour des valeurs existantes
            $('#mobile-percentage').text(mobilePercentage + '%');
            $('#image-percentage').text(imagePercentage + '%');
        }
    }
    
    function initializeCharts() {
        // Créer un graphique simple si les données sont disponibles
        if ($('.stat-box').length > 0) {
            createDeviceChart();
            createTimelineChart();
        }
    }
    
    function updateChartsData(stats) {
        // Mettre à jour les graphiques avec les nouvelles données
        if (window.deviceChart) {
            window.deviceChart.data.datasets[0].data = [stats.mobile, stats.desktop];
            window.deviceChart.update();
        }
    }
    
    function createDeviceChart() {
        const $chartContainer = $(`
            <div class="chart-container">
                <h4>📱 Répartition par appareil</h4>
                <canvas id="device-chart" width="300" height="150"></canvas>
            </div>
        `);
        
        $('#metrics-panel').after($chartContainer);
        
        // Graphique simple en CSS (fallback)
        const stats = {
            mobile: extractStatNumber($('.stat-box').last(), 'Mobile'),
            desktop: extractStatNumber($('.stat-box').last(), 'Desktop')
        };
        
        const total = stats.mobile + stats.desktop;
        if (total > 0) {
            const mobilePercent = (stats.mobile / total) * 100;
            const desktopPercent = (stats.desktop / total) * 100;
            
            $chartContainer.find('canvas').replaceWith(`
                <div class="simple-chart">
                    <div class="chart-bar">
                        <div class="bar-segment mobile" style="width: ${mobilePercent}%" data-tooltip="Mobile: ${stats.mobile} (${mobilePercent.toFixed(1)}%)"></div>
                        <div class="bar-segment desktop" style="width: ${desktopPercent}%" data-tooltip="Desktop: ${stats.desktop} (${desktopPercent.toFixed(1)}%)"></div>
                    </div>
                    <div class="chart-legend">
                        <span class="legend-item"><span class="legend-color mobile"></span> Mobile (${mobilePercent.toFixed(1)}%)</span>
                        <span class="legend-item"><span class="legend-color desktop"></span> Desktop (${desktopPercent.toFixed(1)}%)</span>
                    </div>
                </div>
            `);
        }
    }
    
    function createTimelineChart() {
        // Timeline des conversations récentes (graphique simple)
        // Implementation basique pour montrer l'activité
    }
    
    // === FONCTIONS UTILITAIRES ===
    
    function updateConversationCount() {
        const remainingRows = $('tbody tr').not(':hidden').length;
        if (remainingRows === 1 && $('tbody tr td[colspan]').length > 0) {
            // Plus de conversations, afficher l'état vide
            showEmptyState();
            return;
        }
        
        // Mettre à jour les compteurs
        $('.conversation-count').each(function() {
            const currentCount = parseInt($(this).text()) - 1;
            $(this).text(Math.max(0, currentCount));
        });
    }
    
    function checkEmptyState() {
        const visibleRows = $('tbody tr').not(':hidden').length;
        const emptyMessage = $('tbody tr td[colspan]').length > 0;
        
        if (visibleRows === 0 || emptyMessage) {
            showEmptyState();
        }
    }
    
    function showEmptyState() {
        if ($('#empty-state').length === 0) {
            const $emptyState = $(`
                <div id="empty-state" class="empty-state">
                    <div class="empty-icon">💬</div>
                    <h3>Aucune conversation trouvée</h3>
                    <p>Il n'y a pas de conversations correspondant à vos critères.</p>
                    <button type="button" class="button button-primary" onclick="location.reload()">🔄 Actualiser</button>
                </div>
            `);
            $('.wp-list-table').after($emptyState);
        }
    }
    
    function showNotification(message, type = 'info', duration = 5000) {
        // Supprimer les notifications existantes
        $('.admin-notification').remove();
        
        const notificationClass = {
            'success': 'notice-success',
            'error': 'notice-error',
            'warning': 'notice-warning',
            'info': 'notice-info'
        }[type] || 'notice-info';
        
        const $notification = $(`
            <div class="notice ${notificationClass} is-dismissible admin-notification" style="margin: 10px 0;">
                <p>${message}</p>
                <button type="button" class="notice-dismiss">
                    <span class="screen-reader-text">Ignorer cette notification.</span>
                </button>
            </div>
        `);
        
        // Insérer la notification
        $('.wrap h1').after($notification);
        
        // Gestion de la fermeture
        $notification.find('.notice-dismiss').on('click', function() {
            $notification.fadeOut(300, function() {
                $(this).remove();
            });
        });
        
        // Auto-suppression
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                $notification.fadeOut(300, function() {
                    $(this).remove();
                });
            }, duration);
        }
    }
    
    function initializeTooltips() {
        // Ajouter des tooltips aux éléments avec data-tooltip
        $(document).on('mouseenter', '[data-tooltip]', function() {
            const tooltip = $(this).data('tooltip');
            const $tooltip = $(`<div class="admin-tooltip">${tooltip}</div>`);
            
            $('body').append($tooltip);
            
            const rect = this.getBoundingClientRect();
            $tooltip.css({
                top: rect.top - $tooltip.outerHeight() - 5,
                left: rect.left + (rect.width / 2) - ($tooltip.outerWidth() / 2)
            });
        });
        
        $(document).on('mouseleave', '[data-tooltip]', function() {
            $('.admin-tooltip').remove();
        });
    }
    
    function refreshPage() {
        if (!isLoading) {
            const url = new URL(window.location);
            url.searchParams.set('refreshed', Date.now());
            window.location.href = url.toString();
        }
    }
    
    // === RACCOURCIS CLAVIER ===
    
    function handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + A pour sélectionner tout
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && $(e.target).is('body')) {
            e.preventDefault();
            $('#select-all').prop('checked', true).trigger('change');
        }
        
        // Suppr pour supprimer les éléments sélectionnés
        if (e.key === 'Delete' && !$(e.target).is('input, textarea, select')) {
            if (selectedConversations.size > 0) {
                handleDeleteSelected();
            }
        }
        
        // Ctrl + E pour exporter
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            handleExportConversations();
        }
        
        // Ctrl + F pour focus sur la recherche
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !$(e.target).is('input, textarea')) {
            e.preventDefault();
            $('input[name="search_filter"]').focus().select();
        }
        
        // Échap pour fermer la modal
        if (e.key === 'Escape') {
            closeConversationModal();
        }
        
        // Navigation avec les flèches
        if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
            const $prevLink = $('.tablenav-pages .prev-page');
            if ($prevLink.length && !$prevLink.hasClass('disabled')) {
                window.location.href = $prevLink.attr('href');
            }
        }
        
        if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
            const $nextLink = $('.tablenav-pages .next-page');
            if ($nextLink.length && !$nextLink.hasClass('disabled')) {
                window.location.href = $nextLink.attr('href');
            }
        }
    }
    
    // === UTILITAIRES ===
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    function formatNumber(num) {
        return new Intl.NumberFormat('fr-FR').format(num);
    }
    
    function formatDate(dateString) {
        return new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    }
    
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('📋 Copié dans le presse-papiers', 'success', 2000);
            });
        } else {
            // Fallback pour navigateurs plus anciens
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showNotification('📋 Copié dans le presse-papiers', 'success', 2000);
            } catch (err) {
                console.error('Erreur de copie:', err);
            }
            document.body.removeChild(textArea);
        }
    }
    
    // === ACTIONS RAPIDES AVANCÉES ===
    
    function addQuickActionsPanel() {
        const $quickActions = $(`
            <div class="quick-actions-panel">
                <h3>⚡ Actions rapides</h3>
                <div class="quick-actions-grid">
                    <button type="button" class="quick-action-btn" id="filter-today">
                        <span class="icon">📅</span>
                        <span class="label">Aujourd'hui</span>
                    </button>
                    <button type="button" class="quick-action-btn" id="filter-week">
                        <span class="icon">📅</span>
                        <span class="label">Cette semaine</span>
                    </button>
                    <button type="button" class="quick-action-btn" id="filter-images">
                        <span class="icon">📷</span>
                        <span class="label">Avec images</span>
                    </button>
                    <button type="button" class="quick-action-btn" id="filter-mobile">
                        <span class="icon">📱</span>
                        <span class="label">Mobile</span>
                    </button>
                    <button type="button" class="quick-action-btn" id="filter-desktop">
                        <span class="icon">🖥️</span>
                        <span class="label">Desktop</span>
                    </button>
                    <button type="button" class="quick-action-btn" id="clear-filters">
                        <span class="icon">🔄</span>
                        <span class="label">Effacer filtres</span>
                    </button>
                </div>
            </div>
        `);
        
        $('.conversation-filters').after($quickActions);
    }
    
    function addBulkActionsPanel() {
        const $bulkActions = $(`
            <div class="bulk-actions-panel" style="display: none;">
                <h4>🔧 Actions groupées</h4>
                <div class="bulk-actions-buttons">
                    <button type="button" class="button" id="bulk-export-selected">
                        📤 Exporter sélectionnées
                    </button>
                    <button type="button" class="button" id="bulk-mark-important">
                        ⭐ Marquer importantes
                    </button>
                    <button type="button" class="button" id="bulk-analyze">
                        📊 Analyser sélectionnées
                    </button>
                    <button type="button" class="button button-secondary" id="bulk-delete-confirm">
                        🗑️ Supprimer définitivement
                    </button>
                </div>
            </div>
        `);
        
        $('.conversation-actions').after($bulkActions);
        
        // Afficher/masquer selon la sélection
        function toggleBulkPanel() {
            if (selectedConversations.size > 0) {
                $bulkActions.slideDown();
            } else {
                $bulkActions.slideUp();
            }
        }
        
        // Bind sur les changements de sélection
        $(document).on('change', 'input[type="checkbox"]', toggleBulkPanel);
    }
    
    // === ANALYTICS AVANCÉES ===
    
    function generateAnalyticsReport() {
        const $report = $(`
            <div class="analytics-report">
                <h3>📈 Rapport d'analyse</h3>
                <div class="analytics-sections">
                    <div class="analytics-section">
                        <h4>Tendances d'utilisation</h4>
                        <div id="usage-trends"></div>
                    </div>
                    <div class="analytics-section">
                        <h4>Répartition temporelle</h4>
                        <div id="time-distribution"></div>
                    </div>
                    <div class="analytics-section">
                        <h4>Performance par appareil</h4>
                        <div id="device-performance"></div>
                    </div>
                </div>
            </div>
        `);
        
        $('#metrics-panel').after($report);
        populateAnalyticsData();
    }
    
    function populateAnalyticsData() {
        // Analyser les données présentes sur la page
        const conversations = [];
        $('tbody tr').each(function() {
            const $row = $(this);
            if ($row.find('td').length > 1) { // Ignorer les lignes vides
                conversations.push({
                    date: $row.find('td:eq(1)').text().trim(),
                    device: $row.find('td:eq(6)').text().includes('Mobile') ? 'mobile' : 'desktop',
                    hasImage: $row.find('td:eq(5)').text().includes('Oui'),
                    questionLength: $row.find('td:eq(3)').text().trim().length
                });
            }
        });
        
        if (conversations.length > 0) {
            displayUsageTrends(conversations);
            displayTimeDistribution(conversations);
            displayDevicePerformance(conversations);
        }
    }
    
    function displayUsageTrends(conversations) {
        const mobileCount = conversations.filter(c => c.device === 'mobile').length;
        const desktopCount = conversations.filter(c => c.device === 'desktop').length;
        const imageCount = conversations.filter(c => c.hasImage).length;
        
        const trendData = {
            mobile: ((mobileCount / conversations.length) * 100).toFixed(1),
            desktop: ((desktopCount / conversations.length) * 100).toFixed(1),
            images: ((imageCount / conversations.length) * 100).toFixed(1)
        };
        
        $('#usage-trends').html(`
            <div class="trend-metrics">
                <div class="trend-item">
                    <span class="trend-label">Utilisation mobile:</span>
                    <span class="trend-value">${trendData.mobile}%</span>
                    <span class="trend-bar">
                        <span class="trend-fill" style="width: ${trendData.mobile}%"></span>
                    </span>
                </div>
                <div class="trend-item">
                    <span class="trend-label">Utilisation desktop:</span>
                    <span class="trend-value">${trendData.desktop}%</span>
                    <span class="trend-bar">
                        <span class="trend-fill" style="width: ${trendData.desktop}%"></span>
                    </span>
                </div>
                <div class="trend-item">
                    <span class="trend-label">Conversations avec images:</span>
                    <span class="trend-value">${trendData.images}%</span>
                    <span class="trend-bar">
                        <span class="trend-fill" style="width: ${trendData.images}%"></span>
                    </span>
                </div>
            </div>
        `);
    }
    
    function displayTimeDistribution(conversations) {
        // Analyser la distribution par heure (si données disponibles)
        $('#time-distribution').html(`
            <div class="time-info">
                <p>📊 Total de conversations analysées: <strong>${conversations.length}</strong></p>
                <p>📱 Conversations mobiles: <strong>${conversations.filter(c => c.device === 'mobile').length}</strong></p>
                <p>🖥️ Conversations desktop: <strong>${conversations.filter(c => c.device === 'desktop').length}</strong></p>
            </div>
        `);
    }
    
    function displayDevicePerformance(conversations) {
        const avgMobileQuestionLength = conversations
            .filter(c => c.device === 'mobile')
            .reduce((sum, c) => sum + c.questionLength, 0) / conversations.filter(c => c.device === 'mobile').length || 0;
            
        const avgDesktopQuestionLength = conversations
            .filter(c => c.device === 'desktop')
            .reduce((sum, c) => sum + c.questionLength, 0) / conversations.filter(c => c.device === 'desktop').length || 0;
        
        $('#device-performance').html(`
            <div class="performance-metrics">
                <div class="performance-item">
                    <h5>📱 Mobile</h5>
                    <p>Longueur moyenne des questions: <strong>${Math.round(avgMobileQuestionLength)} caractères</strong></p>
                </div>
                <div class="performance-item">
                    <h5>🖥️ Desktop</h5>
                    <p>Longueur moyenne des questions: <strong>${Math.round(avgDesktopQuestionLength)} caractères</strong></p>
                </div>
            </div>
        `);
    }
    
    // === SAUVEGARDE DES PRÉFÉRENCES ===
    
    function saveUserPreferences() {
        const preferences = {
            filters: filters,
            selectedView: 'list', // ou 'grid' si implémenté
            sortOrder: 'desc',
            itemsPerPage: 50,
            autoRefresh: $('#auto-refresh').is(':checked'),
            lastUpdated: Date.now()
        };
        
        try {
            localStorage.setItem('loom_chatbot_admin_prefs', JSON.stringify(preferences));
        } catch (e) {
            console.log('Impossible de sauvegarder les préférences');
        }
    }
    
    function loadUserPreferences() {
        try {
            const saved = localStorage.getItem('loom_chatbot_admin_prefs');
            if (saved) {
                const preferences = JSON.parse(saved);
                
                // Appliquer les préférences sauvegardées
                if (preferences.autoRefresh) {
                    $('#auto-refresh').prop('checked', true);
                }
                
                return preferences;
            }
        } catch (e) {
            console.log('Impossible de charger les préférences');
        }
        
        return null;
    }
    
    // === GESTION DES ERREURS GLOBALES ===
    
    $(document).ajaxError(function(event, jqXHR, ajaxSettings, thrownError) {
        console.error('Erreur AJAX globale:', {
            url: ajaxSettings.url,
            status: jqXHR.status,
            error: thrownError,
            response: jqXHR.responseText
        });
        
        if (!isLoading) return; // Éviter les notifications multiples
        
        let message = 'Erreur de communication avec le serveur.';
        
        switch (jqXHR.status) {
            case 0:
                message = 'Problème de connexion internet.';
                break;
            case 403:
                message = 'Erreur d\'autorisation. Veuillez rafraîchir la page.';
                break;
            case 404:
                message = 'Ressource non trouvée.';
                break;
            case 500:
                message = 'Erreur serveur interne.';
                break;
            case 502:
            case 503:
            case 504:
                message = 'Serveur temporairement indisponible.';
                break;
        }
        
        showNotification(`❌ ${message}`, 'error');
    });
    
    // === AMÉLIORATION DE L'INTERFACE ===
    
    function enhanceInterface() {
        // Ajouter des indicateurs visuels
        addLoadingIndicators();
        addProgressBars();
        addSearchHighlighting();
        addSortingIndicators();
        addRowHoverEffects();
    }
    
    function addLoadingIndicators() {
        // Spinner pour les actions longues
        const $spinner = $(`
            <div id="global-spinner" class="global-spinner" style="display: none;">
                <div class="spinner-overlay"></div>
                <div class="spinner-content">
                    <div class="spinner"></div>
                    <p>Traitement en cours...</p>
                </div>
            </div>
        `);
        
        $('body').append($spinner);
    }
    
    function addProgressBars() {
        // Barres de progression pour les opérations longues
        function showProgress(percentage) {
            let $progress = $('#operation-progress');
            if ($progress.length === 0) {
                $progress = $(`
                    <div id="operation-progress" class="operation-progress">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <div class="progress-text">0%</div>
                    </div>
                `);
                $('.wrap').prepend($progress);
            }
            
            $progress.find('.progress-fill').css('width', percentage + '%');
            $progress.find('.progress-text').text(Math.round(percentage) + '%');
            
            if (percentage >= 100) {
                setTimeout(() => $progress.fadeOut(), 1000);
            }
        }
        
        window.showProgress = showProgress; // Exposer globalement
    }
    
    function addSearchHighlighting() {
        // Mettre en évidence les termes de recherche
        const searchTerm = filters.search;
        if (searchTerm && searchTerm.length > 1) {
            $('.conversation-preview').each(function() {
                const $this = $(this);
                const text = $this.text();
                const highlightedText = text.replace(
                    new RegExp(`(${escapeRegex(searchTerm)})`, 'gi'),
                    '<mark>$1</mark>'
                );
                $this.html(highlightedText);
            });
        }
    }
    
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\        // Navigation avec les flèches
        if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
            const $prevLink = $('.tablenav-pages .prev-page');
    }
    
    function addSortingIndicators() {
        // Ajouter des flèches de tri (si applicable)
        $('.wp-list-table th').each(function() {
            const $th = $(this);
            if ($th.find('a').length > 0) {
                $th.addClass('sortable');
                $th.append('<span class="sort-indicator"></span>');
            }
        });
    }
    
    function addRowHoverEffects() {
        // Effets visuels au survol des lignes
        $('tbody tr').hover(
            function() { 
                $(this).addClass('row-highlight'); 
            },
            function() { 
                $(this).removeClass('row-highlight'); 
            }
        );
    }
    
    // === STYLES CSS DYNAMIQUES ===
    
    function addDynamicStyles() {
        $('<style>').text(`
            .metrics-panel {
                background: #fff;
                border: 1px solid #ccd0d4;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-top: 15px;
            }
            
            .metric-card {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                border: 1px solid #dee2e6;
            }
            
            .metric-value {
                font-size: 24px;
                font-weight: bold;
                color: #495057;
                margin-bottom: 5px;
            }
            
            .metric-label {
                font-size: 12px;
                color: #6c757d;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .chart-container {
                background: #fff;
                border: 1px solid #ccd0d4;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .simple-chart {
                margin: 15px 0;
            }
            
            .chart-bar {
                height: 30px;
                background: #f8f9fa;
                border-radius: 15px;
                overflow: hidden;
                display: flex;
            }
            
            .bar-segment {
                height: 100%;
                cursor: pointer;
                position: relative;
            }
            
            .bar-segment.mobile {
                background: linear-gradient(90deg, #007cba, #00a0d2);
            }
            
            .bar-segment.desktop {
                background: linear-gradient(90deg, #50575e, #6c757d);
            }
            
            .chart-legend {
                display: flex;
                justify-content: center;
                gap: 20px;
                margin-top: 10px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                font-size: 12px;
            }
            
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
                margin-right: 5px;
            }
            
            .legend-color.mobile {
                background: linear-gradient(90deg, #007cba, #00a0d2);
            }
            
            .legend-color.desktop {
                background: linear-gradient(90deg, #50575e, #6c757d);
            }
            
            .quick-actions-panel {
                background: #fff;
                border: 1px solid #ccd0d4;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .quick-actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 10px;
                margin-top: 15px;
            }
            
            .quick-action-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 12px 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                background: #fff;
                cursor: pointer;
                transition: all 0.2s ease;
                text-decoration: none;
            }
            
            .quick-action-btn:hover {
                border-color: #007cba;
                background: #f8f9fa;
                transform: translateY(-2px);
            }
            
            .quick-action-btn .icon {
                font-size: 18px;
                margin-bottom: 5px;
            }
            
            .quick-action-btn .label {
                font-size: 11px;
                color: #666;
            }
            
            .selection-stats {
                background: #e7f3ff;
                border: 1px solid #b3d7ff;
                border-radius: 4px;
                padding: 10px 15px;
                margin: 10px 0;
            }
            
            .stats-info {
                font-size: 14px;
                color: #0073aa;
            }
            
            .quick-actions-inline a {
                color: #0073aa;
                text-decoration: none;
                margin: 0 5px;
            }
            
            .loading-spinner {
                text-align: center;
                padding: 40px;
                color: #666;
            }
            
            .loading-spinner .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #0073aa;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .error-message {
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 4px;
                padding: 15px;
                color: #dc2626;
            }
            
            .admin-notification {
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                border-left: 4px solid;
            }
            
            .notice-success {
                border-left-color: #46b450;
            }
            
            .notice-error {
                border-left-color: #dc3232;
            }
            
            .notice-warning {
                border-left-color: #ffb900;
            }
            
            .row-highlight {
                background-color: #f0f8ff !important;
            }
            
            .admin-tooltip {
                position: absolute;
                background: #333;
                color: #fff;
                padding: 5px 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                pointer-events: none;
            }
            
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: #666;
            }
            
            .empty-icon {
                font-size: 48px;
                margin-bottom: 20px;
            }
            
            .analytics-report {
                background: #fff;
                border: 1px solid #ccd0d4;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .analytics-sections {
                display: grid;
                gap: 20px;
            }
            
            .analytics-section {
                padding: 15px;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
            }
            
            .trend-item {
                display: grid;
                grid-template-columns: 1fr auto 100px;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
            
            .trend-bar {
                height: 8px;
                background: #f0f0f0;
                border-radius: 4px;
                overflow: hidden;
            }
            
            .trend-fill {
                height: 100%;
                background: linear-gradient(90deg, #007cba, #00a0d2);
                transition: width 0.3s ease;
            }
            
            .bulk-actions-panel {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 6px;
                padding: 15px;
                margin: 15px 0;
            }
            
            .bulk-actions-buttons {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-top: 10px;
            }
            
            @media (max-width: 768px) {
                .metrics-grid {
                    grid-template-columns: 1fr;
                }
                
                .quick-actions-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .bulk-actions-buttons {
                    flex-direction: column;
                }
            }
        `).appendTo('head');
    }
    
    // === INITIALISATION FINALE ===
    
    // Initialiser tout au chargement de la page
    initializeAdmin();
    loadUserPreferences();
    addQuickActionsPanel();
    addBulkActionsPanel();
    enhanceInterface();
    addDynamicStyles();
    
    // Analyser et générer le rapport si des données sont présentes
    if ($('tbody tr').length > 1) {
        generateAnalyticsReport();
    }
    
    // Sauvegarder les préférences avant de quitter
    $(window).on('beforeunload', saveUserPreferences);
    
    // Afficher les messages de succès depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('deleted') === 'success') {
        showNotification('✅ Conversations supprimées avec succès.', 'success');
    }
    if (urlParams.get('exported') === 'success') {
        showNotification('📥 Export terminé avec succès.', 'success');
    }
    if (urlParams.get('updated') === 'success') {
        showNotification('✅ Paramètres mis à jour avec succès.', 'success');
    }
    
    // Message de bienvenue pour les nouveaux utilisateurs
    if (!localStorage.getItem('loom_chatbot_admin_welcome_7.18')) {
        setTimeout(() => {
            showNotification(`
                👋 Interface d'administration Loom Chatbot v7.18 chargée ! 
                Nouvelles fonctionnalités : Analytics d'appareils, filtres avancés, raccourcis clavier.
                Aide : Ctrl+F (recherche), Ctrl+A (sélectionner), Ctrl+E (exporter), Suppr (supprimer)
            `, 'info', 8000);
            localStorage.setItem('loom_chatbot_admin_welcome_7.18', 'true');
        }, 1500);
    }
    
    console.log('🎉 Loom Chatbot Admin v7.18: Interface complètement initialisée');
    console.log('📊 Fonctionnalités actives:', {
        deviceAnalytics: true,
        advancedFiltering: true,
        bulkActions: true,
        keyboardShortcuts: true,
        realTimeStats: true,
        exportEnhancements: true,
        responsiveInterface: true,
        version: '7.18'
    });
});