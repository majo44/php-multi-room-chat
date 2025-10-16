<?php

return [
    'database' => [
        'driver' => 'sqlite',
        'database' => __DIR__ . '/../storage/chat.db',
        'charset' => 'utf8',
        'collation' => 'utf8_unicode_ci',
    ],
    
    'websocket' => [
        'host' => $_ENV['WEBSOCKET_HOST'] ?? '127.0.0.1',
        'port' => $_ENV['WEBSOCKET_PORT'] ?? 8081,
    ],
    
    'security' => [
        'session_lifetime' => 3600, // 1 hour
        'max_message_length' => 1000,
        'rate_limit_messages' => 10, // messages per minute
    ],
    
    'app' => [
        'name' => 'PHP Multi-Room Chat',
        'debug' => $_ENV['APP_DEBUG'] ?? false,
        'timezone' => 'UTC',
        'url' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
    ]
];