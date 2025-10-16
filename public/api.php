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
use Chat\PushNotification;

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
        case 'subscribe_push':
            handleSubscribePush();
            break;
        case 'unsubscribe_push':
            handleUnsubscribePush();
            break;
        case 'get_vapid_key':
            handleGetVapidKey();
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
        
        // Send push notifications to other users in the room
        try {
            $pushNotification = new PushNotification();
            $roomManager = new Room();
            $room = $roomManager->getRoom($roomId);
            $roomName = $room['name'] ?? 'Chat';
            
            $pushNotification->sendToRoom(
                $roomId,
                "Nowa wiadomość w $roomName",
                $newMessage['username'] . ': ' . $message,
                [
                    'room_id' => $roomId,
                    'room_name' => $roomName,
                    'url' => '/'
                ],
                $userId // Exclude the sender
            );
        } catch (Exception $e) {
            // Don't fail the message if push notifications fail
            error_log('Push notification failed: ' . $e->getMessage());
        }
        
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

function handleSubscribePush() {
    $userId = (int)($_POST['user_id'] ?? 0);
    $subscription = $_POST['subscription'] ?? '';
    
    if (!$userId || empty($subscription)) {
        echo json_encode(['error' => 'User ID and subscription required']);
        return;
    }
    
    try {
        $subscriptionData = json_decode($subscription, true);
        if (!$subscriptionData || !isset($subscriptionData['endpoint'])) {
            echo json_encode(['error' => 'Invalid subscription data']);
            return;
        }
        
        $endpoint = $subscriptionData['endpoint'];
        $p256dhKey = $subscriptionData['keys']['p256dh'] ?? '';
        $authKey = $subscriptionData['keys']['auth'] ?? '';
        
        if (empty($p256dhKey) || empty($authKey)) {
            echo json_encode(['error' => 'Missing subscription keys']);
            return;
        }
        
        $db = Database::getInstance();
        $pdo = $db->getConnection();
        
        // Insert or update subscription
        $stmt = $pdo->prepare("
            INSERT OR REPLACE INTO push_subscriptions 
            (user_id, endpoint, p256dh_key, auth_key) 
            VALUES (?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([$userId, $endpoint, $p256dhKey, $authKey]);
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Push notifications enabled']);
        } else {
            echo json_encode(['error' => 'Failed to save subscription']);
        }
        
    } catch (Exception $e) {
        echo json_encode(['error' => 'Subscription error: ' . $e->getMessage()]);
    }
}

function handleUnsubscribePush() {
    $userId = (int)($_POST['user_id'] ?? 0);
    $endpoint = $_POST['endpoint'] ?? '';
    
    if (!$userId) {
        echo json_encode(['error' => 'User ID required']);
        return;
    }
    
    try {
        $db = Database::getInstance();
        $pdo = $db->getConnection();
        
        if ($endpoint) {
            // Remove specific endpoint
            $stmt = $pdo->prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?");
            $result = $stmt->execute([$userId, $endpoint]);
        } else {
            // Remove all subscriptions for user
            $stmt = $pdo->prepare("DELETE FROM push_subscriptions WHERE user_id = ?");
            $result = $stmt->execute([$userId]);
        }
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Push notifications disabled']);
        } else {
            echo json_encode(['error' => 'Failed to unsubscribe']);
        }
        
    } catch (Exception $e) {
        echo json_encode(['error' => 'Unsubscribe error: ' . $e->getMessage()]);
    }
}

function handleGetVapidKey() {
    try {
        $pushNotification = new PushNotification();
        echo json_encode([
            'success' => true,
            'vapid_public_key' => $pushNotification->getVapidPublicKey()
        ]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'VAPID key error: ' . $e->getMessage()]);
    }
}