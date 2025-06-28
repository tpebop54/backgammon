'use client'

import React, { useState, useEffect, useCallback } from 'react';
import Point from './Point';
import Bar from './Bar';
import Home from './Home';
import Dice from './Dice';
import Controls from './Controls';
import { useSocketGame } from '../context/SocketContext';
import { applyMoveLocally } from '../utils/applyMoveLocally';

// Game state type definitions
export type Player = 'white' | 'black';
export type GameState = {
    board: number[]; // 24 points, positive = white pieces, negative = black pieces
    bar: { white: number; black: number }; // pieces on the bar
    home: { white: number; black: number }; // pieces borne off
    currentPlayer: Player; // current player turn
    dice: number[] | null; // current rolled dice, null if not rolled
    usedDice: boolean[]; // track which dice have been used
    gamePhase: 'setup' | 'playing' | 'finished';
    possibleMoves: Array<{ from: number; to: number; dice: number }>;
    timers?: { white: number; black: number }; // server-synced timers
};

// Used for dev to test different scenarios.
const devBoard = [
    0, 0, 0, 1, 1, 1,  // 1-6
    0, 0, 0, 0, 0, 0,     // 7-12
    0, 0, 0, 0, 0, 0,     // 13-18
    -1, -1, -1, 0, 0, 0,     // 19-24
];

//Setup for an actual backgammon game.
const defaultBoard = [
    -2, 0, 0, 0, 0, 5,    // 1-6: 2 black on 1, 5 white on 6
    0, 3, 0, 0, 0, -5,    // 7-12: 3 white on 8, 5 black on 12
    5, 0, 0, 0, -3, 0,    // 13-18: 5 white on 13
    -5, 0, 0, 0, 0, 2,    // 19-24: 3 black on 17, 5 black on 19, 2 white on 24
];

const freshBoard = devBoard;

// Initial checker locations
const initialGameState: GameState = {
    board: freshBoard,
    bar: { white: 0, black: 0 },
    home: { white: 0, black: 0 },
    currentPlayer: 'white',
    dice: null,
    usedDice: [false, false],
    gamePhase: 'setup',
    possibleMoves: []
};

