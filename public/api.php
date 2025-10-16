<?php

// Simple API endpoint for chat without WebSocket
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../vendor/autoload.php';

use Chat\Database;
use Chat\User;
use Chat\Room;
use Chat\Message;

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'login':
            handleLogin();
            break;
        case 'get_rooms':
            handleGetRooms();
            break;
        case 'get_messages':
            handleGetMessages();
            break;
        case 'send_message':
            handleSendMessage();
            break;
        case 'create_room':
            handleCreateRoom();
            break;
        default:
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}

function handleLogin() {
    $username = $_POST['username'] ?? '';
    $sessionId = $_POST['session_id'] ?? '';
    
    if (empty($username) || empty($sessionId)) {
        echo json_encode(['error' => 'Username and session_id required']);
        return;
    }
    
    $user = new User();
    if ($user->authenticate($username, $sessionId)) {
        echo json_encode([
            'success' => true,
            'user_id' => $user->getId(),
            'username' => $user->getUsername()
        ]);
    } else {
        echo json_encode(['error' => 'Authentication failed']);
    }
}

function handleGetRooms() {
    $roomManager = new Room();
    $rooms = $roomManager->getRooms();
    echo json_encode(['rooms' => $rooms]);
}

function handleGetMessages() {
    $roomId = (int)($_GET['room_id'] ?? 0);
    $since = $_GET['since'] ?? '';
    
    if (!$roomId) {
        echo json_encode(['error' => 'Room ID required']);
        return;
    }
    
    $messageManager = new Message();
    
    if ($since) {
        $messages = $messageManager->getLatestMessages($roomId, $since);
    } else {
        $messages = $messageManager->getMessages($roomId, 20);
    }
    
    echo json_encode(['messages' => $messages]);
}

function handleSendMessage() {
    $roomId = (int)($_POST['room_id'] ?? 0);
    $userId = (int)($_POST['user_id'] ?? 0);
    $message = $_POST['message'] ?? '';
    
    if (!$roomId || !$userId || empty($message)) {
        echo json_encode(['error' => 'Room ID, User ID and message required']);
        return;
    }
    
    $messageManager = new Message();
    $messageId = $messageManager->addMessage($roomId, $userId, $message);
    
    if ($messageId) {
        $newMessage = $messageManager->getMessageById($messageId);
        echo json_encode(['success' => true, 'message' => $newMessage]);
    } else {
        echo json_encode(['error' => 'Failed to send message']);
    }
}

function handleCreateRoom() {
    $name = $_POST['name'] ?? '';
    $userId = (int)($_POST['user_id'] ?? 0);
    
    if (empty($name) || !$userId) {
        echo json_encode(['error' => 'Room name and user ID required']);
        return;
    }
    
    $roomManager = new Room();
    $roomId = $roomManager->createRoom($name, $userId);
    
    if ($roomId) {
        $room = $roomManager->getRoom($roomId);
        echo json_encode(['success' => true, 'room' => $room]);
    } else {
        echo json_encode(['error' => 'Failed to create room']);
    }
}