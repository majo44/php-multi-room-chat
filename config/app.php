<?php

return [
    'database' => [
        'driver' => 'sqlite',
        'database' => __DIR__ . '/../storage/chat.db',
        'charset' => 'utf8',
        'collation' => 'utf8_unicode_ci',
    ],
    
    'websocket' => [
        'host' => '127.0.0.1',
        'port' => 8081,
    ],
    
    'security' => [
        'session_lifetime' => 3600, // 1 hour
        'max_message_length' => 1000,
        'rate_limit_messages' => 10, // messages per minute
    ],
    
    'app' => [
        'name' => 'PHP Multi-Room Chat',
        'debug' => true,
        'timezone' => 'UTC',
    ]
];