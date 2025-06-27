'use client'

import React, { useState, useEffect, useCallback } from 'react';

interface DebugEvent {
    [key: string]: any;
}

// Add onContextMenu={onDebug} to make an element right clickable to open the debugger
const onDebug = (evt: DebugEvent): void => {
    console.log(evt);
    debugger;
};

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
    1, 1, 0, 0, 0, 1,  // 1-6
    0, 0, 0, 0, 0, 0,     // 7-12
    0, 0, 0, 0, 0, 0,     // 13-18
    -1, 0, -1, 0, 0, -1,     // 19-24
];

//Setup for an actual backgammon game.
const defaultBoard = [
    -2, 0, 0, 0, 0, 5,    // 1-6: 2 black on 1, 5 white on 6
    0, 3, 0, 0, 0, -5,    // 7-12: 3 white on 8, 5 black on 12
    5, 0, 0, 0, -3, 0,    // 13-18: 5 white on 13
    -5, 0, 0, 0, 0, 2,    // 19-24: 3 black on 17, 5 black on 19, 2 white on 24
];

// Initial checker locations
const initialGameState: GameState = {
    board: devBoard,
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

    // Handler and helper function declarations must come before their usage
    // Move all handler and helper function declarations above any usage in render or other handlers

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
        // Use all dice, not just unused, to generate all possible moves
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
                    if (canBearOffNow && ((state.currentPlayer === 'white' && to < 0) ||
                        (state.currentPlayer === 'black' && to >= 24))) {
                        let higherPointExists = false;
                        if (state.currentPlayer === 'white') {
                            for (let i = from + 1; i <= 5; i++) {
                                if (state.board[i] > 0) {
                                    higherPointExists = true;
                                    break;
                                }
                            }
                            const exact = (from + 1) === dice;
                            // Only allow bearing off with higher die if no checkers on higher points
                            if (exact || (!higherPointExists && dice > (from + 1))) {
                                moves.push({ from, to: -2, dice });
                            }
                        } else {
                            // For black, home is 18-23. Check for checkers on higher points (lower indices in 18-23)
                            for (let i = from - 1; i >= 18; i--) {
                                if (state.board[i] < 0) {
                                    higherPointExists = true;
                                    break;
                                }
                            }
                            const exact = (24 - from) === dice;
                            if (exact || (!higherPointExists && dice > (24 - from))) {
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

    // --- End handler and helper function declarations ---

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

        // Move checker on the board
        if (from !== -1) {
            newBoard[from] -= player === 'white' ? 1 : -1;
        }
        if (to !== -2) {
            newBoard[to] += player === 'white' ? 1 : -1;
        }

        // Update bar and home
        const newBar = { ...state.bar };
        const newHome = { ...state.home };
        if (from === -1) {
            newBar[player] -= 1;
        } else if (to === -2) {
            newHome[player] += 1;
        }

        // Update used dice
        const diceIndex = state.dice!.indexOf(dice);
        const newUsedDice = [...state.usedDice];
        newUsedDice[diceIndex] = true;

        // Do not switch player here; only after all dice are used and moves are confirmed
        // Instead, keep currentPlayer the same
        const newState: GameState = {
            ...state,
            board: newBoard,
            bar: newBar,
            home: newHome,
            usedDice: newUsedDice,
            // currentPlayer stays the same
            possibleMoves: calculatePossibleMoves({
                ...state,
                board: newBoard,
                bar: newBar,
                home: newHome,
                usedDice: newUsedDice,
                // currentPlayer stays the same
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

    // In handlePointClick, use effectiveState
    const handlePointClick = (pointIndex: number) => {
        if (effectiveState.gamePhase !== 'playing' || !effectiveState.dice) return;

        const pieces = effectiveState.board[pointIndex];
        const isCurrentPlayerPiece = (effectiveState.currentPlayer === 'white' && pieces > 0) ||
            (effectiveState.currentPlayer === 'black' && pieces < 0);

        // If clicking on current player's piece, select it
        if (isCurrentPlayerPiece && selectedPoint !== pointIndex) {
            // Check if there is only one possible move for this checker
            const movesForThisChecker = effectiveState.possibleMoves.filter(move => move.from === pointIndex);
            if (movesForThisChecker.length === 1) {
                // Only one move, make it automatically
                const move = movesForThisChecker[0];
                makeMove(move.from, move.to, move.dice);
                return;
            }
            setSelectedPoint(pointIndex);
            return;
        }

        // If we have a selected point, try to make a move
        if (selectedPoint !== null) {
            const possibleMove = effectiveState.possibleMoves.find(move =>
                move.from === selectedPoint && move.to === pointIndex
            );

            if (possibleMove) {
                makeMove(selectedPoint, pointIndex, possibleMove.dice);
            } else {
                setSelectedPoint(null);
            }
        }
    };

    // In handleBarClick, use effectiveState
    const handleBarClick = () => {
        if (effectiveState.bar[effectiveState.currentPlayer] > 0) {
            setSelectedPoint(-1);
        }
    };

    // In handleBearOff, use effectiveState
    const handleBearOff = () => {
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
            const canMoveTo = effectiveState.possibleMoves.some(move =>
                move.from === -1 && move.to === pointIndex
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
            return '';
        }

        if (selectedPoint !== null || draggedPiece) {
            const fromPoint = draggedPiece ? draggedPiece.fromPoint : selectedPoint;
            const canMoveTo = effectiveState.possibleMoves.some(move =>
                move.from === fromPoint && move.to === pointIndex
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
        }

        return '';
    };

    // In renderPoint, use effectiveState
    const renderPoint = (pointIndex: number, isTopRow: boolean) => {
        const pieces = effectiveState.board[pointIndex];
        const absCount = Math.abs(pieces);
        const player = pieces > 0 ? 'white' : 'black';
        const highlight = getPointHighlight(pointIndex);
        const isCurrentPlayerPiece = (effectiveState.currentPlayer === 'white' && pieces > 0) ||
            (effectiveState.currentPlayer === 'black' && pieces < 0);
        const hasValidMoves = effectiveState.possibleMoves.some(move => move.from === pointIndex);
        const canDrag = isCurrentPlayerPiece && hasValidMoves && effectiveState.gamePhase === 'playing';

        // Only render pieces if there are any
        if (absCount === 0) {
            return (
                <div
                    key={`point-${pointIndex}`}
                    className={`w-12 h-40 ${pointIndex % 2 === 0 ? 'bg-amber-600' : 'bg-amber-800'
                        } ${isTopRow ? 'flex flex-col' : 'flex flex-col-reverse'
                        } items-center justify-start p-1 cursor-pointer hover:bg-yellow-400 transition-colors ${highlight}`}
                    onClick={() => handlePointClick(pointIndex)}
                    onDragOver={(e) => handleDragOver(e, pointIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, pointIndex)}
                >
                    {/* Checker area only, no label here */}
                </div>
            );
        }

        // Create piece elements with proper spacing and alignment
        const pieceElements = [];
        const maxVisible = 7; // Show up to 6 checkers + overflow indicator
        const actualVisible = Math.min(absCount, maxVisible);
        const availableHeight = 160; // px
        const checkerSize = 32; // px
        let overlap = 0;
        if (actualVisible > 1) {
            overlap = (checkerSize * actualVisible - availableHeight) / (actualVisible - 1);
            if (overlap < 0) overlap = 0;
        }
        for (let i = 0; i < Math.min(absCount, maxVisible - 1); i++) {
            const isBeingDragged = canDrag && draggingPointIndex === pointIndex && draggingCheckerIndex === i;
            // For top row, stack from top edge; for bottom row, stack from bottom edge
            const pos = i * (checkerSize - overlap);
            pieceElements.push(
                <div
                    key={i}
                    draggable={canDrag}
                    onDragStart={(e) => handleDragStart(e, pointIndex, i)}
                    onDragEnd={handleDragEnd}
                    className={`absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 ${player === 'white'
                        ? 'bg-white border-gray-800'
                        : 'bg-gray-800 border-white'
                        } select-none transition-transform ${canDrag ? 'cursor-move hover:scale-110 z-10' : 'cursor-pointer'}`}
                    style={{
                        userSelect: 'none',
                        height: checkerSize,
                        width: checkerSize,
                        top: isTopRow ? pos : undefined,
                        bottom: !isTopRow ? pos : undefined,
                        visibility: isBeingDragged ? 'hidden' : 'visible',
                    }}
                />
            );
        }
        // Add overflow indicator if more than 6 pieces
        if (absCount > maxVisible - 1) {
            const i = maxVisible - 1;
            const pos = i * (checkerSize - overlap);
            pieceElements.push(
                <div
                    key={`overflow-${pointIndex}`}
                    draggable={canDrag}
                    onDragStart={(e) => handleDragStart(e, pointIndex, i)}
                    onDragEnd={handleDragEnd}
                    className={`absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${player === 'white'
                        ? 'bg-white border-gray-800 text-gray-800'
                        : 'bg-gray-800 border-white text-white'
                        } select-none transition-transform ${canDrag ? 'cursor-move hover:scale-110 z-10' : 'cursor-pointer'}`}
                    style={{
                        userSelect: 'none',
                        height: checkerSize,
                        width: checkerSize,
                        top: isTopRow ? pos : undefined,
                        bottom: !isTopRow ? pos : undefined
                    }}
                >
                    +{absCount - (maxVisible - 1)}
                </div>
            );
        }

        return (
            <div
                key={`point-${pointIndex}`}
                className={`w-12 h-40 ${pointIndex % 2 === 0 ? 'bg-amber-600' : 'bg-amber-800'
                    } ${isTopRow ? 'flex flex-col' : 'flex flex-col-reverse'
                    } items-center justify-start p-1 cursor-pointer hover:bg-yellow-400 transition-colors ${highlight} relative`}
                onClick={() => handlePointClick(pointIndex)}
                onDragOver={(e) => handleDragOver(e, pointIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, pointIndex)}
                style={{ overflow: 'hidden' }}
            >
                <div style={{ position: 'relative', width: checkerSize, height: availableHeight, marginBottom: isTopRow ? 4 : 0, marginTop: !isTopRow ? 4 : 0 }}>
                    {pieceElements}
                </div>
                {/* No label here */}
            </div>
        );
    };

    // Render the home area for a player
    const renderHome = (player: Player) => {
        // Only highlight if dragging a checker of the correct player and a valid bear-off move exists
        const isDraggingOwnChecker = draggedPiece && draggedPiece.player === player;
        const canBearOffNow = canBearOff(effectiveState.currentPlayer, effectiveState.board) && effectiveState.currentPlayer === player;
        const hasValidBearOffMoves = effectiveState.possibleMoves.some(move => move.to === -2 && (!draggedPiece || move.from === draggedPiece.fromPoint));
        const showDropZone = isDraggingOwnChecker && canBearOffNow && hasValidBearOffMoves;
        const isBeingDraggedOver = dragOverPoint === -2 && showDropZone;

        return (
            <div
                className={`w-16 h-40 bg-green-600 flex flex-col items-center justify-center gap-2 transition-colors ${showDropZone ? 'hover:bg-green-500 cursor-pointer ring-2 ring-green-400 bg-green-100' : ''} ${isBeingDraggedOver ? 'ring-4 ring-purple-400 bg-purple-100' : ''}`}
                onClick={showDropZone ? handleBearOff : undefined}
                onDragOver={showDropZone ? (e) => { handleDragOver(e, -2); setDragOverPoint(-2); } : undefined}
                onDragLeave={showDropZone ? (e) => { handleDragLeave(e); setDragOverPoint(null); } : undefined}
                onDrop={showDropZone ? (e) => handleHomeDrop(e, player) : undefined}
            >
                <div className="text-white text-xs font-bold">HOME</div>
                <div className="text-white text-lg font-bold">
                    {gameState.home[player]}
                </div>
                <div className="text-white text-xs">
                    {player.toUpperCase()}
                </div>
            </div>
        );
    };

    // Render a thin bar with checkers in top (black) and bottom (white)
    const renderBar = () => {
        return (
            <div className="w-4 h-40 bg-black flex flex-col justify-between items-center mx-1 relative">
                {/* Black checkers (top) */}
                <div className="flex flex-col items-center absolute top-0 left-0 right-0" style={{ height: '50%' }}>
                    {Array.from({ length: effectiveState.bar.black }, (_, i) => (
                        <div
                            key={`bar-black-inboard-${i}`}
                            draggable={effectiveState.currentPlayer === 'black' && effectiveState.possibleMoves.some(move => move.from === -1) && effectiveState.gamePhase === 'playing'}
                            onDragStart={e => effectiveState.currentPlayer === 'black' && effectiveState.possibleMoves.some(move => move.from === -1) && effectiveState.gamePhase === 'playing' ? handleBarDragStart(e, 'black') : e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`w-4 h-4 rounded-full border-2 bg-gray-800 border-white select-none transition-transform ${effectiveState.currentPlayer === 'black' && effectiveState.possibleMoves.some(move => move.from === -1) && effectiveState.gamePhase === 'playing' ? 'cursor-move hover:scale-110' : ''}`}
                            style={{ userSelect: 'none', margin: '1px 0' }}
                        />
                    ))}
                </div>
                {/* White checkers (bottom) */}
                <div className="flex flex-col items-center absolute bottom-0 left-0 right-0" style={{ height: '50%' }}>
                    {Array.from({ length: effectiveState.bar.white }, (_, i) => (
                        <div
                            key={`bar-white-inboard-${i}`}
                            draggable={effectiveState.currentPlayer === 'white' && effectiveState.possibleMoves.some(move => move.from === -1) && effectiveState.gamePhase === 'playing'}
                            onDragStart={e => effectiveState.currentPlayer === 'white' && effectiveState.possibleMoves.some(move => move.from === -1) && effectiveState.gamePhase === 'playing' ? handleBarDragStart(e, 'white') : e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`w-4 h-4 rounded-full border-2 bg-white border-gray-800 select-none transition-transform ${effectiveState.currentPlayer === 'white' && effectiveState.possibleMoves.some(move => move.from === -1) && effectiveState.gamePhase === 'playing' ? 'cursor-move hover:scale-110' : ''}`}
                            style={{ userSelect: 'none', margin: '1px 0' }}
                        />
                    ))}
                </div>
            </div>
        );
    };

    // Dynamically determine checker count for each player from initialGameState
    const initialWhiteCheckers = initialGameState.board.reduce((sum, n) => sum + (n > 0 ? n : 0), 0) + initialGameState.bar.white + initialGameState.home.white;
    const initialBlackCheckers = initialGameState.board.reduce((sum, n) => sum + (n < 0 ? -n : 0), 0) + initialGameState.bar.black + initialGameState.home.black;
    const totalWhite = gameState.home.white;
    const totalBlack = gameState.home.black;
    const whiteOnBoard = gameState.board.reduce((sum, n) => sum + (n > 0 ? n : 0), 0) + gameState.bar.white;
    const blackOnBoard = gameState.board.reduce((sum, n) => sum + (n < 0 ? -n : 0), 0) + gameState.bar.black;
    let winner: string | null = null;
    if (totalWhite === initialWhiteCheckers && whiteOnBoard === 0) winner = 'WHITE';
    if (totalBlack === initialBlackCheckers && blackOnBoard === 0) winner = 'BLACK';

    // Move all handler and helper function definitions above the return statement and before any JSX usage
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

    // Track mouse position for drag preview
    const [dragMouse, setDragMouse] = useState<{ x: number; y: number } | null>(null);
    useEffect(() => {
        if (!draggedPiece) return;
        const handle = (e: MouseEvent) => setDragMouse({ x: e.clientX, y: e.clientY });
        window.addEventListener('dragover', handle);
        return () => window.removeEventListener('dragover', handle);
    }, [draggedPiece]);

    return (
        <div className="flex flex-col items-center p-8 bg-amber-100 min-h-screen">
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

                {gameState.dice && (
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <div className="flex gap-2">
                            {gameState.dice.map((die, index) => (
                                <div
                                    key={index}
                                    className={`w-12 h-12 border-2 border-gray-800 rounded-lg flex items-center justify-center text-2xl font-bold shadow-lg transition-all ${gameState.usedDice[index] ? 'bg-gray-400 text-gray-600 scale-90' : 'bg-white text-black'
                                        }`}
                                >
                                    {die}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {effectiveState.dice && effectiveState.possibleMoves.length === 0 && effectiveState.usedDice.some(u => !u) && (
                    <div className="text-red-600 font-bold mt-2">No moves available!</div>
                )}
            </div>

            {/* Dice Roll Button */}
            {!effectiveState.dice && (
                <button
                    onClick={rollDice}
                    className="mb-6 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xl font-bold shadow-lg"
                >
                    Roll Dice
                </button>
            )}

            {/* Undo/Confirm Buttons */}
            {effectiveState.dice && (
                <div className="flex gap-4 mb-4">
                    <button
                        onClick={handleUndo}
                        className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-lg font-bold shadow"
                        disabled={!turnStartState || JSON.stringify(effectiveState) === JSON.stringify(turnStartState)}
                    >
                        Undo
                    </button>
                    <button
                        onClick={handleConfirmMoves}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-bold shadow"
                        disabled={!pendingGameState || JSON.stringify(effectiveState) === JSON.stringify(turnStartState)}
                    >
                        Confirm Moves
                    </button>
                </div>
            )}

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
                    {renderBar()}
                    {Array.from({ length: 6 }, (_, i) => renderPoint(18 + i, true))}
                    {renderHome('black')}
                </div>

                {/* Bottom Row (Points 12-1) */}
                <div className="flex gap-1 items-start">
                    {Array.from({ length: 6 }, (_, i) => renderPoint(11 - i, false))}
                    {renderBar()}
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
        </div>
    );
};

export default BackgammonBoard;