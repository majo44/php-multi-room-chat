<?php

namespace Chat;

class Room 
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function getRooms(): array
    {
        $stmt = $this->db->prepare("
            SELECT r.*, u.username as created_by_username,
                   COUNT(DISTINCT m.user_id) as active_users
            FROM rooms r 
            LEFT JOIN users u ON r.created_by = u.id
            LEFT JOIN messages m ON r.id = m.room_id AND m.created_at > datetime('now', '-1 hour')
            GROUP BY r.id
            ORDER BY r.name
        ");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function createRoom(string $name, int $userId): ?int
    {
        $name = trim($name);
        if (empty($name) || strlen($name) > 100) {
            return null;
        }

        try {
            $stmt = $this->db->prepare("INSERT INTO rooms (name, created_by) VALUES (?, ?)");
            $stmt->execute([$name, $userId]);
            return $this->db->lastInsertId();
        } catch (\PDOException $e) {
            // Room name might be taken
            return null;
        }
    }

    public function getRoom(int $roomId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT r.*, u.username as created_by_username
            FROM rooms r 
            LEFT JOIN users u ON r.created_by = u.id
            WHERE r.id = ?
        ");
        $stmt->execute([$roomId]);
        return $stmt->fetch() ?: null;
    }

    public function getRoomByName(string $name): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM rooms WHERE name = ?");
        $stmt->execute([$name]);
        return $stmt->fetch() ?: null;
    }
}