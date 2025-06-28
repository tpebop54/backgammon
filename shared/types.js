// Shared types for Backgammon game state and moves

/**
 * @typedef {Object} Bar
 * @property {number} white
 * @property {number} black
 */

/**
 * @typedef {Object} Home
 * @property {number} white
 * @property {number} black
 */

/**
 * @typedef {Object} Move
 * @property {number} from
 * @property {number} to
 * @property {number} dice
 */

/**
 * @typedef {Object} GameState
 * @property {number[]} board
 * @property {Bar} bar
 * @property {Home} home
 * @property {"white"|"black"} currentPlayer
 * @property {number[]|null} dice
 * @property {boolean[]} usedDice
 * @property {"setup"|"playing"|"finished"} gamePhase
 * @property {Move[]} possibleMoves
 */

// Export for Node.js and browser
if (typeof module !== 'undefined') module.exports = {};
