// Utility to apply a move locally for preview (client-side only)
// This should match the server logic as closely as possible
import type { GameState, Player } from '../components/BackgammonBoard';

export function applyMoveLocally(state: GameState, move: { from: number; to: number; dice: number }): GameState {
    const player = state.currentPlayer;
    const opponent = player === 'white' ? 'black' : 'white';
    const newBoard = [...state.board];
    const newBar = { ...state.bar };
    const newHome = { ...state.home };
    const newUsedDice = [...state.usedDice];
    // Find the die index to use (first unused die of this value)
    const dieIdx = state.dice?.findIndex((d: number, i: number) => !state.usedDice[i] && d === move.dice) ?? -1;
    if (dieIdx === -1) return state; // No available die
    newUsedDice[dieIdx] = true;
    // Move checker on the board or from the bar
    if (move.from === -1) {
        // Moving from the bar
        newBar[player] -= 1;
    } else {
        // Moving from a point on the board
        newBoard[move.from] -= player === 'white' ? 1 : -1;
    }
    // Handle hitting opponent's blot (single checker)
    if (move.to !== -2 && move.to !== -1) {
        const dest = newBoard[move.to];
        if ((player === 'white' && dest === -1) || (player === 'black' && dest === 1)) {
            newBoard[move.to] = 0;
            newBar[opponent] += 1;
        }
    }
    // Place our checker (after possible hit)
    if (move.to === -2) {
        // Bearing off
        newHome[player] += 1;
    } else {
        // Placing on a board point
        newBoard[move.to] += player === 'white' ? 1 : -1;
    }
    // Return new state (do not advance turn or roll dice)
    return {
        ...state,
        board: newBoard,
        bar: newBar,
        home: newHome,
        usedDice: newUsedDice,
        // dice and currentPlayer remain unchanged
    };
}