const BackgammonBoard: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
    const [draggedPiece, setDraggedPiece] = useState<{ fromPoint: number; player: Player; checkerIndex: number } | null>(null);
    const [dragOverPoint, setDragOverPoint] = useState<number | null>(null);
    const [invalidDropFeedback, setInvalidDropFeedback] = useState<string | null>(null);
    const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
    const [draggingCheckerIndex, setDraggingCheckerIndex] = useState<number | null>(null);
    // Track initial checker counts for win detection
    const [initialWhiteCheckers, setInitialWhiteCheckers] = useState(() => {
        return initialGameState.board.reduce((sum, n) => sum + (n > 0 ? n : 0), 0) + initialGameState.bar.white + initialGameState.home.white;
    });
    const [initialBlackCheckers, setInitialBlackCheckers] = useState(() => {
        return initialGameState.board.reduce((sum, n) => sum + (n < 0 ? -n : 0), 0) + initialGameState.bar.black + initialGameState.home.black;
    });
    // Add winner state
    const [winner, setWinner] = useState<string | null>(null);
    // Track mouse position for drag preview
    const [dragMouse, setDragMouse] = useState<{ x: number; y: number } | null>(null);

    // Multiplayer: join room and sync state
    const { gameState: remoteGameState, sendMove, resetGame: resetGameSocket, joinRoom, connected, playerColor } = useSocketGame();
    useEffect(() => {
        joinRoom('default'); // For now, always join the default room
    }, [joinRoom]);

    // Use remoteGameState if available
    const effectiveState = remoteGameState || gameState;

    // --- Multiplayer: Only allow controls for the current player ---
    const isMyTurn = !!playerColor && effectiveState.currentPlayer === playerColor && effectiveState.gamePhase === 'playing';

    // --- 30-second countdown timers for each player ---
    // Timer display component (now uses server-synced timers)
    const TimerDisplay = ({ player }: { player: Player }) => {
        const t = effectiveState.timers ? effectiveState.timers[player] : 30;
        const isActive = effectiveState.currentPlayer === player && effectiveState.gamePhase === 'playing';
        return (
            <div className={`flex flex-col items-${player === 'black' ? 'start' : 'end'} w-24`}>
                <span className="text-xs font-semibold text-gray-700 mb-1">{player === 'black' ? 'Black' : 'White'} Timer</span>
                <span className={`text-2xl font-mono font-bold ${isActive && t <= 10 ? 'text-red-600' : 'text-gray-900'} ${isActive ? '' : 'opacity-60'}`}>{t}s</span>
            </div>
        );
    };

    // --- Handler and helper function declarations ---
    // Memoize canBearOff to avoid unnecessary recalculations
    const canBearOff = useCallback((player: Player, board: number[]): boolean => {
        if (player === 'white') {
            // White's home is 0-5; check for any white checkers outside 0-5
            for (let i = 6; i < 24; i++) {
                if (board[i] > 0) return false;
            }
        } else {
            // Black's home is 18-23; check for any black checkers outside 18-23
            for (let i = 0; i < 18; i++) {
                if (board[i] < 0) return false;
            }
        }
        return true;
    }, []);

    // Memoize calculatePossibleMoves to avoid unnecessary recalculations
    const calculatePossibleMoves = useCallback((state: GameState): Array<{ from: number; to: number; dice: number }> => {
        const moves: Array<{ from: number; to: number; dice: number }> = [];
        if (!state.dice || state.gamePhase !== 'playing') return moves;
        const diceList = state.dice;
        const direction = state.currentPlayer === 'white' ? -1 : 1;
        const canBearOffNow = canBearOff(state.currentPlayer, state.board);
        const hasBarPieces = state.bar[state.currentPlayer] > 0;
        if (hasBarPieces) {
            for (let d = 0; d < diceList.length; d++) {
                const dice = diceList[d];
                let targetPoint: number;
                if (state.currentPlayer === 'white') {
                    targetPoint = 24 - dice;
                } else {
                    targetPoint = dice - 1;
                }
                if (targetPoint >= 0 && targetPoint < 24) {
                    const targetPieces = state.board[targetPoint];
                    const isBlocked = (state.currentPlayer === 'white' && targetPieces < -1) ||
                        (state.currentPlayer === 'black' && targetPieces > 1);
                    if (!isBlocked) {
                        moves.push({ from: -1, to: targetPoint, dice });
                    }
                }
            }
        } else {
            for (let from = 0; from < 24; from++) {
                const pieces = state.board[from];
                const isCurrentPlayerPiece = (state.currentPlayer === 'white' && pieces > 0) ||
                    (state.currentPlayer === 'black' && pieces < 0);
                if (!isCurrentPlayerPiece) continue;
                for (let d = 0; d < diceList.length; d++) {
                    const dice = diceList[d];
                    let to = from + (dice * direction);
                    // Only allow bearing off from home board
                    if (canBearOffNow && (
                        (state.currentPlayer === 'white' && from >= 0 && from <= 5 && to < 0) ||
                        (state.currentPlayer === 'black' && from >= 18 && from <= 23 && to >= 24)
                    )) {
                        // Allow bearing off from the highest occupied point with a higher die (including doubles)
                        let fartherCheckerExists = false;
                        let isHighest = true;
                        if (state.currentPlayer === 'white') {
                            // For white, check for checkers on lower points (indices 0 to from-1)
                            for (let i = 0; i < from; i++) {
                                if (state.board[i] > 0) {
                                    fartherCheckerExists = true;
                                    break;
                                }
                            }
                            // Only allow bearing off with a higher die from the highest occupied point
                            isHighest = true;
                            for (let i = from + 1; i <= 5; i++) {
                                if (state.board[i] > 0) {
                                    isHighest = false;
                                    break;
                                }
                            }
                            const exact = (from + 1) === dice;
                            // FIX: Allow bearing off with a higher die from the highest occupied point if no checkers on higher points (regardless of lower points)
                            if (exact || (isHighest && dice > (from + 1))) {
                                moves.push({ from, to: -2, dice });
                            }
                        } else {
                            // For black, check for checkers on higher points (indices from+1 to 23)
                            for (let i = from + 1; i <= 23; i++) {
                                if (state.board[i] < 0) {
                                    fartherCheckerExists = true;
                                    break;
                                }
                            }
                            // Only allow bearing off with a higher die from the highest occupied point
                            isHighest = true;
                            for (let i = from - 1; i >= 18; i--) {
                                if (state.board[i] < 0) {
                                    isHighest = false;
                                    break;
                                }
                            }
                            const exact = (24 - from) === dice;
                            if (exact || (isHighest && dice > (24 - from))) {
                                moves.push({ from, to: -2, dice });
                            }
                        }
                        continue;
                    }
                    if (to >= 0 && to < 24) {
                        const targetPieces = state.board[to];
                        const isBlocked = (state.currentPlayer === 'white' && targetPieces < -1) ||
                            (state.currentPlayer === 'black' && targetPieces > 1);
                        if (!isBlocked) {
                            moves.push({ from, to, dice });
                        }
                    }
                }
            }
        }
        return moves;
    }, [canBearOff]);

    // Update isValidMove to use displayState
    const isValidMove = (from: number, to: number, dice: number): boolean => {
        return displayState.possibleMoves.some(move =>
            move.from === from && move.to === to && move.dice === dice
        );
    };

    // Add a helper to reset the game and initial checker counts
    const resetGame = (newInitialState: GameState) => {
        setGameState(newInitialState);
        setInitialWhiteCheckers(
            newInitialState.board.reduce((sum, n) => sum + (n > 0 ? n : 0), 0) + newInitialState.bar.white + newInitialState.home.white
        );
        setInitialBlackCheckers(
            newInitialState.board.reduce((sum, n) => sum + (n < 0 ? -n : 0), 0) + newInitialState.bar.black + newInitialState.home.black
        );
    };

    // New Game handler
    const handleNewGame = () => {
        setWinner(null);
        resetGameSocket();
    };

    // --- End handler and helper function declarations ---

    // Automatically roll dice at the start of the first turn only
    useEffect(() => {
        const state = gameState;
        // Only roll dice if the game is in setup, no dice, no winner, and it's the very first turn
        if (
            state.gamePhase === 'setup' &&
            !state.dice &&
            !winner
        ) {
            // Simulate a dice roll
            const dice1 = Math.floor(Math.random() * 6) + 1;
            const dice2 = Math.floor(Math.random() * 6) + 1;
            const diceArray = dice1 === dice2 ? [dice1, dice1, dice1, dice1] : [dice1, dice2];
            // Update game state with rolled dice
            setGameState(prev => ({
                ...prev,
                dice: diceArray,
                usedDice: new Array(diceArray.length).fill(false),
                gamePhase: 'playing',
            }));
        }
        // eslint-disable-next-line
    }, [gameState.currentPlayer, gameState.gamePhase, winner]);

    // Calculate possible moves on game state change
    useEffect(() => {
        const state = gameState;
        const newMoves = calculatePossibleMoves(state);
        if (JSON.stringify(state.possibleMoves) !== JSON.stringify(newMoves)) {
            setGameState(prev => ({ ...prev, possibleMoves: newMoves }));
        }
        // Do not update state in a way that triggers this effect again unless necessary
    }, [gameState, calculatePossibleMoves]);

    // Pending moves queue for confirm-moves feature
    const [pendingMoves, setPendingMoves] = useState<Array<{ from: number; to: number; dice: number }>>([]);
    const [localState, setLocalState] = useState<GameState | null>(null); // Local state after applying pending moves

    // Use localState if pendingMoves exist, else effectiveState
    const displayState = localState || effectiveState;

    // For dice preview: show localState.dice/usedDice for the current player if there are pending moves, otherwise show effectiveState
    const diceToShow = (pendingMoves.length > 0 && isMyTurn && localState) ? localState.dice : effectiveState.dice;
    const usedDiceToShow = (pendingMoves.length > 0 && isMyTurn && localState) ? localState.usedDice : effectiveState.usedDice;

    // Confirm button logic: only enable if all dice are used or no possible moves left
    const allDiceUsed = displayState.dice ? displayState.usedDice.every(u => u) : false;
    const noMovesLeft = displayState.possibleMoves.length === 0;
    const canConfirm = pendingMoves.length > 0 && (allDiceUsed || noMovesLeft);

    // When a move is made (drag/drop), validate and queue it locally
    const queueMove = (from: number, to: number, dice: number, checkerIndex: number | null = null) => {
        // Start from the last local state or effectiveState
        const baseState = localState || effectiveState;
        // Validate move against baseState.possibleMoves
        const valid = baseState.possibleMoves.some(m => m.from === from && m.to === to && m.dice === dice);
        if (!valid) return;
        // Build up the preview state by applying all pending moves + this move
        let previewState = { ...baseState };
        let movesToApply = [...pendingMoves, { from, to, dice }];
        for (const move of movesToApply) {
            previewState = applyMoveLocally(previewState, move);
            // Recalculate possibleMoves after each move for correct preview
            previewState = {
                ...previewState,
                possibleMoves: calculatePossibleMoves(previewState)
            };
        }
        setPendingMoves(movesToApply);
        setLocalState(previewState);
    };

    // Confirm all pending moves
    const handleConfirmMoves = () => {
        if (pendingMoves.length === 0) return;
        // Clear pending moves and local state before sending to prevent double-sending
        const movesToSend = [...pendingMoves];
        setPendingMoves([]);
        setLocalState(null);
        // Send all moves to server
        for (const move of movesToSend) {
            sendMove(move);
        }
    };

    // Undo last pending move
    const handleUndo = () => {
        if (pendingMoves.length === 0) return;
        const newMoves = pendingMoves.slice(0, -1);
        // Rebuild preview state from effectiveState and newMoves
        let previewState = { ...(effectiveState as GameState) };
        for (const move of newMoves) {
            previewState = applyMoveLocally(previewState, move);
            previewState = {
                ...previewState,
                possibleMoves: calculatePossibleMoves(previewState)
            };
        }
        setPendingMoves(newMoves);
        setLocalState(newMoves.length > 0 ? previewState : null);
    };

    // Replace makeMove with queueMove in drag/drop handlers
    // ...existing code...

    // In handleDragStart, use displayState
    const handleDragStart = (e: React.DragEvent, pointIndex: number, checkerIndex: number) => {
        const piece = displayState.board[pointIndex];
        const player = piece > 0 ? 'white' : 'black';
        const absCount = Math.abs(piece);

        if (player !== displayState.currentPlayer) {
            e.preventDefault();
            return;
        }

        const hasValidMoves = displayState.possibleMoves.some(move => move.from === pointIndex);
        if (!hasValidMoves) {
            e.preventDefault();
            return;
        }

        setTimeout(() => {
            setDraggedPiece({ fromPoint: pointIndex, player, checkerIndex });
            setSelectedPoint(pointIndex);
            setDraggingPointIndex(pointIndex);
            setDraggingCheckerIndex(checkerIndex);
        }, 0);

        // Use a transparent drag image to hide the browser's default drag image
        const img = document.createElement('img');
        img.src = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
        e.dataTransfer.setDragImage(img, 0, 0);

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ fromPoint: pointIndex, player, checkerIndex }));

        setInvalidDropFeedback(null);
    };

    // In handleBarDragStart, use displayState
    const handleBarDragStart = (e: React.DragEvent, player: Player) => {
        if (player !== displayState.currentPlayer || displayState.bar[player] === 0) {
            e.preventDefault();
            return;
        }

        const hasValidMoves = displayState.possibleMoves.some(move => move.from === -1);
        if (!hasValidMoves) {
            e.preventDefault();
            return;
        }

        setDraggedPiece({ fromPoint: -1, player, checkerIndex: 0 });
        setSelectedPoint(-1);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ fromPoint: -1, player, checkerIndex: 0 }));

        setInvalidDropFeedback(null);
    };

    // In handleDrop, use displayState
    const handleDrop = (e: React.DragEvent, toPoint: number) => {
        e.preventDefault();
        setDragOverPoint(null);
        let dragData = draggedPiece;
        if (!dragData) {
            try {
                const dataString = e.dataTransfer.getData('application/json');
                if (dataString) {
                    dragData = JSON.parse(dataString);
                }
            } catch (err) {
                console.error('Failed to parse drag data:', err);
            }
        }
        if (!dragData) {
            setDraggedPiece(null);
            setSelectedPoint(null);
            setDragOverPoint(null);
            setDraggingPointIndex(null);
            setDraggingCheckerIndex(null);
            return;
        }
        // Prevent any moves if all dice are used
        if (!displayState.dice || displayState.usedDice.every(u => u)) return;
        // Find available dice values for this move
        const availableDice = displayState.dice?.filter((_, index) => !displayState.usedDice[index]) || [];

        // Try each available dice value to see if the move is valid
        let validMove = null;
        for (const dice of availableDice) {
            const possibleMove = displayState.possibleMoves.find(move =>
                move.from === dragData.fromPoint && move.to === toPoint && move.dice === dice
            );
            if (possibleMove) {
                validMove = possibleMove;
                break;
            }
        }

        if (validMove) {
            queueMove(dragData.fromPoint, toPoint, validMove.dice, dragData.checkerIndex);
        } else {
            const fromName = dragData.fromPoint === -1 ? 'bar' : `point ${dragData.fromPoint + 1}`;
            const toName = toPoint === -2 ? 'home' : `point ${toPoint + 1}`;
            setInvalidDropFeedback(`Invalid move from ${fromName} to ${toName}`);
        }

        setDraggedPiece(null);
        setSelectedPoint(null);
        setDragOverPoint(null);
        setDraggingPointIndex(null);
        setDraggingCheckerIndex(null);
    };

    // In handleHomeDrop, use displayState
    const handleHomeDrop = (e: React.DragEvent, player: Player) => {
        e.preventDefault();
        setDragOverPoint(null);
        let dragData = draggedPiece;
        if (!dragData) {
            try {
                const dataString = e.dataTransfer.getData('application/json');
                if (dataString) {
                    dragData = JSON.parse(dataString);
                }
            } catch (err) {
                console.error('Failed to parse drag data:', err);
            }
        }
        if (!dragData || dragData.player !== player) {
            setDraggedPiece(null);
            setSelectedPoint(null);
            setDragOverPoint(null);
            setDraggingPointIndex(null);
            setDraggingCheckerIndex(null);
            return;
        }
        // Prevent any moves if all dice are used
        if (!displayState.dice || displayState.usedDice.every(u => u)) return;
        // Find available dice values for bearing off
        const availableDice = displayState.dice?.filter((_, index) => !displayState.usedDice[index]) || [];

        let validMove = null;
        for (const dice of availableDice) {
            const possibleMove = displayState.possibleMoves.find(move =>
                move.from === dragData.fromPoint && move.to === -2 && move.dice === dice
            );
            if (possibleMove) {
                validMove = possibleMove;
                break;
            }
        }

        if (validMove) {
            queueMove(dragData.fromPoint, -2, validMove.dice);
        } else {
            const fromName = dragData.fromPoint === -1 ? 'bar' : `point ${dragData.fromPoint + 1}`;
            setInvalidDropFeedback(`Cannot bear off from ${fromName} - invalid move`);
        }

        setDraggedPiece(null);
        setSelectedPoint(null);
        setDragOverPoint(null);
        setDraggingPointIndex(null);
        setDraggingCheckerIndex(null);
    };

    // In handleBearOff, use displayState
    const handleBearOff = () => {
        // Prevent any moves if all dice are used
        if (!displayState.dice || displayState.usedDice.every(u => u)) return;
        if (selectedPoint !== null && selectedPoint >= 0) {
            const possibleMove = displayState.possibleMoves.find(move =>
                move.from === selectedPoint && move.to === -2
            );

            if (possibleMove) {
                queueMove(selectedPoint, -2, possibleMove.dice);
            }
        }
    };

    // In getPointHighlight, use displayState
    const getPointHighlight = (pointIndex: number): string => {
        if (selectedPoint === pointIndex) return 'ring-4 ring-blue-400';
        if (dragOverPoint === pointIndex) return 'ring-4 ring-purple-400 bg-purple-100';

        // Only highlight valid drop targets when dragging from the bar
        if (draggedPiece && draggedPiece.fromPoint === -1) {
            // Only highlight if move uses an unused die
            const canMoveTo = displayState.possibleMoves.some(move =>
                move.from === -1 && move.to === pointIndex && !displayState.usedDice[displayState.dice?.indexOf(move.dice) ?? -1]
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
            return '';
        }

        if (selectedPoint !== null || draggedPiece) {
            const fromPoint = draggedPiece ? draggedPiece.fromPoint : selectedPoint;
            // Only highlight if move uses an unused die
            const canMoveTo = displayState.possibleMoves.some(move =>
                move.from === fromPoint && move.to === pointIndex && !displayState.usedDice[displayState.dice?.indexOf(move.dice) ?? -1]
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
        }

        return '';
    };

    // In renderPoint, use displayState and isMyTurn
    const renderPoint = (pointIndex: number, isTopRow: boolean) => {
        const pieces = displayState.board[pointIndex];
        const highlight = getPointHighlight(pointIndex);
        const isCurrentPlayerPiece = (displayState.currentPlayer === 'white' && pieces > 0) ||
            (displayState.currentPlayer === 'black' && pieces < 0);
        const hasValidMoves = displayState.possibleMoves.some(move => move.from === pointIndex);
        // Only allow drag if it's my turn
        const canDrag = Boolean(isMyTurn && isCurrentPlayerPiece && hasValidMoves && displayState.gamePhase === 'playing');
        return (
            <Point
                key={`point-${pointIndex}`}
                pointIndex={pointIndex}
                isTopRow={isTopRow}
                pieces={pieces}
                highlight={highlight}
                isCurrentPlayerPiece={isCurrentPlayerPiece}
                hasValidMoves={hasValidMoves}
                canDrag={canDrag}
                draggingPointIndex={draggingPointIndex}
                draggingCheckerIndex={draggingCheckerIndex}
                handlePointClick={handlePointClick}
                handleDragStart={handleDragStart}
                handleDragEnd={handleDragEnd}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
            />
        );
    };

    // Helper to calculate pip count for a player
    const getPipCount = (player: Player) => {
        let pipSum = 0;
        for (let i = 0; i < 24; i++) {
            const n = displayState.board[i];
            if (player === 'white' && n > 0) pipSum += n * (i + 1);
            if (player === 'black' && n < 0) pipSum += -n * (24 - i);
        }
        // Add bar checkers: white bar = 25, black bar = 25
        if (player === 'white') pipSum += displayState.bar.white * 25;
        if (player === 'black') pipSum += displayState.bar.black * 25;
        // If all checkers are borne off, pip count is 0
        if (
            displayState.home[player] === (player === 'white' ? initialWhiteCheckers : initialBlackCheckers)
        ) {
            return 0;
        }
        return Math.max(0, pipSum);
    };

    // Render the home area for a player
    const renderHome = (player: Player) => {
        const isDraggingOwnChecker = draggedPiece && draggedPiece.player === player;
        const canBearOffNow = canBearOff(displayState.currentPlayer, displayState.board) && displayState.currentPlayer === player;
        const hasValidBearOffMoves = displayState.possibleMoves.some(move => move.to === -2 && (!draggedPiece || move.from === draggedPiece.fromPoint));
        return (
            <Home
                player={player}
                homeCount={gameState.home[player]}
                pipCount={getPipCount(player)}
                canBearOffNow={canBearOffNow}
                isDraggingOwnChecker={!!isDraggingOwnChecker}
                hasValidBearOffMoves={hasValidBearOffMoves}
                dragOverPoint={dragOverPoint}
                handleBearOff={handleBearOff}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleHomeDrop={handleHomeDrop}
            />
        );
    };

    // Track mouse position for drag preview
    useEffect(() => {
        if (!draggedPiece) return;
        const handle = (e: MouseEvent) => setDragMouse({ x: e.clientX, y: e.clientY });
        window.addEventListener('dragover', handle);
        return () => window.removeEventListener('dragover', handle);
    }, [draggedPiece]);

    // 1. Define handleDragOver
    const handleDragOver = (e: React.DragEvent, pointIndex?: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (pointIndex !== undefined) {
            setDragOverPoint(pointIndex);
        }
    };
    // 2. Define handleDragLeave
    const handleDragLeave = (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverPoint(null);
        }
    };
    // 3. Define handleDragEnd
    const handleDragEnd = () => {
        setDraggedPiece(null);
        setSelectedPoint(null);
        setDragOverPoint(null);
        setDraggingPointIndex(null);
        setDraggingCheckerIndex(null);
    };

    // In handlePointClick, add strict dice check at the top
    const handlePointClick = (pointIndex: number) => {
        // Prevent any moves if all dice are used
        if (!displayState.dice || displayState.usedDice.every(u => u)) return;

        // Only consider moves using unused dice
        const unusedDice = displayState.dice.filter((_, idx) => !displayState.usedDice[idx]);
        let possibleMoves = displayState.possibleMoves.filter(move =>
            move.from === pointIndex && unusedDice.includes(move.dice)
        );
        // Deduplicate possibleMoves by from, to, dice
        possibleMoves = possibleMoves.filter((move, idx, arr) =>
            arr.findIndex(m => m.from === move.from && m.to === move.to && m.dice === move.dice) === idx
        );
        if (possibleMoves.length === 1) {
            const move = possibleMoves[0];
            // For doubles, ensure we use the first unused die of the correct value
            if (displayState.dice && displayState.dice.filter((d, i) => !displayState.usedDice[i] && d === move.dice).length > 0) {
                // Find the first unused die index of this value
                const dieIdx = displayState.dice.findIndex((d, i) => !displayState.usedDice[i] && d === move.dice);
                if (dieIdx !== -1) {
                    // Mark only that die as used in makeMove
                    queueMove(move.from, move.to, displayState.dice[dieIdx]);
                    setSelectedPoint(null);
                    return;
                }
            }
            // Fallback (shouldn't happen):
            queueMove(move.from, move.to, move.dice);
            setSelectedPoint(null);
            return;
        }

        // If a checker is already selected and user clicks a valid destination, perform the move
        if (selectedPoint !== null && selectedPoint !== pointIndex) {
            const possibleMovesFromSelected = displayState.possibleMoves.filter(move =>
                move.from === selectedPoint && move.to === pointIndex && unusedDice.includes(move.dice)
            );
            if (possibleMovesFromSelected.length > 0) {
                let move = possibleMovesFromSelected[0];
                if (possibleMovesFromSelected.length > 1) {
                    const bearOffMove = possibleMovesFromSelected.find(m => m.to === -2);
                    if (bearOffMove) move = bearOffMove;
                }
                if (displayState.dice && displayState.dice.filter((d, i) => !displayState.usedDice[i] && d === move.dice).length > 0) {
                    const dieIdx = displayState.dice.findIndex((d, i) => !displayState.usedDice[i] && d === move.dice);
                    if (dieIdx !== -1) {
                        queueMove(move.from, move.to, displayState.dice[dieIdx]);
                        setSelectedPoint(null);
                        return;
                    }
                }
                queueMove(move.from, move.to, move.dice);
                setSelectedPoint(null);
                return;
            }
        }

        // Deselect if already selected and no auto-move
        if (selectedPoint === pointIndex) {
            setSelectedPoint(null);
            return;
        }

        // Prefer bear-off move if available (for multiple moves)
        if (possibleMoves.length > 1) {
            const bearOffMove = possibleMoves.find(move => move.to === -2);
            if (bearOffMove) {
                if (displayState.dice && displayState.dice.filter((d, i) => !displayState.usedDice[i] && d === bearOffMove.dice).length > 0) {
                    const dieIdx = displayState.dice.findIndex((d, i) => !displayState.usedDice[i] && d === bearOffMove.dice);
                    if (dieIdx !== -1) {
                        queueMove(bearOffMove.from, bearOffMove.to, displayState.dice[dieIdx]);
                        setSelectedPoint(null);
                        return;
                    }
                }
                queueMove(bearOffMove.from, bearOffMove.to, bearOffMove.dice);
                setSelectedPoint(null);
                return;
            }
        }

        setSelectedPoint(pointIndex);
        setInvalidDropFeedback(null);
    };

    return (
        <div className="flex flex-col items-center p-8 bg-amber-100 min-h-screen">
            {/* New Game button at the top */}
            <div className="w-full flex justify-end mb-4">
                <button
                    onClick={resetGameSocket}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow"
                >
                    New Game
                </button>
            </div>

            {/* Connection indicator */}
            <div className="flex items-center mb-2">
                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-xs font-semibold text-gray-700 mr-4">{connected ? 'Connected' : 'Disconnected'}</span>
                {/* Player indicator: show only the local player's color if assigned */}
                {playerColor === 'white' && (
                    <span className="inline-block w-4 h-4 rounded-full bg-white border border-gray-400 mr-3 align-middle" title="You are White"></span>
                )}
                {playerColor === 'black' && (
                    <span className="inline-block w-4 h-4 rounded-full bg-black border border-gray-400 mr-3 align-middle" title="You are Black"></span>
                )}
                {(!playerColor || (playerColor !== 'white' && playerColor !== 'black')) && (
                    <span className="inline-block w-4 h-4 rounded-full bg-gray-300 border border-gray-400 mr-3 align-middle" title="Spectator or unknown"></span>
                )}
                {/* Turn and dice info */}
                <span className="text-xs font-semibold text-gray-700">
                    Turn: {effectiveState.currentPlayer} | Dice: {effectiveState.dice ? effectiveState.dice.join(', ') : '–'}
                </span>
            </div>

            <h1 className="text-3xl font-bold mb-8 text-amber-900">Backgammon</h1>

            {/* Controls always rendered, but disabled/hidden if winner */}
            <Controls
                onUndo={handleUndo}
                onConfirm={handleConfirmMoves}
                onNewGame={handleNewGame}
                canUndo={pendingMoves.length > 0}
                canConfirm={canConfirm}
                showNewGame={!!winner}
            />

            {/* Timers row */}
            <div className="w-full flex flex-row justify-between items-center mb-2 px-2">
                <TimerDisplay player="black" />
                <div className="flex-1" />
                <TimerDisplay player="white" />
            </div>

            {/* Consistent height container for winner and board */}
            <div className="w-full flex flex-col items-center justify-center h-[700px] overflow-hidden relative">
                {winner ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center w-full h-full bg-amber-100 z-30">
                        <div className="text-6xl font-bold text-amber-900 mb-8">🎉</div>
                        <div className="text-3xl font-bold text-amber-900 mb-4">{winner} wins!</div>
                        <button
                            onClick={handleNewGame}
                            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xl"
                        >
                            New Game
                        </button>
                    </div>
                ) : (
                    <>
                    {/* Drag Preview Checker */}
                    {draggedPiece && dragMouse && (
                        <div
                            style={{
                                position: 'fixed',
                                pointerEvents: 'none',
                                left: dragMouse.x - 16, // Center 32x32 checker
                                top: dragMouse.y - 16,
                                zIndex: 10000,
                                width: 32,
                                height: 32,
                            }}
                        >
                            <div
                                className={`w-8 h-8 rounded-full border-2 ${draggedPiece.player === 'white' ? 'bg-white border-gray-800' : 'bg-gray-800 border-white'}`}
                                style={{ width: 32, height: 32 }}
                            />
                        </div>
                    )}

                    {/* Game Info */}
                    <div className="mb-4 text-center h-6 flex items-center justify-center">
                        {/* Current Player header removed */}
                        {/* Dice removed from here */}
                        {effectiveState.dice && effectiveState.possibleMoves.length === 0 && effectiveState.usedDice.some(u => !u) ? (
                            <div className="text-red-600 font-bold">No moves available!</div>
                        ) : null}
                    </div>

                    {/* Black Bar (top, above board) */}
                    <div className="flex w-full justify-center mb-2">
                        <div className="w-[384px] flex justify-end">
                            {/* left padding for alignment */}
                        </div>
                        {/* Bar checkers are rendered only by the <Bar /> component below */}
                        <div className="w-[128px]" /> {/* right padding for alignment */}
                    </div>

                    {/* Board */}
                    <div className="border-4 border-amber-900 bg-amber-200 p-4 shadow-2xl relative overflow-hidden">
                        {/* Dice overlay on board, centered vertically and horizontally on player's half */}
                        {diceToShow && (
                            <div
                                className={`absolute top-1/2 z-20 pointer-events-none transition-all duration-200 ` +
                                    (effectiveState.currentPlayer === 'black'
                                        ? 'left-[25%] -translate-x-1/2 -translate-y-1/2'
                                        : 'left-[75%] -translate-x-1/2 -translate-y-1/2')
                                }
                                style={{ width: 80 }}
                            >
                                <div style={{ transform: 'scale(0.7)', width: '100%' }}>
                                    <Dice dice={diceToShow} usedDice={usedDiceToShow} disabled={!isMyTurn} />
                                </div>
                            </div>
                        )}

                        {/* Top Labels (Points 13-24) */}
                        <div className="flex gap-1 mb-1 items-end">
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={`label-top-${12 + i}`} className="w-12 text-center text-black font-bold text-xs">{13 + i}</div>
                            ))}
                            <div className="w-4 mx-1" /> {/* Bar placeholder */}
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={`label-top-${18 + i}`} className="w-12 text-center text-black font-bold text-xs">{19 + i}</div>
                            ))}
                            <div className="w-16" /> {/* Home placeholder */}
                        </div>

                        {/* Top Row (Points 13-24) */}
                        <div className="flex gap-1 mb-2 items-end">
                            {Array.from({ length: 6 }, (_, i) => renderPoint(12 + i, true))}
                            <Bar
                                bar={effectiveState.bar}
                                currentPlayer={isMyTurn ? effectiveState.currentPlayer : (effectiveState.currentPlayer === 'white' ? 'black' : 'white')}
                                possibleMoves={effectiveState.possibleMoves}
                                gamePhase={effectiveState.gamePhase}
                                handleBarDragStart={handleBarDragStart}
                                handleDragEnd={handleDragEnd}
                                side="top"
                            />
                            {Array.from({ length: 6 }, (_, i) => renderPoint(18 + i, true))}
                            {renderHome('black')}
                        </div>

                        {/* Bottom Row (Points 12-1) */}
                        <div className="flex gap-1 items-start">
                            {Array.from({ length: 6 }, (_, i) => renderPoint(11 - i, false))}
                            <Bar
                                bar={effectiveState.bar}
                                currentPlayer={isMyTurn ? effectiveState.currentPlayer : (effectiveState.currentPlayer === 'white' ? 'black' : 'white')}
                                possibleMoves={effectiveState.possibleMoves}
                                gamePhase={effectiveState.gamePhase}
                                handleBarDragStart={handleBarDragStart}
                                handleDragEnd={handleDragEnd}
                                side="bottom"
                            />
                            {Array.from({ length: 6 }, (_, i) => renderPoint(5 - i, false))}
                            {renderHome('white')}
                        </div>

                        {/* Bottom Labels (Points 12-1) */}
                        <div className="flex gap-1 mt-1 items-start">
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={`label-bot-${11 - i}`} className="w-12 text-center text-black font-bold text-xs">{12 - i}</div>
                            ))}
                            <div className="w-4 mx-1" /> {/* Bar placeholder */}
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={`label-bot-${5 - i}`} className="w-12 text-center text-black font-bold text-xs">{6 - i}</div>
                            ))}
                            <div className="w-16" /> {/* Home placeholder */}
                        </div>
                    </div>

                    {/* White Bar (bottom, below board) */}
                    <div className="flex w-full justify-center mt-2">
                        <div className="w-[384px] flex justify-end">
                            {/* left padding for alignment */}
                        </div>
                        {/* Bar checkers are rendered only by the <Bar /> component above */}
                        <div className="w-[128px]" /> {/* right padding for alignment */}
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BackgammonBoard;