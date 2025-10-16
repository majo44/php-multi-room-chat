#!/usr/bin/env php
<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Chat\Database;

try {
    echo "Setting up database...\n";
    
    // This will create the database file and tables
    $db = Database::getInstance();
    
    // Add default rooms if they don't exist
    $pdo = $db->getConnection();
    
    // Check if we need to add default rooms
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM rooms WHERE name IN ('General', 'Random', 'Tech Talk', 'Off Topic')");
    $stmt->execute();
    $existingRooms = $stmt->fetchColumn();
    
    if ($existingRooms < 4) {
        echo "Creating default rooms...\n";
        
        $defaultRooms = [
            'General' => 'Main discussion room',
            'Random' => 'Random conversations',
            'Tech Talk' => 'Technology discussions',
            'Off Topic' => 'Casual conversations'
        ];
        
        foreach ($defaultRooms as $name => $description) {
            $stmt = $pdo->prepare("INSERT OR IGNORE INTO rooms (name, created_by, created_at) VALUES (?, NULL, datetime('now'))");
            $stmt->execute([$name]);
        }
        
        echo "Default rooms created!\n";
    }
    
    echo "Database setup completed successfully!\n";
    echo "Database file created at: " . __DIR__ . '/../storage/chat.db' . "\n";
    
} catch (Exception $e) {
    echo "Error setting up database: " . $e->getMessage() . "\n";
    exit(1);
}