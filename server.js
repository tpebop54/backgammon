// Simple Socket.io + Express server for Backgammon multiplayer
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getInitialGameState, calculatePossibleMoves, checkWin } = require('./shared/gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

// --- Special constants for pass/timeout moves ---
const PASS_FROM = -999;
const PASS_TO = -999;
const PASS_DICE = -999;
const BEAR_OFF_TO = -2; // Add this line for bear off moves

// In-memory game state for demo (roomId -> gameState)
const games = {};

// Track player assignments per room: { [roomId]: { white: socketId, black: socketId } }
const playerAssignments = {};

// --- Timer constants ---
const TIMER_DURATION = 30;
const TIMER_INTERVAL_MS = 1000;

// --- Timer management ---
const gameTimers = {}; // roomId -> NodeJS.Timeout

// --- Store turn start state for revert-on-timeout ---
// Each game state will have a .turnStartState property
// Save a deep copy at the start of each turn
function saveTurnStartState(roomId) {
    const state = games[roomId];
    if (!state) return;
    // Only save relevant fields
    state.turnStartState = {
        board: [...state.board],
        bar: { ...state.bar },
        home: { ...state.home },
        usedDice: state.usedDice ? [...state.usedDice] : null,
        dice: state.dice ? [...state.dice] : null,
        currentPlayer: state.currentPlayer,
        timers: { ...state.timers },
        gamePhase: state.gamePhase,
    };
}

function restoreTurnStartState(roomId) {
    const state = games[roomId];
    if (!state || !state.turnStartState) return;
    const snap = state.turnStartState;
    state.board = [...snap.board];
    state.bar = { ...snap.bar };
    state.home = { ...snap.home };
    state.usedDice = snap.usedDice ? [...snap.usedDice] : null;
    state.dice = snap.dice ? [...snap.dice] : null;
    state.currentPlayer = snap.currentPlayer;
    state.timers = { ...snap.timers };
    state.gamePhase = snap.gamePhase;
}

// --- Timer management ---
function startGameTimer(roomId) {
    if (gameTimers[roomId]) clearInterval(gameTimers[roomId]);
    gameTimers[roomId] = setInterval(() => {
        const state = games[roomId];
        if (!state || state.gamePhase !== 'playing') return;
        if (!state.timers) return;
        const current = state.currentPlayer;
        if (state.timers[current] > 0) {
            state.timers[current] -= 1;
            io.to(roomId).emit('gameState', state);
        } else {
            // Timer reached 0: auto-pass
            const passMove = { from: PASS_FROM, to: PASS_TO, dice: PASS_DICE };
            // Simulate a pass move as if from the current player
            // This will trigger the normal pass logic and reset timers
            handleMakeMoves(roomId, [passMove], current, true);
        }
    }, TIMER_INTERVAL_MS);
}

function stopGameTimer(roomId) {
    if (gameTimers[roomId]) {
        clearInterval(gameTimers[roomId]);
        delete gameTimers[roomId];
    }
}

// --- Refactor move handler for timer support ---
function handleMakeMoves(roomId, moves, playerColor, isServerTimeout = false) {
    let state = games[roomId];
    if (!state || !moves || !Array.isArray(moves) || moves.length === 0) return;
    // Only allow the current player to make a move (unless server timeout)
    if (!isServerTimeout && playerAssignments[roomId]?.[state.currentPlayer] !== undefined && playerAssignments[roomId][state.currentPlayer] !== null) {
        if (playerColor !== state.currentPlayer) return;
    }
    let player = state.currentPlayer;
    let opponent = switchPlayer(player);
    let newBoard = [...state.board];
    let newBar = { ...state.bar };
    let newHome = { ...state.home };
    let newUsedDice = [...state.usedDice];
    let dice = state.dice ? [...state.dice] : null;
    let timers = { ...state.timers };
    let gamePhase = state.gamePhase;
    let winner = null;
    for (const move of moves) {
        // Timeout/pass move: end turn immediately
        if (isPassMove(move)) {
            // --- Revert to turn start state on timeout/pass ---
            restoreTurnStartState(roomId);
            state = games[roomId];
            const nextPlayer = switchPlayer(state.currentPlayer);
            const diceArray = rollDice();
            timers = { ...state.timers };
            timers[state.currentPlayer] = TIMER_DURATION;
            timers[nextPlayer] = TIMER_DURATION;
            // Always create a fresh state for the next player on timeout
            const nextState = {
                ...state,
                currentPlayer: nextPlayer,
                dice: diceArray,
                usedDice: new Array(diceArray.length).fill(false),
                gamePhase: 'playing',
                timers,
                possibleMoves: [],
            };
            nextState.possibleMoves = calculatePossibleMoves(nextState);
            games[roomId] = nextState;
            io.to(roomId).emit('gameState', nextState);
            saveTurnStartState(roomId); // Save snapshot for new turn
            startGameTimer(roomId);
            return;
        }
        // Validate move
        const possibleMoves = calculatePossibleMoves({
            ...state,
            board: newBoard,
            bar: newBar,
            home: newHome,
            usedDice: newUsedDice,
            dice,
            gamePhase,
        });
        if (!isValidMove(move, possibleMoves)) {
            // If any move is invalid, reject the whole batch
            return;
        }
        const { from, to, dice: moveDice } = move;
        // --- Only move one checker per move, even with doubles ---
        if (from === PASS_FROM) {
            newBar[player] -= 1;
        } else {
            if (player === 'white') {
                newBoard[from] -= 1;
            } else {
                newBoard[from] += 1;
            }
        }
        // Handle hitting opponent's blot (single checker)
        if (to !== BEAR_OFF_TO && to !== PASS_TO) {
            const dest = newBoard[to];
            if ((player === 'white' && dest === -1) || (player === 'black' && dest === 1)) {
                newBoard[to] = 0;
                newBar[opponent] += 1;
            }
        }
        // Place our checker (after possible hit)
        if (to === BEAR_OFF_TO) {
            newHome[player] += 1;
        } else {
            if (player === 'white') {
                newBoard[to] += 1;
            } else {
                newBoard[to] -= 1;
            }
        }
        // --- Only mark one die as used per move, even with doubles ---
        let diceIndex = -1;
        if (dice) {
            for (let i = 0; i < dice.length; i++) {
                if (dice[i] === moveDice && !newUsedDice[i]) {
                    diceIndex = i;
                    break;
                }
            }
        }
        if (diceIndex !== -1) {
            newUsedDice[diceIndex] = true;
        }
        // Check for win after each move
        winner = checkWin ? checkWin(newHome, newBoard, newBar) : null;
        if (winner) break;
    }
    // If win, finish game
    if (winner) {
        stopGameTimer(roomId);
        games[roomId] = {
            ...state,
            board: newBoard,
            bar: newBar,
            home: newHome,
            usedDice: newUsedDice,
            gamePhase: 'finished',
            dice: null,
            possibleMoves: [],
            timers,
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
        dice,
        timers,
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
        const nextPlayer = switchPlayer(player);
        const diceArray = rollDice();
        timers[nextPlayer] = TIMER_DURATION;
        timers[player] = TIMER_DURATION;
        nextState = {
            ...nextState,
            currentPlayer: nextPlayer,
            dice: diceArray,
            usedDice: new Array(diceArray.length).fill(false),
            gamePhase: 'playing',
            timers,
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
        saveTurnStartState(roomId); // Save snapshot for new turn
        startGameTimer(roomId);
    }
    games[roomId] = nextState;
    io.to(roomId).emit('gameState', nextState);
}

// Helper to detect a pass/timeout move
function isPassMove(move) {
    return move && move.from === PASS_FROM && move.to === PASS_TO && move.dice === PASS_DICE;
}

// --- Dice roll helper ---
function rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    return d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
}

// Helper to switch player
function switchPlayer(player) {
    return player === 'white' ? 'black' : 'white';
}

// Helper to validate a move against possibleMoves
function isValidMove(move, possibleMoves) {
    return possibleMoves.some(
        m => m.from === move.from && m.to === move.to && m.dice === move.dice
    );
}

io.on('connection', (socket) => {
    socket.on('join', (roomId) => {
        socket.join(roomId);
        if (!games[roomId]) {
            games[roomId] = getInitialGameState();
            games[roomId].timers = { white: TIMER_DURATION, black: TIMER_DURATION };
        } else if (!games[roomId].timers) {
            games[roomId].timers = { white: TIMER_DURATION, black: TIMER_DURATION };
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
            const diceArray = rollDice();
            games[roomId] = {
                ...games[roomId],
                dice: diceArray,
                usedDice: new Array(diceArray.length).fill(false),
                gamePhase: 'playing',
                timers: { white: TIMER_DURATION, black: TIMER_DURATION },
            };
            games[roomId].possibleMoves = calculatePossibleMoves(games[roomId]);
            startGameTimer(roomId);
        }
    });

    // Instead of sending the full newState, send a move object and let the server update state and roll dice
    socket.on('makeMove', ({ roomId, moves, playerColor }) => {
        handleMakeMoves(roomId, moves, playerColor, false);
    });

    socket.on('reset', (roomId) => {
        // Roll dice and set to playing phase immediately
        const diceArray = rollDice();
        const initialState = {
            ...getInitialGameState(),
            dice: diceArray,
            usedDice: new Array(diceArray.length).fill(false),
            gamePhase: 'playing',
            timers: { white: TIMER_DURATION, black: TIMER_DURATION },
        };
        initialState.possibleMoves = calculatePossibleMoves(initialState);
        games[roomId] = initialState;
        io.to(roomId).emit('gameState', games[roomId]);
        startGameTimer(roomId);
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
