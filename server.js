// server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// --- NEW: In-memory store for connected users and their usernames ---
const connectedUsers = {}; // Key: socket.id, Value: username

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  // Default room for new connections
  
  const DEFAULT_ROOM = 'general';
  let currentUsername = 'Anonymous'; // Default username

  // --- NEW: Listen for 'set username' event from client ---
  socket.on('set username', (username) => {
    // Basic validation: ensure username is not empty and not already taken (case-insensitive for simplicity)
    const isUsernameTaken = Object.values(connectedUsers).some(
      (user) => user.toLowerCase() === username.toLowerCase()
    );

    if (username && !isUsernameTaken) {
      currentUsername = username;
      connectedUsers[socket.id] = currentUsername; // Store the username
      console.log(`User ${socket.id} set username to: ${currentUsername}`);

      // Emit a confirmation back to the client that their username is set
      socket.emit('username set', currentUsername);

      // Broadcast to ALL clients that a new user has joined
      io.emit('user joined', currentUsername);
    } else {
      // If username is empty or taken, reject and inform the client
      const errorMessage = username
        ? 'Username is already taken. Please choose another.'
        : 'Username cannot be empty.';
      socket.emit('username error', errorMessage);
      console.log(`User ${socket.id} failed to set username: ${errorMessage}`);
      // Optionally disconnect them or prompt again, for now just send error
    }
  });

  // --- MODIFIED: Listen for 'chat message' event ---
  socket.on('chat message', (msg) => {
    // Ensure the user has a username before broadcasting
    if (connectedUsers[socket.id]) {
      const user = connectedUsers[socket.id];
      console.log(`[${user}] message: ${msg}`);

      // Broadcast an object containing both the username and the message
      io.emit('chat message', { user: user, msg: msg });
    } else {
      // If message received before username is set, handle it (e.g., ignore or send error)
      socket.emit('chat error', 'Please set your username first!');
    }
  });

  // --- MODIFIED: Listen for 'disconnect' event ---
  socket.on('disconnect', () => {
    if (connectedUsers[socket.id]) {
      const disconnectedUser = connectedUsers[socket.id];
      delete connectedUsers[socket.id]; // Remove from our active users list
      console.log(`User disconnected: ${disconnectedUser} (${socket.id})`);
      // Broadcast to ALL clients that a user has left
      io.emit('user left', disconnectedUser);
    } else {
      console.log(`Anonymous user disconnected: ${socket.id}`);
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});