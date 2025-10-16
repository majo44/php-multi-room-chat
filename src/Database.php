<?php

namespace Chat;

use PDO;
use PDOException;

class Database 
{
    private static $instance = null;
    private $connection;
    private $config;

    private function __construct() 
    {
        $this->config = require __DIR__ . '/../config/app.php';
        $this->connect();
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function connect(): void
    {
        try {
            $dbConfig = $this->config['database'];
            
            if ($dbConfig['driver'] === 'sqlite') {
                $dsn = "sqlite:" . $dbConfig['database'];
                $this->connection = new PDO($dsn);
            } else {
                throw new \Exception('Unsupported database driver');
            }
            
            $this->connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->connection->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            $this->createTables();
        } catch (PDOException $e) {
            throw new \Exception("Database connection failed: " . $e->getMessage());
        }
    }

    public function getConnection(): PDO
    {
        return $this->connection;
    }

    private function createTables(): void
    {
        $queries = [
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                session_id VARCHAR(100) UNIQUE NOT NULL,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) UNIQUE NOT NULL,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )",
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )",
            "CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_id)"
        ];

        foreach ($queries as $query) {
            $this->connection->exec($query);
        }
        
        // Create default room
        $stmt = $this->connection->prepare("INSERT OR IGNORE INTO rooms (name) VALUES (?)");
        $stmt->execute(['General']);
    }
}