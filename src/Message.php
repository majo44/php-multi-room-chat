<?php

namespace Chat;

class Message 
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function addMessage(int $roomId, int $userId, string $message): ?int
    {
        $message = trim($message);
        if (empty($message) || strlen($message) > 1000) {
            return null;
        }

        // Sanitize message
        $message = User::sanitizeInput($message);

        try {
            $stmt = $this->db->prepare("
                INSERT INTO messages (room_id, user_id, message) 
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$roomId, $userId, $message]);
            return $this->db->lastInsertId();
        } catch (\PDOException $e) {
            return null;
        }
    }

    public function getMessages(int $roomId, int $limit = 50, int $offset = 0): array
    {
        $stmt = $this->db->prepare("
            SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.room_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$roomId, $limit, $offset]);
        return array_reverse($stmt->fetchAll());
    }

    public function getLatestMessages(int $roomId, string $since): array
    {
        $stmt = $this->db->prepare("
            SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.room_id = ? AND m.created_at > ?
            ORDER BY m.created_at ASC
        ");
        $stmt->execute([$roomId, $since]);
        return $stmt->fetchAll();
    }

    public function getMessageById(int $messageId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT m.*, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = ?
        ");
        $stmt->execute([$messageId]);
        return $stmt->fetch() ?: null;
    }
}