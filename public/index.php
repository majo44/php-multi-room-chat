<?php

// Heroku compatibility layer
if (isset($_ENV['PORT'])) {
    $port = $_ENV['PORT'];
} else {
    $port = 8000;
}

// Start built-in server only in development
if (php_sapi_name() === 'cli-server') {
    // Development mode
    if (preg_match('/\.(?:png|jpg|jpeg|gif|css|js)$/', $_SERVER["REQUEST_URI"])) {
        return false;
    }
}

// For production, serve files directly
if (file_exists(__DIR__ . $_SERVER['REQUEST_URI']) && 
    !is_dir(__DIR__ . $_SERVER['REQUEST_URI'])) {
    return false;
}

// Route all other requests to index.html
require_once __DIR__ . '/index.html';