# Deploy Instructions for Railway.app

## Quick Deploy to Railway

1. **Go to Railway.app**
   - Visit: https://railway.app
   - Click "Start a New Project"
   - Sign in with your GitHub account

2. **Connect Repository**
   - Select "Deploy from GitHub repo"
   - Choose: `majo44/php-multi-room-chat`
   - Click "Deploy"

3. **Configuration**
   Railway will automatically:
   - Detect PHP application
   - Install dependencies via composer
   - Set up the database
   - Start the web server

4. **Environment Variables** (Optional)
   In Railway dashboard, add these if needed:
   - `WEBSOCKET_HOST`: your-app.railway.app
   - `WEBSOCKET_PORT`: 443 (for WSS)
   - `APP_DEBUG`: false
   - `APP_URL`: https://your-app.railway.app

5. **Domain**
   - Railway provides: https://your-app-name.railway.app
   - You can also add custom domain

## Quick Deploy to Render.com

1. **Go to Render.com**
   - Visit: https://render.com
   - Sign up/Sign in with GitHub

2. **Create Web Service**
   - Click "New +"
   - Select "Web Service"
   - Connect GitHub: `majo44/php-multi-room-chat`

3. **Configuration**
   - Name: php-multi-room-chat
   - Environment: Node
   - Build Command: `composer install --no-dev`
   - Start Command: `php -S 0.0.0.0:$PORT -t public`

## Quick Deploy to Heroku

1. **Install Heroku CLI** (if not done)
   ```bash
   curl https://cli-assets.heroku.com/install.sh | sh
   ```

2. **Login and Create App**
   ```bash
   heroku login
   heroku create your-chat-app-name
   ```

3. **Deploy**
   ```bash
   git push heroku master
   ```

4. **Set Environment**
   ```bash
   heroku config:set APP_DEBUG=false
   heroku config:set WEBSOCKET_HOST=your-app.herokuapp.com
   heroku config:set WEBSOCKET_PORT=443
   ```

## Testing Deployment

Once deployed, test by:

1. **Open the application URL**
2. **Enter a username**
3. **Try creating a room**
4. **Send messages**
5. **Open multiple browser tabs to test multi-user chat**

## Note about WebSockets

⚠️ **Important**: Many free hosting platforms have limitations with WebSocket support:

- **Railway**: Full WebSocket support ✅
- **Render**: WebSocket support on paid plans
- **Heroku**: Limited WebSocket support on free tier
- **Vercel/Netlify**: Static hosting only, no WebSocket support

For best results, use **Railway.app** which has excellent WebSocket support even on free tier.