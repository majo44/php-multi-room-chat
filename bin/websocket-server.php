#!/usr/bin/env php
<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Chat\ChatServer;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;

$config = require __DIR__ . '/../config/app.php';

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new ChatServer()
        )
    ),
    $config['websocket']['port'],
    $config['websocket']['host']
);

echo "WebSocket server started on {$config['websocket']['host']}:{$config['websocket']['port']}\n";
echo "Press Ctrl+C to stop the server\n";

$server->run();