class ChatApp {
    constructor() {
        this.ws = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.sessionId = this.generateSessionId();
        this.pollingInterval = null;
        this.lastMessageTime = null;
        this.useWebSocket = true; // Try WebSocket first, fallback to polling
        this.pushNotificationsEnabled = false;
        this.vapidPublicKey = null;
        
        // Internationalization
        this.currentLanguage = 'pl';
        this.translations = {};
        
        this.initElements();
        this.bindEvents();
        this.initServiceWorker();
        this.initTheme();
        this.initLanguage();
        this.showLoginScreen();
    }

    initElements() {
        // Screens
        this.loginScreen = document.getElementById('login-screen');
        this.chatScreen = document.getElementById('chat-screen');
        
        // Login elements
        this.usernameInput = document.getElementById('username-input');
        this.loginBtn = document.getElementById('login-btn');
        
        // Chat elements
        this.currentRoomName = document.getElementById('current-room-name');
        this.currentUsername = document.getElementById('current-username');
        this.connectionStatus = document.getElementById('connection-status');
        this.languageToggle = document.getElementById('language-toggle');
        this.themeToggle = document.getElementById('theme-toggle');
        this.logoutBtn = document.getElementById('logout-btn');
        this.roomsList = document.getElementById('rooms-list');
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.messageInputContainer = document.getElementById('message-input-container');
        
        // Modal elements
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.createRoomModal = document.getElementById('create-room-modal');
        this.roomNameInput = document.getElementById('room-name-input');
        this.createRoomConfirm = document.getElementById('create-room-confirm');
        this.createRoomCancel = document.getElementById('create-room-cancel');
        
        // Emoji elements
        this.emojiBtn = document.getElementById('emoji-btn');
        this.emojiPicker = document.getElementById('emoji-picker');
        this.emojiGrid = document.getElementById('emoji-grid');
        this.emojiCategories = document.querySelectorAll('.emoji-category');
    }

