<?php

namespace Chat;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;

class ChatServer implements MessageComponentInterface 
{
    protected $clients;
    protected $rooms;
    private $userManager;
    private $roomManager;
    private $messageManager;

    public function __construct() 
    {
        $this->clients = new \SplObjectStorage;
        $this->rooms = [];
        $this->userManager = new User();
        $this->roomManager = new Room();
        $this->messageManager = new Message();
        
        echo "Chat server initialized\n";
    }

    public function onOpen(ConnectionInterface $conn) 
    {
        $this->clients->attach($conn);
        $conn->roomId = null;
        $conn->userId = null;
        $conn->username = null;
        
        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) 
    {
        try {
            $data = json_decode($msg, true);
            
            if (!$data || !isset($data['type'])) {
                return;
            }

            switch ($data['type']) {
                case 'auth':
                    $this->handleAuth($from, $data);
                    break;
                case 'join_room':
                    $this->handleJoinRoom($from, $data);
                    break;
                case 'message':
                    $this->handleMessage($from, $data);
                    break;
                case 'get_rooms':
                    $this->handleGetRooms($from);
                    break;
                case 'create_room':
                    $this->handleCreateRoom($from, $data);
                    break;
            }
        } catch (\Exception $e) {
            echo "Error handling message: " . $e->getMessage() . "\n";
        }
    }

    private function handleAuth(ConnectionInterface $conn, array $data): void
    {
        if (!isset($data['username']) || !isset($data['session_id'])) {
            return;
        }

        $user = new User();
        if ($user->authenticate($data['username'], $data['session_id'])) {
            $conn->userId = $user->getId();
            $conn->username = $user->getUsername();
            
            $this->sendToConnection($conn, [
                'type' => 'auth_success',
                'user_id' => $user->getId(),
                'username' => $user->getUsername()
            ]);
            
            echo "User authenticated: {$user->getUsername()} ({$conn->resourceId})\n";
        } else {
            $this->sendToConnection($conn, [
                'type' => 'auth_error',
                'message' => 'Authentication failed'
            ]);
        }
    }

    private function handleJoinRoom(ConnectionInterface $conn, array $data): void
    {
        if (!$conn->userId || !isset($data['room_id'])) {
            return;
        }

        $roomId = (int)$data['room_id'];
        $room = $this->roomManager->getRoom($roomId);
        
        if (!$room) {
            return;
        }

        // Leave current room
        if ($conn->roomId) {
            $this->leaveRoom($conn);
        }

        // Join new room
        $conn->roomId = $roomId;
        if (!isset($this->rooms[$roomId])) {
            $this->rooms[$roomId] = new \SplObjectStorage;
        }
        $this->rooms[$roomId]->attach($conn);

        // Send room info and recent messages
        $messages = $this->messageManager->getMessages($roomId, 20);
        
        $this->sendToConnection($conn, [
            'type' => 'room_joined',
            'room' => $room,
            'messages' => $messages
        ]);

        // Notify others in room
        $this->broadcastToRoom($roomId, [
            'type' => 'user_joined',
            'username' => $conn->username
        ], $conn);

        echo "User {$conn->username} joined room {$room['name']}\n";
    }

    private function handleMessage(ConnectionInterface $from, array $data): void
    {
        if (!$from->userId || !$from->roomId || !isset($data['message'])) {
            return;
        }

        $messageId = $this->messageManager->addMessage(
            $from->roomId, 
            $from->userId, 
            $data['message']
        );

        if ($messageId) {
            $message = $this->messageManager->getMessageById($messageId);
            
            $this->broadcastToRoom($from->roomId, [
                'type' => 'new_message',
                'message' => $message
            ]);
            
            echo "Message from {$from->username} in room {$from->roomId}: {$data['message']}\n";
        }
    }

    private function handleGetRooms(ConnectionInterface $conn): void
    {
        $rooms = $this->roomManager->getRooms();
        
        $this->sendToConnection($conn, [
            'type' => 'rooms_list',
            'rooms' => $rooms
        ]);
    }

    private function handleCreateRoom(ConnectionInterface $conn, array $data): void
    {
        if (!$conn->userId || !isset($data['name'])) {
            return;
        }

        $roomId = $this->roomManager->createRoom($data['name'], $conn->userId);
        
        if ($roomId) {
            $room = $this->roomManager->getRoom($roomId);
            
            $this->sendToConnection($conn, [
                'type' => 'room_created',
                'room' => $room
            ]);
            
            echo "Room created: {$data['name']} by {$conn->username}\n";
        } else {
            $this->sendToConnection($conn, [
                'type' => 'room_error',
                'message' => 'Failed to create room'
            ]);
        }
    }

    private function leaveRoom(ConnectionInterface $conn): void
    {
        if ($conn->roomId && isset($this->rooms[$conn->roomId])) {
            $this->rooms[$conn->roomId]->detach($conn);
            
            $this->broadcastToRoom($conn->roomId, [
                'type' => 'user_left',
                'username' => $conn->username
            ], $conn);
        }
    }

    private function broadcastToRoom(int $roomId, array $data, ConnectionInterface $exclude = null): void
    {
        if (!isset($this->rooms[$roomId])) {
            return;
        }

        foreach ($this->rooms[$roomId] as $client) {
            if ($client !== $exclude) {
                $this->sendToConnection($client, $data);
            }
        }
    }

    private function sendToConnection(ConnectionInterface $conn, array $data): void
    {
        try {
            $conn->send(json_encode($data));
        } catch (\Exception $e) {
            echo "Error sending message: " . $e->getMessage() . "\n";
        }
    }

    public function onClose(ConnectionInterface $conn) 
    {
        $this->leaveRoom($conn);
        $this->clients->detach($conn);
        
        echo "Connection {$conn->resourceId} has disconnected\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) 
    {
        echo "An error has occurred: {$e->getMessage()}\n";
        $conn->close();
    }
}