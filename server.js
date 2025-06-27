// Simple Socket.io + Express server for Backgammon multiplayer
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// In-memory game state for demo (roomId -> gameState)
const games = {};

// Default initial game state (should match your frontend's initial state)
function getInitialGameState() {
  return {
    board: [
      -2, 0, 0, 0, 0, 5,
      0, 3, 0, 0, 0, -5,
      5, 0, 0, 0, -3, 0,
      -5, 0, 0, 0, 0, 2,
    ],
    bar: { white: 0, black: 0 },
    home: { white: 0, black: 0 },
    currentPlayer: 'white',
    dice: null,
    usedDice: [false, false],
    gamePhase: 'setup',
    possibleMoves: [],
  };
}

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    socket.join(roomId);
    if (!games[roomId]) {
      games[roomId] = getInitialGameState();
    }
    socket.emit('gameState', games[roomId]);
    socket.to(roomId).emit('playerJoined');
  });

  socket.on('makeMove', ({ roomId, newState }) => {
    // In production, validate move here!
    games[roomId] = newState;
    io.to(roomId).emit('gameState', newState);
  });

  socket.on('reset', (roomId) => {
    games[roomId] = getInitialGameState();
    io.to(roomId).emit('gameState', games[roomId]);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
