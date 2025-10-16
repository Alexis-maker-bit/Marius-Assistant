/**
 * Loom Chatbot - Admin Interface Script v7.18
 * Manages conversations, exports, and modal interactions
 */

(function($) {
    'use strict';

    const LoomChatbotAdmin = {
        init: function() {
            this.setupEventListeners();
            this.debugLog('Admin interface initialized');
        },

        setupEventListeners: function() {
            // Select all checkbox
            $('#select-all').on('change', this.handleSelectAll.bind(this));

            // View conversation
            $(document).on('click', '.view-conversation', this.viewConversation.bind(this));

            // Delete single conversation
            $(document).on('click', '.delete-conversation', this.deleteConversation.bind(this));

            // Delete selected conversations
            $('#delete-selected').on('click', this.deleteSelected.bind(this));

            // Export conversations
            $('#export-conversations').on('click', this.exportConversations.bind(this));

            // Close modal
            $('.conversation-modal-close').on('click', this.closeModal.bind(this));

            // Close modal on outside click
            $(document).on('click', '.conversation-modal', (e) => {
                if ($(e.target).hasClass('conversation-modal')) {
                    this.closeModal();
                }
            });

            // Close modal on escape key
            $(document).on('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeModal();
                }
            });
        },

        handleSelectAll: function(e) {
            const isChecked = $(e.target).prop('checked');
            $('input[name="conversation_ids[]"]').prop('checked', isChecked);
        },

        viewConversation: function(e) {
            e.preventDefault();
            const conversationId = $(e.currentTarget).data('id');
            
            this.debugLog('Viewing conversation:', conversationId);

            // Show loading in modal
            this.openModal();
            $('.conversation-modal-body').html('<p style="text-align: center; padding: 40px;">Chargement...</p>');

            $.ajax({
                url: loom_chatbot_admin_obj.ajax_url,
                method: 'POST',
                data: {
                    action: 'loom_chatbot_get_conversation_details',
                    security: loom_chatbot_admin_obj.nonce,
                    conversation_id: conversationId
                },
                success: (response) => {
                    if (response.success && response.data.html) {
                        $('.conversation-modal-body').html(response.data.html);
                    } else {
                        $('.conversation-modal-body').html('<p style="color: red;">Erreur lors du chargement de la conversation.</p>');
                    }
                },
                error: () => {
                    $('.conversation-modal-body').html('<p style="color: red;">Impossible de charger la conversation.</p>');
                }
            });
        },

        deleteConversation: function(e) {
            e.preventDefault();
            const conversationId = $(e.currentTarget).data('id');

            if (!confirm('Êtes-vous sûr de vouloir supprimer cette conversation ?')) {
                return;
            }

            this.debugLog('Deleting conversation:', conversationId);

            $.ajax({
                url: loom_chatbot_admin_obj.ajax_url,
                method: 'POST',
                data: {
                    action: 'loom_chatbot_delete_conversation',
                    security: loom_chatbot_admin_obj.nonce,
                    conversation_id: conversationId
                },
                success: (response) => {
                    if (response.success) {
                        // Remove row from table
                        $(e.currentTarget).closest('tr').fadeOut(400, function() {
                            $(this).remove();
                        });
                        this.showNotice('success', response.data.message);
                    } else {
                        this.showNotice('error', response.data.message);
                    }
                },
                error: () => {
                    this.showNotice('error', 'Erreur lors de la suppression.');
                }
            });
        },

        deleteSelected: function() {
            const selectedIds = [];
            $('input[name="conversation_ids[]"]:checked').each(function() {
                selectedIds.push($(this).val());
            });

            if (selectedIds.length === 0) {
                alert('Veuillez sélectionner au moins une conversation.');
                return;
            }

            if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedIds.length} conversation(s) ?`)) {
                return;
            }

            this.debugLog('Deleting selected conversations:', selectedIds);

            $.ajax({
                url: loom_chatbot_admin_obj.ajax_url,
                method: 'POST',
                data: {
                    action: 'loom_chatbot_delete_conversation',
                    security: loom_chatbot_admin_obj.nonce,
                    conversation_ids: selectedIds
                },
                success: (response) => {
                    if (response.success) {
                        // Reload page to show updated list
                        location.reload();
                    } else {
                        this.showNotice('error', response.data.message);
                    }
                },
                error: () => {
                    this.showNotice('error', 'Erreur lors de la suppression.');
                }
            });
        },

        exportConversations: function() {
            this.debugLog('Exporting conversations');

            // Create a temporary form and submit it
            const $form = $('<form>', {
                method: 'POST',
                action: loom_chatbot_admin_obj.ajax_url
            });

            $form.append($('<input>', {
                type: 'hidden',
                name: 'action',
                value: 'loom_chatbot_export_conversations'
            }));

            $form.append($('<input>', {
                type: 'hidden',
                name: 'security',
                value: loom_chatbot_admin_obj.nonce
            }));

            $form.appendTo('body').submit().remove();
        },

        openModal: function() {
            $('#conversation-modal').fadeIn(300);
            $('body').css('overflow', 'hidden');
        },

        closeModal: function() {
            $('#conversation-modal').fadeOut(300);
            $('body').css('overflow', '');
        },

        showNotice: function(type, message) {
            const noticeClass = type === 'success' ? 'notice-success' : 'notice-error';
            const $notice = $(`<div class="notice ${noticeClass} is-dismissible"><p>${message}</p></div>`);
            
            $('.wrap h1').after($notice);
            
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
                $notice.fadeOut(400, function() {
                    $(this).remove();
                });
            }, 5000);
        },

        debugLog: function(...args) {
            if (window.console && window.console.log) {
                console.log('[Loom Chatbot Admin]', ...args);
            }
        }
    };

    // Initialize when DOM is ready
    $(document).ready(function() {
        LoomChatbotAdmin.init();
    });

})(jQuery);