    bindEvents() {
        // Login events
        this.loginBtn.addEventListener('click', () => this.login());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        // Chat events
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Room creation events
        this.createRoomBtn.addEventListener('click', () => this.showCreateRoomModal());
        this.createRoomConfirm.addEventListener('click', () => this.createRoom());
        this.createRoomCancel.addEventListener('click', () => this.hideCreateRoomModal());
        this.roomNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });
        
        // Modal close on background click
        this.createRoomModal.addEventListener('click', (e) => {
            if (e.target === this.createRoomModal) {
                this.hideCreateRoomModal();
            }
        });
        
        // Language toggle
        this.languageToggle.addEventListener('click', () => this.toggleLanguage());
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Emoji picker events
        this.emojiBtn.addEventListener('click', () => this.toggleEmojiPicker());
        this.emojiCategories.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchEmojiCategory(e.target.dataset.category));
        });
        
        // Close emoji picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.emojiPicker.contains(e.target) && !this.emojiBtn.contains(e.target)) {
                this.hideEmojiPicker();
            }
        });
        
        // Initialize emoji picker
        this.initEmojiPicker();
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showLoginScreen() {
        this.loginScreen.classList.add('active');
        this.chatScreen.classList.remove('active');
        this.usernameInput.focus();
    }

    showChatScreen() {
        this.loginScreen.classList.remove('active');
        this.chatScreen.classList.add('active');
        this.updateChatTexts();
    }

    async login() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            alert(this.t('login.error') + ': ' + this.t('login.placeholder'));
            return;
        }
        
        if (username.length > 50) {
            alert(this.t('login.error') + ': Nazwa użytkownika jest zbyt długa (max 50 znaków)');
            return;
        }

        this.loginBtn.disabled = true;
        this.loginBtn.textContent = 'Łączenie...';
        
        try {
            // Try API login first
            const response = await fetch('/api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=login&username=${encodeURIComponent(username)}&session_id=${this.sessionId}`
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = {
                    id: data.user_id,
                    user_id: data.user_id, // Add both for compatibility
                    username: data.username
                };
                
                this.currentUsername.textContent = data.username;
                this.showChatScreen();
                this.updateConnectionStatus(true, 'API');
                this.requestRoomsList();
                
                // Initialize push notifications
                this.updatePushButtonState();
                
                // Try WebSocket connection
                this.tryWebSocketConnection();
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert(this.t('login.error') + ': ' + error.message);
        }
        
        this.loginBtn.disabled = false;
        this.loginBtn.textContent = this.t('login.button');
    }

    tryWebSocketConnection() {
        try {
            // Auto-detect WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = window.location.port ? ':' + window.location.port : '';
            const wsUrl = `${protocol}//${host}${port}`;
            
            console.log('Trying WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.useWebSocket = true;
                this.updateConnectionStatus(true, 'WebSocket');
                this.authenticate();
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected, switching to polling');
                this.useWebSocket = false;
                this.updateConnectionStatus(true, 'Polling');
                this.startPolling();
            };
            
            this.ws.onerror = (error) => {
                console.log('WebSocket failed, using polling mode');
                this.useWebSocket = false;
                this.updateConnectionStatus(true, 'Polling');
                this.startPolling();
            };
            
        } catch (error) {
            console.log('WebSocket not available, using polling mode');
            this.useWebSocket = false;
            this.updateConnectionStatus(true, 'Polling');
            this.startPolling();
        }
    }

    authenticate() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({
                type: 'auth',
                username: this.currentUser.username,
                session_id: this.sessionId
            });
        }
    }

    startPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        this.pollingInterval = setInterval(() => {
            if (this.currentRoom) {
                this.pollMessages();
            }
        }, 2000); // Poll every 2 seconds
    }

    async pollMessages() {
        if (!this.currentRoom) return;
        
        try {
            const since = this.lastMessageTime ? `&since=${encodeURIComponent(this.lastMessageTime)}` : '';
            const response = await fetch(`/api.php?action=get_messages&room_id=${this.currentRoom.id}${since}`);
            const data = await response.json();
            
            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(message => {
                    this.displayMessage(message);
                    this.lastMessageTime = message.created_at;
                });
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'auth_success':
                this.handleAuthSuccess(data);
                break;
            case 'rooms_list':
                this.updateRoomsList(data.rooms);
                break;
            case 'room_joined':
                this.handleRoomJoined(data);
                break;
            case 'new_message':
                this.displayMessage(data.message);
                break;
            case 'user_joined':
                this.displaySystemMessage(data.username + ' dołączył do pokoju');
                break;
            case 'user_left':
                this.displaySystemMessage(data.username + ' opuścił pokój');
                break;
        }
    }

    handleAuthSuccess(data) {
        this.updateConnectionStatus(true, 'WebSocket');
        this.requestRoomsList();
    }

    async requestRoomsList() {
        if (this.useWebSocket && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'get_rooms' });
        } else {
            try {
                const response = await fetch('/api.php?action=get_rooms');
                const data = await response.json();
                this.updateRoomsList(data.rooms);
            } catch (error) {
                console.error('Error fetching rooms:', error);
            }
        }
    }

    updateRoomsList(rooms) {
        this.roomsList.innerHTML = '';
        
        rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'room-item';
            roomElement.dataset.roomId = room.id;
            
            roomElement.innerHTML = `
                <div class="room-name">${this.escapeHtml(room.name)}</div>
                <div class="room-info">${room.active_users || 0} aktywnych użytkowników</div>
            `;
            
            roomElement.addEventListener('click', () => this.joinRoom(room));
            this.roomsList.appendChild(roomElement);
        });
    }

    async joinRoom(room) {
        this.currentRoom = room;
        this.currentRoomName.textContent = room.name;
        this.messageInputContainer.style.display = 'flex';
        
        // Clear messages
        this.messagesContainer.innerHTML = '';
        
        // Load room messages
        try {
            const response = await fetch(`/api.php?action=get_messages&room_id=${room.id}`);
            const data = await response.json();
            
            if (data.messages) {
                data.messages.forEach(message => {
                    this.displayMessage(message);
                    this.lastMessageTime = message.created_at;
                });
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
        
        // Update active room in sidebar
        this.updateActiveRoom(room.id);
        this.scrollToBottom();
        this.messageInput.focus();
        
        // Start polling if not using WebSocket
        if (!this.useWebSocket) {
            this.startPolling();
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.currentRoom) return;
        
        if (message.length > 1000) {
            alert('Wiadomość jest zbyt długa (max 1000 znaków)');
            return;
        }

        try {
            if (this.useWebSocket && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'message',
                    message: message
                });
            } else {
                const response = await fetch('/api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=send_message&room_id=${this.currentRoom.id}&user_id=${this.currentUser.id}&message=${encodeURIComponent(message)}`
                });
                
                const data = await response.json();
                if (data.success) {
                    this.displayMessage(data.message);
                    this.lastMessageTime = data.message.created_at;
                }
            }
            
            this.messageInput.value = '';
            this.messageInput.focus();
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    updateActiveRoom(roomId) {
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeRoom = document.querySelector(`[data-room-id="${roomId}"]`);
        if (activeRoom) {
            activeRoom.classList.add('active');
        }
    }

    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const date = new Date(message.created_at);
        const timeString = date.toLocaleTimeString('pl-PL', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-author">${this.escapeHtml(message.username)}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.message)}</div>
        `;
        
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    displaySystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        messageElement.textContent = text;
        
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    updateConnectionStatus(connected, mode = '') {
        if (connected) {
            let statusText;
            if (mode === 'WebSocket') {
                statusText = this.t('chat.connectedWebsocket');
            } else if (mode === 'Polling' || mode === 'API') {
                statusText = this.t('chat.connectedPolling');
            } else {
                statusText = `${this.t('chat.connectedPolling')} (${mode})`;
            }
            this.connectionStatus.textContent = statusText;
            this.connectionStatus.className = 'status-connected';
        } else {
            this.connectionStatus.textContent = this.t('chat.disconnected');
            this.connectionStatus.className = 'status-disconnected';
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    showCreateRoomModal() {
        this.createRoomModal.classList.add('active');
        this.roomNameInput.value = '';
        this.roomNameInput.focus();
    }

    hideCreateRoomModal() {
        this.createRoomModal.classList.remove('active');
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('chatTheme', newTheme);
        
        // Update theme toggle icon
        this.themeToggle.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        this.updateThemeToggleTitle();
    }

    initTheme() {
        // Load saved theme or default to light
        const savedTheme = localStorage.getItem('chatTheme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Update theme toggle icon
        this.themeToggle.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
        this.updateThemeToggleTitle();
    }

    async initLanguage() {
        // Load saved language or default to Polish
        this.currentLanguage = localStorage.getItem('chatLanguage') || 'pl';
        
        try {
            // Load translation files
            await this.loadTranslations();
            
            // Update UI with translations
            this.updateLanguageToggle();
            this.updateAllTexts();
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    }

    async loadTranslations() {
        try {
            const response = await fetch(`i18n/${this.currentLanguage}.json`);
            if (!response.ok) throw new Error(`Failed to load ${this.currentLanguage}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error(`Error loading translations for ${this.currentLanguage}:`, error);
            // Fallback to Polish if English fails
            if (this.currentLanguage !== 'pl') {
                this.currentLanguage = 'pl';
                const response = await fetch('i18n/pl.json');
                this.translations = await response.json();
            }
        }
    }

    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'pl' ? 'en' : 'pl';
        localStorage.setItem('chatLanguage', this.currentLanguage);
        
        this.loadTranslations().then(() => {
            this.updateLanguageToggle();
            this.updateAllTexts();
            
            // Pokaż powiadomienie o zmianie języka - najpierw krótko, potem alert
            setTimeout(() => {
                const message = this.currentLanguage === 'pl' ? 
                    this.t('language.switchedTo') : 
                    this.t('language.switchedTo');
                alert(message);
            }, 100);
        });
    }

    updateLanguageToggle() {
        const flagElement = document.getElementById('lang-flag');
        if (flagElement) {
            flagElement.textContent = this.currentLanguage === 'pl' ? '🇺🇸' : '🇵🇱';
        }
        this.languageToggle.title = this.t('language.toggle');
    }

    updateThemeToggleTitle() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        this.themeToggle.title = currentTheme === 'dark' ? this.t('theme.toggleLight') : this.t('theme.toggleDark');
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }
        
        return value;
    }

    updateAllTexts() {
        // Update login screen
        const loginTitle = document.querySelector('#login-screen h1');
        if (loginTitle) loginTitle.textContent = this.t('login.title');
        
        this.usernameInput.placeholder = this.t('login.placeholder');
        
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) loginBtn.textContent = this.t('login.button');
        
        // Update chat interface if visible
        if (!this.loginScreen.classList.contains('active')) {
            this.updateChatTexts();
        }
    }

    updateChatTexts() {
        // Update header
        if (this.currentRoom) {
            this.currentRoomName.textContent = this.currentRoom.name;
        } else {
            this.currentRoomName.textContent = this.t('chat.selectRoom');
        }
        
        // Update connection status
        this.updateConnectionStatus();
        
        // Update buttons
        this.logoutBtn.textContent = this.t('chat.logout');
        
        const pushBtn = document.getElementById('push-toggle');
        if (pushBtn) {
            pushBtn.textContent = this.pushNotificationsEnabled ? 
                this.t('notifications.disable') : this.t('notifications.enable');
        }
        
        // Update sidebar
        const roomsHeader = document.querySelector('.sidebar-header h3');
        if (roomsHeader) roomsHeader.textContent = this.t('chat.rooms');
        
        // Update message input
        if (this.messageInput) {
            this.messageInput.placeholder = this.t('chat.messagePlaceholder');
        }
        
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) sendBtn.textContent = this.t('chat.send');
        
        // Update welcome message
        const welcomeTitle = document.querySelector('#welcome-message h3');
        const welcomeDesc = document.querySelector('#welcome-message p');
        if (welcomeTitle) welcomeTitle.textContent = this.t('chat.welcome');
        if (welcomeDesc) welcomeDesc.textContent = this.t('chat.welcomeDesc');
        
        // Update create room modal
        const modalTitle = document.querySelector('#create-room-modal h3');
        if (modalTitle) modalTitle.textContent = this.t('room.create');
        
        this.roomNameInput.placeholder = this.t('room.nameLabel');
        
        const createBtn = document.getElementById('create-room-confirm');
        const cancelBtn = document.getElementById('create-room-cancel');
        if (createBtn) createBtn.textContent = this.t('room.createButton');
        if (cancelBtn) cancelBtn.textContent = this.t('room.cancel');
        
        // Update theme toggle title
        this.updateThemeToggleTitle();
    }

    async createRoom() {
        const roomName = this.roomNameInput.value.trim();
        if (!roomName) {
            alert(this.t('room.nameRequired'));
            return;
        }
        
        if (roomName.length > 100) {
            alert(this.t('room.error') + ': Nazwa pokoju jest zbyt długa (max 100 znaków)');
            return;
        }

        try {
            const response = await fetch('/api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=create_room&name=${encodeURIComponent(roomName)}&user_id=${this.currentUser.id}`
            });
            
            const data = await response.json();
            if (data.success) {
                this.hideCreateRoomModal();
                this.requestRoomsList();
                this.joinRoom(data.room);
            } else {
                alert(this.t('room.error') + ': ' + (data.error || this.t('room.error')));
            }
        } catch (error) {
            console.error('Error creating room:', error);
            alert(this.t('room.error'));
        }
    }

    logout() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        this.currentUser = null;
        this.currentRoom = null;
        this.usernameInput.value = '';
        this.showLoginScreen();
    }

    async initServiceWorker() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                console.log('Registering Service Worker...');
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
                
                // Get VAPID public key from server
                await this.getVapidPublicKey();
                
                // Check if notifications are already granted
                if (Notification.permission === 'granted') {
                    this.pushNotificationsEnabled = true;
                }
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        } else {
            console.log('Push messaging is not supported');
        }
    }

    async getVapidPublicKey() {
        try {
            const response = await fetch('/api.php?action=get_vapid_key');
            const data = await response.json();
            if (data.success) {
                this.vapidPublicKey = data.vapid_public_key;
                console.log('VAPID public key loaded');
            }
        } catch (error) {
            console.error('Failed to get VAPID key:', error);
        }
    }

    async requestPushPermission() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push messaging is not supported');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                console.log('Notification permission granted');
                await this.subscribeToPush();
                this.pushNotificationsEnabled = true;
                this.updatePushButtonState();
                return true;
            } else {
                console.log('Notification permission denied');
                return false;
            }
        } catch (error) {
            console.error('Error requesting push permission:', error);
            return false;
        }
    }

    async subscribeToPush() {
        if (!this.vapidPublicKey || !this.currentUser) {
            console.log('Cannot subscribe: missing VAPID key or user');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
            });

            console.log('Push subscription created:', subscription);

            // Send subscription to server
            const response = await fetch('/api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'subscribe_push',
                    user_id: this.currentUser.user_id,
                    subscription: JSON.stringify(subscription)
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log('Push subscription saved to server');
            } else {
                console.error('Failed to save subscription:', data.error);
            }

        } catch (error) {
            console.error('Error subscribing to push:', error);
        }
    }

    async unsubscribeFromPush() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                await subscription.unsubscribe();
                console.log('Unsubscribed from push notifications');

                // Remove from server
                if (this.currentUser) {
                    const response = await fetch('/api.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            action: 'unsubscribe_push',
                            user_id: this.currentUser.user_id,
                            endpoint: subscription.endpoint
                        })
                    });

                    const data = await response.json();
                    if (data.success) {
                        console.log('Push subscription removed from server');
                    }
                }
            }

            this.pushNotificationsEnabled = false;
            this.updatePushButtonState();

        } catch (error) {
            console.error('Error unsubscribing from push:', error);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    updatePushButtonState() {
        // Add push notification toggle button to UI if it exists
        const pushToggle = document.getElementById('push-toggle');
        if (pushToggle) {
            pushToggle.textContent = this.pushNotificationsEnabled ? 'Wyłącz powiadomienia' : 'Włącz powiadomienia';
            pushToggle.onclick = () => {
                if (this.pushNotificationsEnabled) {
                    this.unsubscribeFromPush();
                } else {
                    this.requestPushPermission();
                }
            };
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Emoji Picker Methods
    initEmojiPicker() {
        this.emojis = {
            smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
            people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
            animals: ['🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄', '🦓', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏'],
            food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔'],
            activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂'],
            travel: ['✈️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒'],
            objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💰', '💴', '💵', '💶', '💷', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧲', '🔫', '💣', '🧨'],
            symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐']
        };
        
        this.currentEmojiCategory = 'smileys';
        this.renderEmojiGrid();
    }

    toggleEmojiPicker() {
        const isVisible = this.emojiPicker.style.display !== 'none';
        if (isVisible) {
            this.hideEmojiPicker();
        } else {
            this.showEmojiPicker();
        }
    }

    showEmojiPicker() {
        this.emojiPicker.style.display = 'block';
        this.renderEmojiGrid();
    }

    hideEmojiPicker() {
        this.emojiPicker.style.display = 'none';
    }

    switchEmojiCategory(category) {
        this.currentEmojiCategory = category;
        
        // Update active category button
        this.emojiCategories.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        this.renderEmojiGrid();
    }

    renderEmojiGrid() {
        const emojis = this.emojis[this.currentEmojiCategory] || [];
        this.emojiGrid.innerHTML = '';
        
        emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-item';
            emojiBtn.textContent = emoji;
            emojiBtn.addEventListener('click', () => this.insertEmoji(emoji));
            this.emojiGrid.appendChild(emojiBtn);
        });
    }

    insertEmoji(emoji) {
        const input = this.messageInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
        
        this.hideEmojiPicker();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});