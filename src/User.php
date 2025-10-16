<?php

namespace Chat;

class User 
{
    private $db;
    private $id;
    private $username;
    private $sessionId;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function authenticate(string $username, string $sessionId): bool
    {
        // Sanitize username
        $username = trim($username);
        if (empty($username) || strlen($username) > 50) {
            return false;
        }

        // Check if user exists with this session
        $stmt = $this->db->prepare("SELECT * FROM users WHERE username = ? AND session_id = ?");
        $stmt->execute([$username, $sessionId]);
        $user = $stmt->fetch();

        if ($user) {
            $this->id = $user['id'];
            $this->username = $user['username'];
            $this->sessionId = $user['session_id'];
            $this->updateLastSeen();
            return true;
        }

        // Try to create new user
        return $this->createUser($username, $sessionId);
    }

    private function createUser(string $username, string $sessionId): bool
    {
        try {
            $stmt = $this->db->prepare("INSERT INTO users (username, session_id) VALUES (?, ?)");
            $stmt->execute([$username, $sessionId]);
            
            $this->id = $this->db->lastInsertId();
            $this->username = $username;
            $this->sessionId = $sessionId;
            
            return true;
        } catch (\PDOException $e) {
            // Username might be taken
            return false;
        }
    }

    public function updateLastSeen(): void
    {
        if ($this->id) {
            $stmt = $this->db->prepare("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?");
            $stmt->execute([$this->id]);
        }
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUsername(): ?string
    {
        return $this->username;
    }

    public function getSessionId(): ?string
    {
        return $this->sessionId;
    }

    public static function sanitizeInput(string $input): string
    {
        return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
}