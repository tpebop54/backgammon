'use client'

import React, { useState, useEffect, useCallback } from 'react';
import Point from './Point';
import Bar from './Bar';
import Home from './Home';
import Dice from './Dice';
import Controls from './Controls';

// Game state type definitions
type Player = 'white' | 'black';
type GameState = {
    board: number[]; // 24 points, positive = white pieces, negative = black pieces
    bar: { white: number; black: number }; // pieces on the bar
    home: { white: number; black: number }; // pieces borne off
    currentPlayer: Player; // current player turn
    dice: number[] | null; // current rolled dice, null if not rolled
    usedDice: boolean[]; // track which dice have been used
    gamePhase: 'setup' | 'playing' | 'finished';
    possibleMoves: Array<{ from: number; to: number; dice: number }>;
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

const freshBoard = defaultBoard;

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
    // Add pending state for moves
    const [pendingGameState, setPendingGameState] = useState<GameState | null>(null);
    const [turnStartState, setTurnStartState] = useState<GameState | null>(null);
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

    // On dice roll, set up pending state and turn start state
    const rollDice = () => {
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const diceArray = dice1 === dice2 ? [dice1, dice1, dice1, dice1] : [dice1, dice2];
        setGameState(prev => {
            const newState: GameState = {
                ...prev,
                dice: diceArray,
                usedDice: new Array(diceArray.length).fill(false),
                gamePhase: 'playing',
                // Remove possibleMoves: [] here to let useEffect handle it
            };
            setPendingGameState(newState);
            setTurnStartState(newState);
            return newState;
        });
    };

    // Use pendingGameState for all move logic if it exists
    const effectiveState = pendingGameState || gameState;

    // Update isValidMove to use effectiveState
    const isValidMove = (from: number, to: number, dice: number): boolean => {
        return effectiveState.possibleMoves.some(move =>
            move.from === from && move.to === to && move.dice === dice
        );
    };

    // Add a helper to reset the game and initial checker counts
    const resetGame = (newInitialState: GameState) => {
        setGameState(newInitialState);
        setPendingGameState(null);
        setTurnStartState(null);
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
        resetGame({
            board: [...freshBoard],
            bar: { white: 0, black: 0 },
            home: { white: 0, black: 0 },
            currentPlayer: 'white',
            dice: null,
            usedDice: [false, false],
            gamePhase: 'setup',
            possibleMoves: []
        });
    };

    // --- End handler and helper function declarations ---

    // Automatically roll dice at the start of each turn
    useEffect(() => {
        const state = pendingGameState || gameState;
        if (state.gamePhase === 'setup' && !state.dice && !winner) {
            rollDice();
        }
        // eslint-disable-next-line
    }, [gameState.currentPlayer, gameState.gamePhase, winner]);

    // Calculate possible moves on game state change
    useEffect(() => {
        const state = pendingGameState || gameState;
        const newMoves = calculatePossibleMoves(state);
        if (JSON.stringify(state.possibleMoves) !== JSON.stringify(newMoves)) {
            if (pendingGameState) {
                setPendingGameState(prev => prev ? { ...prev, possibleMoves: newMoves } : null);
            } else {
                setGameState(prev => ({ ...prev, possibleMoves: newMoves }));
            }
        }
        // Do not update state in a way that triggers this effect again unless necessary
    }, [pendingGameState, gameState, calculatePossibleMoves]);

    // Handler for making a move
    const makeMove = (from: number, to: number, dice: number, checkerIndex: number | null = null) => {
        const state = pendingGameState || gameState;
        const newBoard = [...state.board];
        const player = state.currentPlayer;
        const direction = player === 'white' ? 1 : -1;
        const opponent = player === 'white' ? 'black' : 'white';
        // Always use the same newBar and newHome objects
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
                // Move opponent checker to bar
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
        // Check for win immediately after bearing off
        const totalWhite = newHome.white;
        const totalBlack = newHome.black;
        const whiteOnBoard = newBoard.reduce((sum, n) => sum + (n > 0 ? n : 0), 0) + newBar.white;
        const blackOnBoard = newBoard.reduce((sum, n) => sum + (n < 0 ? -n : 0), 0) + newBar.black;
        if (totalWhite === initialWhiteCheckers && whiteOnBoard === 0) {
            setWinner('WHITE');
            setGameState({
                ...state,
                board: newBoard,
                bar: newBar,
                home: newHome,
                usedDice: newUsedDice,
                gamePhase: 'finished',
            });
            setPendingGameState(null);
            setTurnStartState(null);
            return;
        }
        if (totalBlack === initialBlackCheckers && blackOnBoard === 0) {
            setWinner('BLACK');
            setGameState({
                ...state,
                board: newBoard,
                bar: newBar,
                home: newHome,
                usedDice: newUsedDice,
                gamePhase: 'finished',
            });
            setPendingGameState(null);
            setTurnStartState(null);
            return;
        }
        const newState: GameState = {
            ...state,
            board: newBoard,
            bar: newBar,
            home: newHome,
            usedDice: newUsedDice,
            possibleMoves: calculatePossibleMoves({
                ...state,
                board: newBoard,
                bar: newBar,
                home: newHome,
                usedDice: newUsedDice,
            })
        };
        setPendingGameState(newState);
    };

    // Undo handler
    const handleUndo = () => {
        if (!turnStartState) return;
        setPendingGameState(turnStartState);
        setTurnStartState(turnStartState);
    };

    // Confirm moves handler
    const handleConfirmMoves = () => {
        if (!pendingGameState) return;
        // Switch player and reset dice/usedDice
        const nextPlayer = pendingGameState.currentPlayer === 'white' ? 'black' : 'white';
        // Calculate home and on-board for both players
        const totalWhite = pendingGameState.home.white;
        const totalBlack = pendingGameState.home.black;
        const whiteOnBoard = pendingGameState.board.reduce((sum, n) => sum + (n > 0 ? n : 0), 0) + pendingGameState.bar.white;
        const blackOnBoard = pendingGameState.board.reduce((sum, n) => sum + (n < 0 ? -n : 0), 0) + pendingGameState.bar.black;
        if (totalWhite === initialWhiteCheckers && whiteOnBoard === 0) {
            setWinner('WHITE');
            setGameState({
                ...pendingGameState,
                gamePhase: 'finished',
            });
            setPendingGameState(null);
            setTurnStartState(null);
            return;
        }
        if (totalBlack === initialBlackCheckers && blackOnBoard === 0) {
            setWinner('BLACK');
            setGameState({
                ...pendingGameState,
                gamePhase: 'finished',
            });
            setPendingGameState(null);
            setTurnStartState(null);
            return;
        }
        setGameState({
            ...pendingGameState,
            currentPlayer: nextPlayer,
            dice: null,
            usedDice: [false, false],
            gamePhase: 'setup',
            possibleMoves: []
        });
        setPendingGameState(null);
        setTurnStartState(null);
    };

    // In handleDragStart, use effectiveState
    const handleDragStart = (e: React.DragEvent, pointIndex: number, checkerIndex: number) => {
        const piece = effectiveState.board[pointIndex];
        const player = piece > 0 ? 'white' : 'black';
        const absCount = Math.abs(piece);

        if (player !== effectiveState.currentPlayer) {
            e.preventDefault();
            return;
        }

        const hasValidMoves = effectiveState.possibleMoves.some(move => move.from === pointIndex);
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

    // In handleBarDragStart, use effectiveState
    const handleBarDragStart = (e: React.DragEvent, player: Player) => {
        if (player !== effectiveState.currentPlayer || effectiveState.bar[player] === 0) {
            e.preventDefault();
            return;
        }

        const hasValidMoves = effectiveState.possibleMoves.some(move => move.from === -1);
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

    // In handleDrop, use effectiveState
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
        if (!effectiveState.dice || effectiveState.usedDice.every(u => u)) return;
        // Find available dice values for this move
        const availableDice = effectiveState.dice?.filter((_, index) => !effectiveState.usedDice[index]) || [];

        // Try each available dice value to see if the move is valid
        let validMove = null;
        for (const dice of availableDice) {
            const possibleMove = effectiveState.possibleMoves.find(move =>
                move.from === dragData.fromPoint && move.to === toPoint && move.dice === dice
            );
            if (possibleMove) {
                validMove = possibleMove;
                break;
            }
        }

        if (validMove) {
            makeMove(dragData.fromPoint, toPoint, validMove.dice, dragData.checkerIndex);
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

    // In handleHomeDrop, use effectiveState
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
        if (!effectiveState.dice || effectiveState.usedDice.every(u => u)) return;
        // Find available dice values for bearing off
        const availableDice = effectiveState.dice?.filter((_, index) => !effectiveState.usedDice[index]) || [];

        let validMove = null;
        for (const dice of availableDice) {
            const possibleMove = effectiveState.possibleMoves.find(move =>
                move.from === dragData.fromPoint && move.to === -2 && move.dice === dice
            );
            if (possibleMove) {
                validMove = possibleMove;
                break;
            }
        }

        if (validMove) {
            makeMove(dragData.fromPoint, -2, validMove.dice);
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

    // In handleBearOff, use effectiveState
    const handleBearOff = () => {
        // Prevent any moves if all dice are used
        if (!effectiveState.dice || effectiveState.usedDice.every(u => u)) return;
        if (selectedPoint !== null && selectedPoint >= 0) {
            const possibleMove = effectiveState.possibleMoves.find(move =>
                move.from === selectedPoint && move.to === -2
            );

            if (possibleMove) {
                makeMove(selectedPoint, -2, possibleMove.dice);
            }
        }
    };

    // In getPointHighlight, use effectiveState
    const getPointHighlight = (pointIndex: number): string => {
        if (selectedPoint === pointIndex) return 'ring-4 ring-blue-400';
        if (dragOverPoint === pointIndex) return 'ring-4 ring-purple-400 bg-purple-100';

        // Only highlight valid drop targets when dragging from the bar
        if (draggedPiece && draggedPiece.fromPoint === -1) {
            // Only highlight if move uses an unused die
            const canMoveTo = effectiveState.possibleMoves.some(move =>
                move.from === -1 && move.to === pointIndex && !effectiveState.usedDice[effectiveState.dice?.indexOf(move.dice) ?? -1]
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
            return '';
        }

        if (selectedPoint !== null || draggedPiece) {
            const fromPoint = draggedPiece ? draggedPiece.fromPoint : selectedPoint;
            // Only highlight if move uses an unused die
            const canMoveTo = effectiveState.possibleMoves.some(move =>
                move.from === fromPoint && move.to === pointIndex && !effectiveState.usedDice[effectiveState.dice?.indexOf(move.dice) ?? -1]
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
        }

        return '';
    };

    // In renderPoint, use effectiveState
    const renderPoint = (pointIndex: number, isTopRow: boolean) => {
        const pieces = effectiveState.board[pointIndex];
        const highlight = getPointHighlight(pointIndex);
        const isCurrentPlayerPiece = (effectiveState.currentPlayer === 'white' && pieces > 0) ||
            (effectiveState.currentPlayer === 'black' && pieces < 0);
        const hasValidMoves = effectiveState.possibleMoves.some(move => move.from === pointIndex);
        const canDrag = isCurrentPlayerPiece && hasValidMoves && effectiveState.gamePhase === 'playing';
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
            const n = effectiveState.board[i];
            if (player === 'white' && n > 0) pipSum += n * (i + 1);
            if (player === 'black' && n < 0) pipSum += -n * (24 - i);
        }
        // Add bar checkers: white bar = 25, black bar = 25
        if (player === 'white') pipSum += effectiveState.bar.white * 25;
        if (player === 'black') pipSum += effectiveState.bar.black * 25;
        return pipSum;
    };

    // Render the home area for a player
    const renderHome = (player: Player) => {
        const isDraggingOwnChecker = draggedPiece && draggedPiece.player === player;
        const canBearOffNow = canBearOff(effectiveState.currentPlayer, effectiveState.board) && effectiveState.currentPlayer === player;
        const hasValidBearOffMoves = effectiveState.possibleMoves.some(move => move.to === -2 && (!draggedPiece || move.from === draggedPiece.fromPoint));
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
        if (!effectiveState.dice || effectiveState.usedDice.every(u => u)) return;

        // Only consider moves using unused dice
        const unusedDice = effectiveState.dice.filter((_, idx) => !effectiveState.usedDice[idx]);
        let possibleMoves = effectiveState.possibleMoves.filter(move =>
            move.from === pointIndex && unusedDice.includes(move.dice)
        );
        // Deduplicate possibleMoves by from, to, dice
        possibleMoves = possibleMoves.filter((move, idx, arr) =>
            arr.findIndex(m => m.from === move.from && m.to === move.to && m.dice === move.dice) === idx
        );
        if (possibleMoves.length === 1) {
            const move = possibleMoves[0];
            // For doubles, ensure we use the first unused die of the correct value
            if (effectiveState.dice && effectiveState.dice.filter((d, i) => !effectiveState.usedDice[i] && d === move.dice).length > 0) {
                // Find the first unused die index of this value
                const dieIdx = effectiveState.dice.findIndex((d, i) => !effectiveState.usedDice[i] && d === move.dice);
                if (dieIdx !== -1) {
                    // Mark only that die as used in makeMove
                    makeMove(move.from, move.to, effectiveState.dice[dieIdx]);
                    setSelectedPoint(null);
                    return;
                }
            }
            // Fallback (shouldn't happen):
            makeMove(move.from, move.to, move.dice);
            setSelectedPoint(null);
            return;
        }

        // If a checker is already selected and user clicks a valid destination, perform the move
        if (selectedPoint !== null && selectedPoint !== pointIndex) {
            const possibleMovesFromSelected = effectiveState.possibleMoves.filter(move =>
                move.from === selectedPoint && move.to === pointIndex && unusedDice.includes(move.dice)
            );
            if (possibleMovesFromSelected.length > 0) {
                let move = possibleMovesFromSelected[0];
                if (possibleMovesFromSelected.length > 1) {
                    const bearOffMove = possibleMovesFromSelected.find(m => m.to === -2);
                    if (bearOffMove) move = bearOffMove;
                }
                if (effectiveState.dice && effectiveState.dice.filter((d, i) => !effectiveState.usedDice[i] && d === move.dice).length > 0) {
                    const dieIdx = effectiveState.dice.findIndex((d, i) => !effectiveState.usedDice[i] && d === move.dice);
                    if (dieIdx !== -1) {
                        makeMove(move.from, move.to, effectiveState.dice[dieIdx]);
                        setSelectedPoint(null);
                        return;
                    }
                }
                makeMove(move.from, move.to, move.dice);
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
                if (effectiveState.dice && effectiveState.dice.filter((d, i) => !effectiveState.usedDice[i] && d === bearOffMove.dice).length > 0) {
                    const dieIdx = effectiveState.dice.findIndex((d, i) => !effectiveState.usedDice[i] && d === bearOffMove.dice);
                    if (dieIdx !== -1) {
                        makeMove(bearOffMove.from, bearOffMove.to, effectiveState.dice[dieIdx]);
                        setSelectedPoint(null);
                        return;
                    }
                }
                makeMove(bearOffMove.from, bearOffMove.to, bearOffMove.dice);
                setSelectedPoint(null);
                return;
            }
        }

        setSelectedPoint(pointIndex);
        setInvalidDropFeedback(null);
    };

    return (
        <div className="flex flex-col items-center p-8 bg-amber-100 min-h-screen">
            {winner ? (
                <div className="flex flex-col items-center justify-center min-h-screen bg-amber-100">
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

                <h1 className="text-3xl font-bold mb-8 text-amber-900">Backgammon</h1>

                {/* Game Info */}
                <div className="mb-4 text-center">
                    <div className="text-xl font-bold text-amber-800 mb-2">
                        Current Player: <span className="text-2xl">{gameState.currentPlayer.toUpperCase()}</span>
                    </div>
                    <Dice dice={effectiveState.dice} usedDice={effectiveState.usedDice} />
                    {effectiveState.dice && effectiveState.possibleMoves.length === 0 && effectiveState.usedDice.some(u => !u) && (
                        <div className="text-red-600 font-bold mt-2">No moves available!</div>
                    )}
                </div>

                {/* Controls */}
                <Controls
                    onUndo={handleUndo}
                    onConfirm={handleConfirmMoves}
                    onRollDice={rollDice}
                    onNewGame={handleNewGame}
                    canUndo={!!pendingGameState && JSON.stringify(effectiveState) !== JSON.stringify(turnStartState)}
                    canConfirm={!!(pendingGameState && JSON.stringify(effectiveState) !== JSON.stringify(turnStartState) && effectiveState.usedDice.every(u => u))}
                    canRoll={!effectiveState.dice}
                    showNewGame={!!winner}
                />

                {/* Black Bar (top, above board) */}
                <div className="flex w-full justify-center mb-2">
                    <div className="w-[384px] flex justify-end">
                        {/* left padding for alignment */}
                    </div>
                    {gameState.bar.black > 0 && (
                        <div className="flex gap-1">
                            {Array.from({ length: gameState.bar.black }, (_, i) => (
                                <div
                                    key={`bar-black-${i}`}
                                    draggable={gameState.currentPlayer === 'black' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing'}
                                    onDragStart={e => gameState.currentPlayer === 'black' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? handleBarDragStart(e, 'black') : e.preventDefault()}
                                    onDragEnd={handleDragEnd}
                                    className={`w-8 h-8 rounded-full border-2 bg-gray-800 border-white select-none transition-transform ${gameState.currentPlayer === 'black' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? 'cursor-move hover:scale-110' : ''}`}
                                    style={{ userSelect: 'none', margin: '2px 0' }}
                                />
                            ))}
                        </div>
                    )}
                    <div className="w-[128px]" /> {/* right padding for alignment */}
                </div>

                {/* Board */}
                <div className="border-4 border-amber-900 bg-amber-200 p-4 shadow-2xl">
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
                            currentPlayer={effectiveState.currentPlayer}
                            possibleMoves={effectiveState.possibleMoves}
                            gamePhase={effectiveState.gamePhase}
                            handleBarDragStart={handleBarDragStart}
                            handleDragEnd={handleDragEnd}
                        />
                        {Array.from({ length: 6 }, (_, i) => renderPoint(18 + i, true))}
                        {renderHome('black')}
                    </div>

                    {/* Bottom Row (Points 12-1) */}
                    <div className="flex gap-1 items-start">
                        {Array.from({ length: 6 }, (_, i) => renderPoint(11 - i, false))}
                        <Bar
                            bar={effectiveState.bar}
                            currentPlayer={effectiveState.currentPlayer}
                            possibleMoves={effectiveState.possibleMoves}
                            gamePhase={effectiveState.gamePhase}
                            handleBarDragStart={handleBarDragStart}
                            handleDragEnd={handleDragEnd}
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
                    {gameState.bar.white > 0 && (
                        <div className="flex gap-1">
                            {Array.from({ length: gameState.bar.white }, (_, i) => (
                                <div
                                    key={`bar-white-${i}`}
                                    draggable={gameState.currentPlayer === 'white' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing'}
                                    onDragStart={e => gameState.currentPlayer === 'white' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? handleBarDragStart(e, 'white') : e.preventDefault()}
                                    onDragEnd={handleDragEnd}
                                    className={`w-4 h-4 rounded-full border-2 bg-white border-gray-800 select-none transition-transform ${gameState.currentPlayer === 'white' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? 'cursor-move hover:scale-110' : ''}`}
                                    style={{ userSelect: 'none', margin: '2px 0' }}
                                />
                            ))}
                        </div>
                    )}
                    <div className="w-[128px]" /> {/* right padding for alignment */}
                </div>
                </>
            )}
        </div>
    );
};

export default BackgammonBoard;