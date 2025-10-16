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
git clone https://github.com/majo44/php-multi-room-chat.git
cd php-multi-room-chat
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

## Deployment

### Railway.app (Recommended)
1. Fork this repository
2. Connect your GitHub account to [Railway.app](https://railway.app)
3. Create new project from GitHub repository
4. Deploy automatically

### Heroku
1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-chat-app-name`
4. Deploy: `git push heroku master`

### Render.com
1. Connect GitHub repository to [Render.com](https://render.com)
2. Create new Web Service
3. Use render.yaml configuration

### Manual VPS Deployment
1. Upload files to web server
2. Install PHP 8.0+ and Composer
3. Run: `composer install --no-dev`
4. Set web root to `public/` directory
5. Configure WebSocket server as background service

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

## Environment Variables

- `WEBSOCKET_HOST` - WebSocket server host (default: 127.0.0.1)
- `WEBSOCKET_PORT` - WebSocket server port (default: 8081)
- `APP_DEBUG` - Debug mode (default: false)
- `APP_URL` - Application URL

## License

MIT License
