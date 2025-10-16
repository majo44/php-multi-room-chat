#!/usr/bin/env php
<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Chat\Database;

try {
    echo "Setting up database...\n";
    
    // This will create the database file and tables
    $db = Database::getInstance();
    
    echo "Database setup completed successfully!\n";
    echo "Database file created at: " . __DIR__ . '/../storage/chat.db' . "\n";
    
} catch (Exception $e) {
    echo "Error setting up database: " . $e->getMessage() . "\n";
    exit(1);
}