'use client'

import React, { useState, useCallback, useEffect } from 'react';

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

    // Helper function to check if a player can bear off
    // TODO: this gets called way too much.
    const canBearOff = (player: Player, board: number[]): boolean => {
        console.log('canBearOff');
        const homeBoard = player === 'white' ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23];

        // Check if all pieces are in home board or already borne off
        for (let i = 0; i < 24; i++) {
            const pieces = board[i];
            const hasPlayerPiece = (player === 'white' && pieces > 0) || (player === 'black' && pieces < 0);

            if (hasPlayerPiece && !homeBoard.includes(i)) {
                return false;
            }
        }

        return true;
    };

    // Calculate all possible moves for the current player
    const calculatePossibleMoves = useCallback((state: GameState): Array<{ from: number; to: number; dice: number }> => {
        const moves: Array<{ from: number; to: number; dice: number }> = [];

        if (!state.dice || state.gamePhase !== 'playing') return moves;

        const availableDice = state.dice.filter((_, index) => !state.usedDice[index]);
        const direction = state.currentPlayer === 'white' ? -1 : 1;
        const canBearOffNow = canBearOff(state.currentPlayer, state.board);

        // Check if player has pieces on the bar that must be moved first
        const hasBarPieces = state.bar[state.currentPlayer] > 0;

        if (hasBarPieces) {
            // Must move from bar first
            availableDice.forEach(dice => {
                let targetPoint: number;
                if (state.currentPlayer === 'white') {
                    targetPoint = 24 - dice; // white enters on 24,23,22,21,20,19 (indices 23..18)
                } else {
                    targetPoint = dice - 1; // black enters on 1,2,3,4,5,6 (indices 0..5)
                }
                if (targetPoint >= 0 && targetPoint < 24) {
                    const targetPieces = state.board[targetPoint];
                    const isBlocked = (state.currentPlayer === 'white' && targetPieces < -1) ||
                        (state.currentPlayer === 'black' && targetPieces > 1);
                    if (!isBlocked) {
                        moves.push({ from: -1, to: targetPoint, dice }); // -1 represents bar
                    }
                }
            });
        } else {
            // Normal moves
            for (let from = 0; from < 24; from++) {
                const pieces = state.board[from];
                const isCurrentPlayerPiece = (state.currentPlayer === 'white' && pieces > 0) ||
                    (state.currentPlayer === 'black' && pieces < 0);

                if (!isCurrentPlayerPiece) continue;

                availableDice.forEach(dice => {
                    let to = from + (dice * direction);

                    // Check for bearing off
                    if (canBearOffNow && ((state.currentPlayer === 'white' && to < 0) ||
                        (state.currentPlayer === 'black' && to >= 24))) {
                        // Only allow bearing off if no checker is on a higher point
                        // or if the die matches the exact distance
                        let higherPointExists = false;
                        if (state.currentPlayer === 'white') {
                            // Check for checkers on higher points (indices > from)
                            for (let i = from + 1; i < 6; i++) {
                                if (state.board[i] > 0) {
                                    higherPointExists = true;
                                    break;
                                }
                            }
                            const exact = (from + 1) === dice;
                            if (exact || (!higherPointExists && (from + 1) < dice)) {
                                moves.push({ from, to: -2, dice });
                            }
                        } else {
                          // Check for checkers on higher points (indices < from)
                          for (let i = from - 1; i >= 18; i--) {
                            if (state.board[i] < 0) {
                              higherPointExists = true;
                              break;
                            }
                          }
                          const exact = (24 - from) === dice;
                          if (exact || (!higherPointExists && (24 - from) < dice)) {
                            moves.push({ from, to: -2, dice });
                          }
                        }
                        return;
                    }

                    // Normal move
                    if (to >= 0 && to < 24) {
                        const targetPieces = state.board[to];
                        const isBlocked = (state.currentPlayer === 'white' && targetPieces < -1) ||
                            (state.currentPlayer === 'black' && targetPieces > 1);

                        if (!isBlocked) {
                            moves.push({ from, to, dice });
                        }
                    }
                });
            }
        }

        return moves;
    }, []);

    // Update possible moves whenever game state changes
    useEffect(() => {
        const possibleMoves = calculatePossibleMoves(gameState);
        if (JSON.stringify(possibleMoves) !== JSON.stringify(gameState.possibleMoves)) {
            setGameState(prev => ({ ...prev, possibleMoves }));
        }
    }, [gameState.dice, gameState.usedDice, gameState.board, gameState.bar, gameState.currentPlayer, calculatePossibleMoves, gameState.possibleMoves]);

    // Clear invalid drop feedback after a delay
    useEffect(() => {
        if (invalidDropFeedback) {
            const timer = setTimeout(() => {
                setInvalidDropFeedback(null);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [invalidDropFeedback]);

    const isValidMove = (from: number, to: number, dice: number): boolean => {
        return gameState.possibleMoves.some(move =>
            move.from === from && move.to === to && move.dice === dice
        );
    };

    const makeMove = (from: number, to: number, dice: number, checkerIndex?: number) => {
        if (!isValidMove(from, to, dice)) {
            return;
        }

        setGameState(prev => {
            const newBoard = [...prev.board];
            const newBar = { ...prev.bar };
            const newHome = { ...prev.home };
            const diceIndex = prev.dice!.indexOf(dice);
            const newUsedDice = [...prev.usedDice];

            // Track if we already removed the checker from the stack
            let alreadyRemovedFrom = false;

            // Remove checker from correct position in stack
            if (checkerIndex !== undefined && from >= 0) {
                const absCount = Math.abs(newBoard[from]);
                if (absCount > 1) {
                    if (newBoard[from] > 0) {
                        newBoard[from] -= 1;
                    } else {
                        newBoard[from] += 1;
                    }
                } else {
                    newBoard[from] = 0;
                }
                alreadyRemovedFrom = true;
            }

            // Handle move from bar
            if (from === -1) {
                if (prev.currentPlayer === 'white') {
                    newBar.white -= 1;
                    if (newBoard[to] === -1) {
                        newBoard[to] = 1;
                        newBar.black += 1;
                    } else {
                        newBoard[to] += 1;
                    }
                } else {
                    newBar.black -= 1;
                    if (newBoard[to] === 1) {
                        newBoard[to] = -1;
                        newBar.white += 1;
                    } else {
                        newBoard[to] -= 1;
                    }
                }
            }
            // Handle bearing off
            else if (to === -2) {
                if (!alreadyRemovedFrom) {
                    if (prev.currentPlayer === 'white') {
                        newBoard[from] -= 1;
                    } else {
                        newBoard[from] += 1;
                    }
                }
                if (prev.currentPlayer === 'white') {
                    newHome.white += 1;
                } else {
                    newHome.black += 1;
                }
            }
            // Normal move
            else {
                if (!alreadyRemovedFrom) {
                    if (prev.currentPlayer === 'white') {
                        newBoard[from] -= 1;
                    } else {
                        newBoard[from] += 1;
                    }
                }
                if (prev.currentPlayer === 'white') {
                    if (newBoard[to] === -1) {
                        newBoard[to] = 1;
                        newBar.black += 1;
                    } else {
                        newBoard[to] += 1;
                    }
                } else {
                    if (newBoard[to] === 1) {
                        newBoard[to] = -1;
                        newBar.white += 1;
                    } else {
                        newBoard[to] -= 1;
                    }
                }
            }

            // Mark dice as used
            // Find the first unused die with the correct value
            let dieToUse = -1;
            for (let i = 0; i < newUsedDice.length; i++) {
                if (!newUsedDice[i] && prev.dice && prev.dice[i] === dice) {
                    dieToUse = i;
                    break;
                }
            }
            if (dieToUse !== -1) {
                newUsedDice[dieToUse] = true;
            }

            // Check if turn is complete (all dice used or no more moves possible)
            const turnComplete = newUsedDice.every(used => used);

            // Check for win condition
            const gameFinished = newHome.white === 15 || newHome.black === 15;

            return {
                ...prev,
                board: newBoard,
                bar: newBar,
                home: newHome,
                usedDice: newUsedDice,
                currentPlayer: turnComplete ? (prev.currentPlayer === 'white' ? 'black' : 'white') : prev.currentPlayer,
                dice: turnComplete ? null : prev.dice,
                gamePhase: gameFinished ? 'finished' : prev.gamePhase
            };
        });

        setSelectedPoint(null);
        setInvalidDropFeedback(null);
    };

    const rollDice = () => {
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;

        // Handle doubles (same number on both dice)
        const diceArray = dice1 === dice2 ? [dice1, dice1, dice1, dice1] : [dice1, dice2];

        setGameState(prev => ({
            ...prev,
            dice: diceArray,
            usedDice: new Array(diceArray.length).fill(false),
            gamePhase: 'playing'
        }));
    };

    const handleDragStart = (e: React.DragEvent, pointIndex: number, checkerIndex: number) => {
        const piece = gameState.board[pointIndex];
        const player = piece > 0 ? 'white' : 'black';
        const absCount = Math.abs(piece);

        if (player !== gameState.currentPlayer) {
            e.preventDefault();
            return;
        }

        const hasValidMoves = gameState.possibleMoves.some(move => move.from === pointIndex);
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

        // Use a transparent drag image
        const img = document.createElement('img');
        img.src =
            'data:image/svg+xml;base64,' +
            btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
        e.dataTransfer.setDragImage(img, 0, 0);

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ fromPoint: pointIndex, player, checkerIndex }));

        setInvalidDropFeedback(null);
    };

    const handleBarDragStart = (e: React.DragEvent, player: Player) => {
        if (player !== gameState.currentPlayer || gameState.bar[player] === 0) {
            e.preventDefault();
            return;
        }

        const hasValidMoves = gameState.possibleMoves.some(move => move.from === -1);
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

    const handleDragOver = (e: React.DragEvent, pointIndex?: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (pointIndex !== undefined) {
            setDragOverPoint(pointIndex);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only clear drag over if we're actually leaving the element
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverPoint(null);
        }
    };

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
            return;
        }

        // Find available dice values for this move
        const availableDice = gameState.dice?.filter((_, index) => !gameState.usedDice[index]) || [];

        // Try each available dice value to see if the move is valid
        let validMove = null;
        for (const dice of availableDice) {
            const possibleMove = gameState.possibleMoves.find(move =>
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
    };

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
            return;
        }

        // Find available dice values for bearing off
        const availableDice = gameState.dice?.filter((_, index) => !gameState.usedDice[index]) || [];

        let validMove = null;
        for (const dice of availableDice) {
            const possibleMove = gameState.possibleMoves.find(move =>
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
    };
    const handleDragEnd = () => {
        setDraggedPiece(null);
        setSelectedPoint(null);
        setDragOverPoint(null);
        setDraggingPointIndex(null);
        setDraggingCheckerIndex(null);
    };

    const handlePointClick = (pointIndex: number) => {
        if (gameState.gamePhase !== 'playing' || !gameState.dice) return;

        const pieces = gameState.board[pointIndex];
        const isCurrentPlayerPiece = (gameState.currentPlayer === 'white' && pieces > 0) ||
            (gameState.currentPlayer === 'black' && pieces < 0);

        // If clicking on current player's piece, select it
        if (isCurrentPlayerPiece && selectedPoint !== pointIndex) {
            // Check if there is only one possible move for this checker
            const movesForThisChecker = gameState.possibleMoves.filter(move => move.from === pointIndex);
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
            const possibleMove = gameState.possibleMoves.find(move =>
                move.from === selectedPoint && move.to === pointIndex
            );

            if (possibleMove) {
                makeMove(selectedPoint, pointIndex, possibleMove.dice);
            } else {
                setSelectedPoint(null);
            }
        }
    };

    const handleBarClick = () => {
        if (gameState.bar[gameState.currentPlayer] > 0) {
            setSelectedPoint(-1);
        }
    };

    const handleBearOff = () => {
        if (selectedPoint !== null && selectedPoint >= 0) {
            const possibleMove = gameState.possibleMoves.find(move =>
                move.from === selectedPoint && move.to === -2
            );

            if (possibleMove) {
                makeMove(selectedPoint, -2, possibleMove.dice);
            }
        }
    };

    const getPointHighlight = (pointIndex: number): string => {
        if (selectedPoint === pointIndex) return 'ring-4 ring-blue-400';
        if (dragOverPoint === pointIndex) return 'ring-4 ring-purple-400 bg-purple-100';

        // Only highlight valid drop targets when dragging from the bar
        if (draggedPiece && draggedPiece.fromPoint === -1) {
            const canMoveTo = gameState.possibleMoves.some(move =>
                move.from === -1 && move.to === pointIndex
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
            return '';
        }

        if (selectedPoint !== null || draggedPiece) {
            const fromPoint = draggedPiece ? draggedPiece.fromPoint : selectedPoint;
            const canMoveTo = gameState.possibleMoves.some(move =>
                move.from === fromPoint && move.to === pointIndex
            );
            if (canMoveTo) return 'ring-2 ring-green-400 bg-green-100';
        }

        return '';
    };

    const renderPoint = (pointIndex: number, isTopRow: boolean) => {
        const pieces = gameState.board[pointIndex];
        const absCount = Math.abs(pieces);
        const player = pieces > 0 ? 'white' : 'black';
        const highlight = getPointHighlight(pointIndex);
        const isCurrentPlayerPiece = (gameState.currentPlayer === 'white' && pieces > 0) ||
            (gameState.currentPlayer === 'black' && pieces < 0);
        const hasValidMoves = gameState.possibleMoves.some(move => move.from === pointIndex);
        const canDrag = isCurrentPlayerPiece && hasValidMoves && gameState.gamePhase === 'playing';

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
                        } select-none transition-transform ${canDrag ? 'cursor-move hover:scale-110 z-10' : 'cursor-pointer'} ${isBeingDragged ? 'invisible' : ''}`}
                    style={{
                        userSelect: 'none',
                        height: checkerSize,
                        width: checkerSize,
                        top: isTopRow ? pos : undefined,
                        bottom: !isTopRow ? pos : undefined
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
        const canBearOffNow = canBearOff(gameState.currentPlayer, gameState.board) && gameState.currentPlayer === player;
        const hasValidBearOffMoves = gameState.possibleMoves.some(move => move.to === -2 && (!draggedPiece || move.from === draggedPiece.fromPoint));
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
                    {Array.from({ length: gameState.bar.black }, (_, i) => (
                        <div
                            key={`bar-black-inboard-${i}`}
                            draggable={gameState.currentPlayer === 'black' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing'}
                            onDragStart={e => gameState.currentPlayer === 'black' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? handleBarDragStart(e, 'black') : e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`w-4 h-4 rounded-full border-2 bg-gray-800 border-white select-none transition-transform ${gameState.currentPlayer === 'black' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? 'cursor-move hover:scale-110' : ''}`}
                            style={{ userSelect: 'none', margin: '1px 0' }}
                        />
                    ))}
                </div>
                {/* White checkers (bottom) */}
                <div className="flex flex-col items-center absolute bottom-0 left-0 right-0" style={{ height: '50%' }}>
                    {Array.from({ length: gameState.bar.white }, (_, i) => (
                        <div
                            key={`bar-white-inboard-${i}`}
                            draggable={gameState.currentPlayer === 'white' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing'}
                            onDragStart={e => gameState.currentPlayer === 'white' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? handleBarDragStart(e, 'white') : e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`w-4 h-4 rounded-full border-2 bg-white border-gray-800 select-none transition-transform ${gameState.currentPlayer === 'white' && gameState.possibleMoves.some(move => move.from === -1) && gameState.gamePhase === 'playing' ? 'cursor-move hover:scale-110' : ''}`}
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
if (winner) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-amber-100">
            <div className="w-full flex flex-col items-center mb-8">
                <div className="text-4xl font-bold text-green-700 mb-2">{winner} WINS!</div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xl font-bold shadow-lg"
                >
                    Refresh Page
                </button>
            </div>
            <div className="text-6xl font-bold text-amber-900 mb-8">🎉</div>
            <button
                onClick={() => setGameState(initialGameState)}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xl"
            >
                New Game
            </button>
        </div>
    );
    }

    return (
        <div className="flex flex-col items-center p-8 bg-amber-100 min-h-screen">
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

                {gameState.possibleMoves.length === 0 && gameState.dice && (
                    <div className="text-red-600 font-bold mt-2">No moves available!</div>
                )}
            </div>

            {/* Dice Roll Button */}
            {!gameState.dice && (
                <button
                    onClick={rollDice}
                    className="mb-6 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xl font-bold shadow-lg"
                >
                    Roll Dice
                </button>
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