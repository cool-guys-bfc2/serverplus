const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve static files from a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create a WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

// Store connected clients with their usernames
const clients = new Map();

wss.on('connection', ws => {
  console.log('New client connected');
  let username = null;

  ws.on('message', message => {
    try {
      const data = JSON.parse(message);

      // Handle username assignment
      if (data.type === 'join') {
        username = data.username;
        clients.set(ws, username);
        
        // Notify all clients about the new user
        broadcast({
          type: 'system',
          message: `${username} joined the chat`,
          timestamp: new Date().toISOString(),
          userCount: clients.size
        }, null);

        // Send current user list to all clients
        updateUserList();
        return;
      }

      // Handle chat messages
      if (data.type === 'chat' && username) {
        broadcast({
          type: 'chat',
          username: username,
          message: data.message,
          timestamp: new Date().toISOString()
        }, null);
      }

      // Handle typing indicator
      if (data.type === 'typing' && username) {
        broadcast({
          type: 'typing',
          username: username
        }, ws);
      }
    } catch (error) {
      console.error('Message error:', error);
    }
  });

  ws.on('close', () => {
    if (username) {
      clients.delete(ws);
      broadcast({
        type: 'system',
        message: `${username} left the chat`,
        timestamp: new Date().toISOString(),
        userCount: clients.size
      }, null);
      updateUserList();
    }
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Welcome to the Chat Server! Please enter your username.'
  }));
});

// Broadcast message to all clients
function broadcast(data, excludeWs = null) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(JSON.stringify(data));
    }
  });
}

// Update user list for all clients
function updateUserList() {
  const users = Array.from(clients.values());
  broadcast({
    type: 'userList',
    users: users,
    count: users.length
  });
}

// Start the server
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});