// Simple Socket.io + Express server for Backgammon multiplayer
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getInitialGameState, calculatePossibleMoves } = require('./shared/gameLogic');

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
