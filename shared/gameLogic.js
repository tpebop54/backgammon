// Shared Backgammon game logic for server and clients
// Pure functions only, no dependencies on Express, Socket.io, or React

/**
 * Returns the default board setup for a new game.
 * @param {boolean} dev If true, use dev board; else use standard board.
 * @returns {number[]}
 */
function getBoard(dev = false) {
    if (dev) {
        return [
            0, 0, 0, 1, 1, 1,  // 1-6
            0, 0, 0, 0, 0, 0,  // 7-12
            0, 0, 0, 0, 0, 0,  // 13-18
            -1, -1, -1, 0, 0, 0, // 19-24
        ];
    } else {
        return [
            -2, 0, 0, 0, 0, 5,    // 1-6: 2 black on 1, 5 white on 6
            0, 3, 0, 0, 0, -5,    // 7-12: 3 white on 8, 5 black on 12
            5, 0, 0, 0, -3, 0,    // 13-18: 5 white on 13
            -5, 0, 0, 0, 0, 2,    // 19-24: 3 black on 17, 5 black on 19, 2 white on 24
        ];
    }
}

/**
 * Returns a new initial game state object.
 * @param {boolean} dev If true, use dev board; else use standard board.
 * @returns {import('./types').GameState}
 */
function getInitialGameState(dev = false) {
    return {
        board: getBoard(dev),
        bar: { white: 0, black: 0 },
        home: { white: 0, black: 0 },
        currentPlayer: 'white',
        dice: null,
        usedDice: [false, false],
        gamePhase: 'setup',
        possibleMoves: [],
    };
}

/**
 * Calculates all possible moves for the current player given the state.
 * @param {import('./types').GameState} state
 * @returns {import('./types').Move[]}
 */
function calculatePossibleMoves(state) {
    const moves = [];
    if (!state.dice || state.gamePhase !== 'playing') return moves;
    const diceList = state.dice;
    const player = state.currentPlayer;
    const direction = player === 'white' ? -1 : 1;
    const board = state.board;
    const bar = state.bar;
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

module.exports = {
    getBoard,
    getInitialGameState,
    calculatePossibleMoves,
};
