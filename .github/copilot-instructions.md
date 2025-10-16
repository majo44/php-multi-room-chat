<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# PHP Multi-Room Chat Application

This is a PHP-based multi-user chat application with support for multiple chat rooms and real-time communication.

## Project Overview
- **Language**: PHP
- **Frontend**: HTML, CSS, JavaScript
- **Real-time Communication**: WebSockets
- **Database**: MySQL/SQLite
- **Dependency Management**: Composer

## Development Guidelines
- Follow PSR-4 autoloading standards
- Use modern PHP features (PHP 8.0+)
- Implement proper error handling and validation
- Follow secure coding practices for chat applications
- Use responsive design for mobile compatibility

## Architecture
- MVC pattern for code organization
- WebSocket server for real-time messaging
- Database for user sessions and chat history
- RESTful API endpoints for chat operations

## Security Considerations
- Input sanitization and validation
- XSS protection
- CSRF protection
- Rate limiting for messages
- User authentication and session management