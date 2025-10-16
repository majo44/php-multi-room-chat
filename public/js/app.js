class ChatApp {
    constructor() {
        this.ws = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.sessionId = this.generateSessionId();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.initElements();
        this.bindEvents();
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

    login() {
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
        
        this.connectWebSocket(username);
    }

    logout() {
        if (this.ws) {
            this.ws.close();
        }
        this.currentUser = null;
        this.currentRoom = null;
        this.usernameInput.value = '';
        this.showLoginScreen();
    }

    connectWebSocket(username) {
        try {
            // Auto-detect WebSocket URL based on current location
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = window.location.hostname === 'localhost' ? ':8081' : ':' + (window.location.port || (protocol === 'wss:' ? '443' : '80'));
            const wsUrl = `${protocol}//${host}${port}`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket połączony');
                this.updateConnectionStatus(true);
                this.authenticate(username);
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket rozłączony');
                this.updateConnectionStatus(false);
                this.handleDisconnection();
            };
            
            this.ws.onerror = (error) => {
                console.error('Błąd WebSocket:', error);
                this.updateConnectionStatus(false);
                this.handleConnectionError();
            };
            
        } catch (error) {
            console.error('Błąd podczas łączenia:', error);
            this.handleConnectionError();
        }
    }

    authenticate(username) {
        this.send({
            type: 'auth',
            username: username,
            session_id: this.sessionId
        });
    }

    handleMessage(data) {
        switch (data.type) {
            case 'auth_success':
                this.handleAuthSuccess(data);
                break;
            case 'auth_error':
                this.handleAuthError(data);
                break;
            case 'rooms_list':
                this.updateRoomsList(data.rooms);
                break;
            case 'room_joined':
                this.handleRoomJoined(data);
                break;
            case 'room_created':
                this.handleRoomCreated(data);
                break;
            case 'room_error':
                alert('Błąd: ' + data.message);
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
        this.currentUser = {
            id: data.user_id,
            username: data.username
        };
        
        this.currentUsername.textContent = data.username;
        this.showChatScreen();
        this.requestRoomsList();
        
        this.loginBtn.disabled = false;
        this.loginBtn.textContent = 'Dołącz do czatu';
    }

    handleAuthError(data) {
        alert('Błąd logowania: ' + data.message);
        this.loginBtn.disabled = false;
        this.loginBtn.textContent = 'Dołącz do czatu';
    }

    handleRoomJoined(data) {
        this.currentRoom = data.room;
        this.currentRoomName.textContent = data.room.name;
        this.messageInputContainer.style.display = 'flex';
        
        // Clear messages and display room messages
        this.messagesContainer.innerHTML = '';
        data.messages.forEach(message => this.displayMessage(message));
        
        // Update active room in sidebar
        this.updateActiveRoom(data.room.id);
        
        // Scroll to bottom
        this.scrollToBottom();
        this.messageInput.focus();
    }

    handleRoomCreated(data) {
        this.hideCreateRoomModal();
        this.requestRoomsList();
        this.joinRoom(data.room.id);
    }

    handleDisconnection() {
        if (this.currentUser && this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`Próba ponownego połączenia ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                this.connectWebSocket(this.currentUser.username);
            }, 2000 * this.reconnectAttempts);
        }
    }

    handleConnectionError() {
        this.loginBtn.disabled = false;
        this.loginBtn.textContent = 'Dołącz do czatu';
        
        if (!this.currentUser) {
            alert('Nie można połączyć się z serwerem. Upewnij się, że serwer WebSocket działa.');
        }
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.textContent = 'Połączony';
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

    requestRoomsList() {
        this.send({ type: 'get_rooms' });
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
            
            roomElement.addEventListener('click', () => this.joinRoom(room.id));
            this.roomsList.appendChild(roomElement);
        });
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

    joinRoom(roomId) {
        this.send({
            type: 'join_room',
            room_id: roomId
        });
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.currentRoom) return;
        
        if (message.length > 1000) {
            alert('Wiadomość jest zbyt długa (max 1000 znaków)');
            return;
        }

        this.send({
            type: 'message',
            message: message
        });
        
        this.messageInput.value = '';
        this.messageInput.focus();
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

    showCreateRoomModal() {
        this.createRoomModal.classList.add('active');
        this.roomNameInput.value = '';
        this.roomNameInput.focus();
    }

    hideCreateRoomModal() {
        this.createRoomModal.classList.remove('active');
    }

    createRoom() {
        const roomName = this.roomNameInput.value.trim();
        if (!roomName) {
            alert('Proszę wprowadzić nazwę pokoju');
            return;
        }
        
        if (roomName.length > 100) {
            alert('Nazwa pokoju jest zbyt długa (max 100 znaków)');
            return;
        }

        this.send({
            type: 'create_room',
            name: roomName
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});