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
        
        this.initElements();
        this.bindEvents();
        this.initServiceWorker();
        this.initTheme();
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
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
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
    }

    async login() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            alert('Proszę wprowadzić nazwę użytkownika');
            return;
        }
        
        if (username.length > 50) {
            alert('Nazwa użytkownika jest zbyt długa (max 50 znaków)');
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
            alert('Błąd logowania: ' + error.message);
        }
        
        this.loginBtn.disabled = false;
        this.loginBtn.textContent = 'Dołącz do czatu';
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
            this.connectionStatus.textContent = `Połączony (${mode})`;
            this.connectionStatus.className = 'status-connected';
        } else {
            this.connectionStatus.textContent = 'Rozłączony';
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
        this.themeToggle.title = newTheme === 'dark' ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw';
    }

    initTheme() {
        // Load saved theme or default to light
        const savedTheme = localStorage.getItem('chatTheme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Update theme toggle icon
        this.themeToggle.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
        this.themeToggle.title = savedTheme === 'dark' ? 'Przełącz na jasny motyw' : 'Przełącz na ciemny motyw';
    }

    async createRoom() {
        const roomName = this.roomNameInput.value.trim();
        if (!roomName) {
            alert('Proszę wprowadzić nazwę pokoju');
            return;
        }
        
        if (roomName.length > 100) {
            alert('Nazwa pokoju jest zbyt długa (max 100 znaków)');
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
                alert('Błąd: ' + (data.error || 'Nie udało się utworzyć pokoju'));
            }
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Błąd podczas tworzenia pokoju');
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});