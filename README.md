# PHP Multi-Room Chat Application

A real-time multi-room chat application built with PHP, WebSockets, and modern web technologies.

## Features

- Multiple chat rooms
- Real-time messaging using WebSockets
- User authentication
- Message history
- Responsive design
- XSS and CSRF protection

## Requirements

- PHP 8.0 or higher
- Composer
- SQLite (included) or MySQL
- Modern web browser with WebSocket support

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd php-chat
```

2. Install dependencies:
```bash
composer install
```

3. Set up the database:
```bash
php bin/setup-database.php
```

4. Start the WebSocket server:
```bash
composer run websocket
```

5. Start the web server:
```bash
composer run start
```

6. Open your browser and go to `http://localhost:8000`

## Usage

1. Enter your username
2. Select or create a chat room
3. Start chatting in real-time!

## Development

- `src/` - Application source code
- `public/` - Web accessible files
- `config/` - Configuration files
- `bin/` - Executable scripts
- `tests/` - Unit tests

## Security Features

- Input sanitization
- XSS protection
- Rate limiting
- Session management

## License

MIT License