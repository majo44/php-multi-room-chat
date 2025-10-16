<?php

namespace Chat;

class PushNotification
{
    private $database;
    
    // VAPID keys for web push (in production these should be in config)
    private $vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLufTqDm84_FKjTQcdYQP_ZVFwUIgdPjDQQlFYE2HftRGJXw1cjGv0';
    private $vapidPrivateKey = 'UDqzN1_xRJT8zM5xoHU9yfNk5KXVQY6vROZkNz8RhF0';
    
    public function __construct()
    {
        $this->database = Database::getInstance();
    }
    
    public function sendToUser(int $userId, string $title, string $body, array $data = []): bool
    {
        try {
            $subscriptions = $this->getUserSubscriptions($userId);
            
            if (empty($subscriptions)) {
                return false; // No subscriptions for this user
            }
            
            $payload = json_encode([
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'timestamp' => time()
            ]);
            
            $successCount = 0;
            
            foreach ($subscriptions as $subscription) {
                if ($this->sendPushNotification($subscription, $payload)) {
                    $successCount++;
                }
            }
            
            return $successCount > 0;
            
        } catch (\Exception $e) {
            error_log('Push notification error: ' . $e->getMessage());
            return false;
        }
    }
    
    public function sendToRoom(int $roomId, string $title, string $body, array $data = [], int $excludeUserId = null): int
    {
        try {
            $users = $this->getRoomUsers($roomId, $excludeUserId);
            $sentCount = 0;
            
            foreach ($users as $userId) {
                if ($this->sendToUser($userId, $title, $body, $data)) {
                    $sentCount++;
                }
            }
            
            return $sentCount;
            
        } catch (\Exception $e) {
            error_log('Room push notification error: ' . $e->getMessage());
            return 0;
        }
    }
    
    private function getUserSubscriptions(int $userId): array
    {
        $pdo = $this->database->getConnection();
        $stmt = $pdo->prepare("
            SELECT endpoint, p256dh_key, auth_key 
            FROM push_subscriptions 
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }
    
    private function getRoomUsers(int $roomId, int $excludeUserId = null): array
    {
        $pdo = $this->database->getConnection();
        
        // Get users who have sent messages in this room recently (last 24 hours)
        $sql = "
            SELECT DISTINCT m.user_id 
            FROM messages m 
            WHERE m.room_id = ? 
            AND m.created_at > datetime('now', '-24 hours')
        ";
        $params = [$roomId];
        
        if ($excludeUserId) {
            $sql .= " AND m.user_id != ?";
            $params[] = $excludeUserId;
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        return array_column($stmt->fetchAll(), 'user_id');
    }
    
    private function sendPushNotification(array $subscription, string $payload): bool
    {
        try {
            // For production, you would use a proper Web Push library like:
            // https://github.com/web-push-libs/web-push-php
            
            // For now, we'll simulate the push (in real implementation, this would
            // make HTTP requests to browser push services)
            
            $endpoint = $subscription['endpoint'];
            $p256dhKey = $subscription['p256dh_key'];
            $authKey = $subscription['auth_key'];
            
            // Log the notification attempt
            error_log("Would send push notification to: " . $endpoint);
            error_log("Payload: " . $payload);
            
            // In a real implementation, this would:
            // 1. Generate proper VAPID headers
            // 2. Encrypt the payload with the p256dh and auth keys
            // 3. Make HTTP request to the endpoint
            // 4. Handle responses and cleanup invalid subscriptions
            
            return true; // Simulate success for now
            
        } catch (\Exception $e) {
            error_log('Push send error: ' . $e->getMessage());
            return false;
        }
    }
    
    public function getVapidPublicKey(): string
    {
        return $this->vapidPublicKey;
    }
    
    public function cleanupExpiredSubscriptions(): int
    {
        try {
            $pdo = $this->database->getConnection();
            
            // Remove subscriptions older than 30 days without activity
            $stmt = $pdo->prepare("
                DELETE FROM push_subscriptions 
                WHERE created_at < datetime('now', '-30 days')
            ");
            $stmt->execute();
            
            return $stmt->rowCount();
            
        } catch (\Exception $e) {
            error_log('Cleanup subscriptions error: ' . $e->getMessage());
            return 0;
        }
    }
}