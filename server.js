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

// Track player assignments per room: { [roomId]: { white: socketId, black: socketId } }
const playerAssignments = {};

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

// --- Server-side possibleMoves calculation ---
function calculatePossibleMoves(state) {
  const moves = [];
  if (!state.dice || state.gamePhase !== 'playing') return moves;
  const diceList = state.dice;
  const player = state.currentPlayer;
  const direction = player === 'white' ? -1 : 1;
  const board = state.board;
  const bar = state.bar;
  // Helper: can bear off
  function canBearOff(player, board) {
    if (player === 'white') {
      for (let i = 6; i < 24; i++) if (board[i] > 0) return false;
    } else {
      for (let i = 0; i < 18; i++) if (board[i] < 0) return false;
    }
    return true;
  }
  const canBearOffNow = canBearOff(player, board);
  const hasBarPieces = bar[player] > 0;
  if (hasBarPieces) {
    for (let d = 0; d < diceList.length; d++) {
      const dice = diceList[d];
      let targetPoint;
      if (player === 'white') targetPoint = 24 - dice;
      else targetPoint = dice - 1;
      if (targetPoint >= 0 && targetPoint < 24) {
        const targetPieces = board[targetPoint];
        const isBlocked = (player === 'white' && targetPieces < -1) || (player === 'black' && targetPieces > 1);
        if (!isBlocked) moves.push({ from: -1, to: targetPoint, dice });
      }
    }
  } else {
    for (let from = 0; from < 24; from++) {
      const pieces = board[from];
      const isCurrentPlayerPiece = (player === 'white' && pieces > 0) || (player === 'black' && pieces < 0);
      if (!isCurrentPlayerPiece) continue;
      for (let d = 0; d < diceList.length; d++) {
        const dice = diceList[d];
        let to = from + (dice * direction);
        if (canBearOffNow && (
          (player === 'white' && from >= 0 && from <= 5 && to < 0) ||
          (player === 'black' && from >= 18 && from <= 23 && to >= 24)
        )) {
          let isHighest = true;
          if (player === 'white') {
            for (let i = from + 1; i <= 5; i++) if (board[i] > 0) isHighest = false;
            const exact = (from + 1) === dice;
            if (exact || (isHighest && dice > (from + 1))) moves.push({ from, to: -2, dice });
          } else {
            for (let i = from - 1; i >= 18; i--) if (board[i] < 0) isHighest = false;
            const exact = (24 - from) === dice;
            if (exact || (isHighest && dice > (24 - from))) moves.push({ from, to: -2, dice });
          }
          continue;
        }
        if (to >= 0 && to < 24) {
          const targetPieces = board[to];
          const isBlocked = (player === 'white' && targetPieces < -1) || (player === 'black' && targetPieces > 1);
          if (!isBlocked) moves.push({ from, to, dice });
        }
      }
    }
  }
  return moves;
}
// --- End possibleMoves calculation ---

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    socket.join(roomId);
    if (!games[roomId]) {
      games[roomId] = getInitialGameState();
    }
    // Assign player color robustly
    if (!playerAssignments[roomId]) playerAssignments[roomId] = {};
    // Remove assignment if socket is not connected
    const room = io.sockets.adapter.rooms.get(roomId) || new Set();
    if (playerAssignments[roomId].white && !room.has(playerAssignments[roomId].white)) {
      playerAssignments[roomId].white = undefined;
    }
    if (playerAssignments[roomId].black && !room.has(playerAssignments[roomId].black)) {
      playerAssignments[roomId].black = undefined;
    }
    let assignedColor;
    if (playerAssignments[roomId].white === socket.id) {
      assignedColor = 'white';
    } else if (playerAssignments[roomId].black === socket.id) {
      assignedColor = 'black';
    } else if (!playerAssignments[roomId].white) {
      playerAssignments[roomId].white = socket.id;
      assignedColor = 'white';
    } else if (!playerAssignments[roomId].black) {
      playerAssignments[roomId].black = socket.id;
      assignedColor = 'black';
    } else {
      assignedColor = null;
    }
    socket.emit('playerAssignment', { color: assignedColor });
    socket.emit('gameState', games[roomId]);
    socket.to(roomId).emit('playerJoined');

    // If game is in setup phase, roll dice and set to playing
    if (games[roomId].gamePhase === 'setup') {
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const diceArray = dice1 === dice2 ? [dice1, dice1, dice1, dice1] : [dice1, dice2];
      games[roomId] = {
        ...games[roomId],
        dice: diceArray,
        usedDice: new Array(diceArray.length).fill(false),
        gamePhase: 'playing',
      };
      games[roomId].possibleMoves = calculatePossibleMoves(games[roomId]);
    }
  });

  // Instead of sending the full newState, send a move object and let the server update state and roll dice
  socket.on('makeMove', ({ roomId, move, playerColor }) => {
    const state = games[roomId];
    if (!state || !move) return;
    // Only allow the current player to make a move
    if (socket.id !== playerAssignments[roomId]?.[state.currentPlayer]) {
      console.log(`[makeMove] Rejected move: Not ${state.currentPlayer}'s turn (socket: ${socket.id})`);
      return;
    }
    // Debug logging for move attempts
    console.log(`\n[makeMove] Room: ${roomId}`);
    console.log('Received move:', move);
    console.log('Current possibleMoves:', JSON.stringify(state.possibleMoves, null, 2));
    // move: { from, to, dice }
    const { from, to, dice } = move;
    const player = state.currentPlayer;
    const opponent = player === 'white' ? 'black' : 'white';
    const newBoard = [...state.board];
    const newBar = { ...state.bar };
    const newHome = { ...state.home };
    // Move checker on the board or from the bar
    if (from === -1) {
      // Moving from the bar
      newBar[player] -= 1;
    } else {
      // Moving from a point on the board
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
    if (to === -2) {
      // Bearing off
      newHome[player] += 1;
    } else {
      // Placing on a board point
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
        dice: null, // Hide dice after win
        possibleMoves: [],
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
        dice: null, // Hide dice after win
        possibleMoves: [],
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
      dice: state.dice, // Ensure dice is always present until turn is over
    };
    nextState.possibleMoves = calculatePossibleMoves({
      ...nextState,
      currentPlayer: nextState.currentPlayer,
      dice: nextState.dice,
      usedDice: nextState.usedDice,
      bar: nextState.bar,
      board: nextState.board,
      gamePhase: nextState.gamePhase || 'playing',
    });
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
      nextState.possibleMoves = calculatePossibleMoves({
        ...nextState,
        currentPlayer: nextState.currentPlayer,
        dice: nextState.dice,
        usedDice: nextState.usedDice,
        bar: nextState.bar,
        board: nextState.board,
        gamePhase: nextState.gamePhase || 'playing',
      });
    }
    games[roomId] = nextState;
    io.to(roomId).emit('gameState', nextState);
  });

  socket.on('reset', (roomId) => {
    // Roll dice and set to playing phase immediately
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const diceArray = dice1 === dice2 ? [dice1, dice1, dice1, dice1] : [dice1, dice2];
    const initialState = {
      ...getInitialGameState(),
      dice: diceArray,
      usedDice: new Array(diceArray.length).fill(false),
      gamePhase: 'playing',
    };
    initialState.possibleMoves = calculatePossibleMoves(initialState);
    games[roomId] = initialState;
    io.to(roomId).emit('gameState', games[roomId]);
  });

  // Clean up player assignment on disconnect
  socket.on('disconnect', () => {
    for (const roomId in playerAssignments) {
      if (playerAssignments[roomId].white === socket.id) {
        playerAssignments[roomId].white = undefined;
      }
      if (playerAssignments[roomId].black === socket.id) {
        playerAssignments[roomId].black = undefined;
      }
    }
  });
});

// Add an endpoint to view current socket connections and assignments
app.get('/connections', (req, res) => {
  const rooms = {};
  for (const [roomId, assignment] of Object.entries(playerAssignments)) {
    const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    rooms[roomId] = {
      sockets,
      assignments: assignment
    };
  }
  res.json(rooms);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
