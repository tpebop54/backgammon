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

  // Instead of sending the full newState, send a move object and let the server update state and roll dice
  socket.on('makeMove', ({ roomId, move }) => {
    const state = games[roomId];
    if (!state) return;
    // move: { from, to, dice }
    const { from, to, dice } = move;
    const player = state.currentPlayer;
    const opponent = player === 'white' ? 'black' : 'white';
    const newBoard = [...state.board];
    const newBar = { ...state.bar };
    const newHome = { ...state.home };
    // Move checker on the board
    if (from !== -1) {
      newBoard[from] -= player === 'white' ? 1 : -1;
    }
    // Handle hitting opponent's blot (single checker)
    if (to !== -2 && to !== -1) {
      const dest = newBoard[to];
      if ((player === 'white' && dest === -1) || (player === 'black' && dest === 1)) {
        newBoard[to] = 0;
        newBar[opponent] += 1;
      }
    }
    // Place our checker (after possible hit)
    if (to !== -2) {
      newBoard[to] += player === 'white' ? 1 : -1;
    }
    // Update bar and home for our own checker
    if (from === -1) {
      newBar[player] -= 1;
    } else if (to === -2) {
      newHome[player] += 1;
    }
    // Update used dice
    let diceIndex = -1;
    if (state.dice) {
      for (let i = 0; i < state.dice.length; i++) {
        if (state.dice[i] === dice && !state.usedDice[i]) {
          diceIndex = i;
          break;
        }
      }
    }
    const newUsedDice = [...state.usedDice];
    if (diceIndex !== -1) {
      newUsedDice[diceIndex] = true;
    }
    // Check for win
    const totalWhite = newHome.white;
    const totalBlack = newHome.black;
    const initialWhiteCheckers = 15;
    const initialBlackCheckers = 15;
    const whiteOnBoard = newBoard.reduce((sum, n) => sum + (n > 0 ? n : 0), 0) + newBar.white;
    const blackOnBoard = newBoard.reduce((sum, n) => sum + (n < 0 ? -n : 0), 0) + newBar.black;
    if (totalWhite === initialWhiteCheckers && whiteOnBoard === 0) {
      games[roomId] = {
        ...state,
        board: newBoard,
        bar: newBar,
        home: newHome,
        usedDice: newUsedDice,
        gamePhase: 'finished',
      };
      io.to(roomId).emit('gameState', games[roomId]);
      return;
    }
    if (totalBlack === initialBlackCheckers && blackOnBoard === 0) {
      games[roomId] = {
        ...state,
        board: newBoard,
        bar: newBar,
        home: newHome,
        usedDice: newUsedDice,
        gamePhase: 'finished',
      };
      io.to(roomId).emit('gameState', games[roomId]);
      return;
    }
    // If all dice used, switch player and roll dice
    const allUsed = newUsedDice.every(u => u);
    let nextState = {
      ...state,
      board: newBoard,
      bar: newBar,
      home: newHome,
      usedDice: newUsedDice,
    };
    if (allUsed) {
      const nextPlayer = player === 'white' ? 'black' : 'white';
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const diceArray = dice1 === dice2 ? [dice1, dice1, dice1, dice1] : [dice1, dice2];
      nextState = {
        ...nextState,
        currentPlayer: nextPlayer,
        dice: diceArray,
        usedDice: new Array(diceArray.length).fill(false),
        gamePhase: 'playing',
      };
    }
    games[roomId] = nextState;
    io.to(roomId).emit('gameState', nextState);
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
