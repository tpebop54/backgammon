'use client'

import React, { useState, useCallback, useEffect } from 'react';

interface DebugEvent {
    [key: string]: any;
}

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
    currentPlayer: Player;
    dice: number[] | null;
    usedDice: boolean[]; // track which dice have been used
    gamePhase: 'setup' | 'playing' | 'finished';
    possibleMoves: Array<{ from: number; to: number; dice: number }>;
};

// Initial backgammon setup - corrected positioning
const initialGameState: GameState = {
    board: [
        0,   // point 1 (black home board)
        0,   // point 2
        0,   // point 3
        0,   // point 4
        0,   // point 5
        -5,  // point 6 (5 black pieces)
        0,   // point 7
        -3,  // point 8 (3 black pieces)
        0,   // point 9
        0,   // point 10
        0,   // point 11
        5,   // point 12 (5 white pieces)
        -5,  // point 13 (5 black pieces)
        0,   // point 14
        0,   // point 15
        0,   // point 16
        3,   // point 17 (3 white pieces)
        0,   // point 18
        5,   // point 19 (5 white pieces)
        0,   // point 20
        0,   // point 21
        0,   // point 22
        0,   // point 23
        2    // point 24 (2 white pieces)
    ],
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
    const [draggedPiece, setDraggedPiece] = useState<{ fromPoint: number; player: Player } | null>(null);

    // Helper function to check if a player can bear off
    const canBearOff = (player: Player, board: number[]): boolean => {
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
            const entryPoint = state.currentPlayer === 'white' ? 23 : 0;

            availableDice.forEach(dice => {
                const targetPoint = state.currentPlayer === 'white' ?
                    entryPoint + dice * direction :
                    entryPoint + dice * (-direction);

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
                        moves.push({ from, to: -2, dice }); // -2 represents home
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

    const isValidMove = (from: number, to: number, dice: number): boolean => {
        return gameState.possibleMoves.some(move =>
            move.from === from && move.to === to && move.dice === dice
        );
    };

    const makeMove = (from: number, to: number, dice: number) => {
        if (!isValidMove(from, to, dice)) return;

        setGameState(prev => {
            const newBoard = [...prev.board];
            const newBar = { ...prev.bar };
            const newHome = { ...prev.home };
            const diceIndex = prev.dice!.indexOf(dice);
            const newUsedDice = [...prev.usedDice];

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
                if (prev.currentPlayer === 'white') {
                    newBoard[from] -= 1;
                    newHome.white += 1;
                } else {
                    newBoard[from] += 1;
                    newHome.black += 1;
                }
            }
            // Normal move
            else {
                if (prev.currentPlayer === 'white') {
                    newBoard[from] -= 1;
                    if (newBoard[to] === -1) {
                        newBoard[to] = 1;
                        newBar.black += 1;
                    } else {
                        newBoard[to] += 1;
                    }
                } else {
                    newBoard[from] += 1;
                    if (newBoard[to] === 1) {
                        newBoard[to] = -1;
                        newBar.white += 1;
                    } else {
                        newBoard[to] -= 1;
                    }
                }
            }

            // Mark dice as used
            newUsedDice[diceIndex] = true;

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

    const handleDragStart = (e: React.DragEvent, pointIndex: number) => {
        const pieces = gameState.board[pointIndex];
        const player = pieces > 0 ? 'white' : 'black';

        // Check if this is the current player's piece
        if (player !== gameState.currentPlayer) {
            e.preventDefault();
            return;
        }

        // Check if there are valid moves from this point
        const hasValidMoves = gameState.possibleMoves.some(move => move.from === pointIndex);
        if (!hasValidMoves) {
            e.preventDefault();
            return;
        }

        setDraggedPiece({ fromPoint: pointIndex, player });
        setSelectedPoint(pointIndex);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    };

    const handleBarDragStart = (e: React.DragEvent, player: Player) => {
        if (player !== gameState.currentPlayer || gameState.bar[player] === 0) {
            e.preventDefault();
            return;
        }

        // Check if there are valid moves from the bar
        const hasValidMoves = gameState.possibleMoves.some(move => move.from === -1);
        if (!hasValidMoves) {
            e.preventDefault();
            return;
        }

        setDraggedPiece({ fromPoint: -1, player });
        setSelectedPoint(-1);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, toPoint: number) => {
        e.preventDefault();

        if (!draggedPiece) return;

        const possibleMove = gameState.possibleMoves.find(move =>
            move.from === draggedPiece.fromPoint && move.to === toPoint
        );

        if (possibleMove) {
            makeMove(draggedPiece.fromPoint, toPoint, possibleMove.dice);
        }

        setDraggedPiece(null);
        setSelectedPoint(null);
    };

    const handleHomeDrop = (e: React.DragEvent, player: Player) => {
        e.preventDefault();

        if (!draggedPiece || draggedPiece.player !== player) return;

        const possibleMove = gameState.possibleMoves.find(move =>
            move.from === draggedPiece.fromPoint && move.to === -2
        );

        if (possibleMove) {
            makeMove(draggedPiece.fromPoint, -2, possibleMove.dice);
        }

        setDraggedPiece(null);
        setSelectedPoint(null);
    };

    const handleDragEnd = () => {
        setDraggedPiece(null);
        setSelectedPoint(null);
    };

    const handlePointClick = (pointIndex: number) => {
        if (gameState.gamePhase !== 'playing' || !gameState.dice) return;

        const pieces = gameState.board[pointIndex];
        const isCurrentPlayerPiece = (gameState.currentPlayer === 'white' && pieces > 0) ||
            (gameState.currentPlayer === 'black' && pieces < 0);

        // If clicking on current player's piece, select it
        if (isCurrentPlayerPiece && selectedPoint !== pointIndex) {
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

        // Create piece elements
        const pieceElements = [];
        const maxVisible = 5;

        for (let i = 0; i < Math.min(absCount, maxVisible); i++) {
            pieceElements.push(
                <div
                    key={i}
                    draggable={canDrag}
                    onDragStart={(e) => canDrag ? handleDragStart(e, pointIndex) : e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className={`w-8 h-8 rounded-full border-2 ${player === 'white'
                        ? 'bg-white border-gray-800'
                        : 'bg-gray-800 border-white'
                        } select-none transition-transform ${canDrag ? 'cursor-move hover:scale-110' : 'cursor-pointer'
                        }`}
                    style={{ userSelect: 'none' }}
                />
            );
        }

        // Add overflow indicator if more than 5 pieces
        if (absCount > maxVisible) {
            pieceElements.push(
                <div
                    key="overflow"
                    draggable={canDrag}
                    onDragStart={(e) => canDrag ? handleDragStart(e, pointIndex) : e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${player === 'white'
                        ? 'bg-white border-gray-800 text-gray-800'
                        : 'bg-gray-800 border-white text-white'
                        } select-none transition-transform ${canDrag ? 'cursor-move hover:scale-110' : 'cursor-pointer'
                        }`}
                    style={{ userSelect: 'none' }}
                >
                    +{absCount - maxVisible}
                </div>
            );
        }

        return (
            <div
                className={`w-12 h-40 ${pointIndex % 2 === 0 ? 'bg-amber-600' : 'bg-amber-800'
                    } ${isTopRow ? 'flex flex-col' : 'flex flex-col-reverse'
                    } items-center justify-start p-1 cursor-pointer hover:bg-yellow-400 transition-colors ${highlight}`}
                onClick={() => handlePointClick(pointIndex)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, pointIndex)}
            >
                <div className="flex flex-col items-center gap-1">
                    {pieceElements}
                </div>
                <div className="text-xs text-white mt-auto font-bold">
                    {pointIndex + 1}
                </div>
            </div>
        );
    };

    const renderBar = () => {
        const whiteOnBar = gameState.bar.white > 0;
        const blackOnBar = gameState.bar.black > 0;
        const currentPlayerOnBar = gameState.bar[gameState.currentPlayer] > 0;
        const hasValidBarMoves = gameState.possibleMoves.some(move => move.from === -1);
        const canDragFromBar = currentPlayerOnBar && hasValidBarMoves && gameState.gamePhase === 'playing';

        return (
            <div
                className={`w-16 h-40 bg-amber-900 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${selectedPoint === -1 ? 'ring-4 ring-blue-400' : ''
                    } ${currentPlayerOnBar ? 'hover:bg-amber-700' : ''}`}
                onClick={handleBarClick}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, -1)}
            >
                <div className="text-white text-xs font-bold">BAR</div>
                {blackOnBar && (
                    <div className="flex flex-col items-center">
                        <div
                            draggable={canDragFromBar && gameState.currentPlayer === 'black'}
                            onDragStart={(e) => canDragFromBar && gameState.currentPlayer === 'black' ? handleBarDragStart(e, 'black') : e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`w-8 h-8 rounded-full bg-gray-800 border-2 border-white select-none transition-transform ${canDragFromBar && gameState.currentPlayer === 'black' ? 'cursor-move hover:scale-110' : ''
                                }`}
                            style={{ userSelect: 'none' }}
                        />
                        {gameState.bar.black > 1 && (
                            <div className="text-white text-xs font-bold">×{gameState.bar.black}</div>
                        )}
                    </div>
                )}
                {whiteOnBar && (
                    <div className="flex flex-col items-center">
                        <div
                            draggable={canDragFromBar && gameState.currentPlayer === 'white'}
                            onDragStart={(e) => canDragFromBar && gameState.currentPlayer === 'white' ? handleBarDragStart(e, 'white') : e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`w-8 h-8 rounded-full bg-white border-2 border-gray-800 select-none transition-transform ${canDragFromBar && gameState.currentPlayer === 'white' ? 'cursor-move hover:scale-110' : ''
                                }`}
                            style={{ userSelect: 'none' }}
                        />
                        {gameState.bar.white > 1 && (
                            <div className="text-white text-xs font-bold">×{gameState.bar.white}</div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderHome = (player: Player) => {
        const canBearOffNow = canBearOff(gameState.currentPlayer, gameState.board) &&
            gameState.currentPlayer === player &&
            (selectedPoint !== null && selectedPoint >= 0 || draggedPiece);
        const hasValidBearOffMoves = gameState.possibleMoves.some(move => move.to === -2);
        const showDropZone = canBearOffNow && hasValidBearOffMoves;

        return (
            <div
                className={`w-16 h-40 bg-green-600 flex flex-col items-center justify-center gap-2 transition-colors ${showDropZone ? 'hover:bg-green-500 cursor-pointer ring-2 ring-green-400 bg-green-100' : ''
                    }`}
                onClick={canBearOffNow ? handleBearOff : undefined}
                onDragOver={showDropZone ? handleDragOver : undefined}
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

    if (gameState.gamePhase === 'finished') {
        const winner = gameState.home.white === 15 ? 'WHITE' : 'BLACK';
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-amber-100">
                <div className="text-6xl font-bold text-amber-900 mb-8">🎉</div>
                <h1 className="text-4xl font-bold mb-4 text-amber-900">{winner} WINS!</h1>
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

                {selectedPoint !== null && (
                    <div className="text-sm text-blue-600 font-semibold">
                        {selectedPoint === -1 ? 'Bar selected' : `Point ${selectedPoint + 1} selected`}
                    </div>
                )}

                {draggedPiece && (
                    <div className="text-sm text-purple-600 font-semibold">
                        Dragging {draggedPiece.player} piece from {draggedPiece.fromPoint === -1 ? 'bar' : `point ${draggedPiece.fromPoint + 1}`}
                    </div>
                )}

                {gameState.dice && (
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <div className="text-lg font-semibold">Dice:</div>
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

            {/* Board */}
            <div className="border-4 border-amber-900 bg-amber-200 p-4 shadow-2xl">
                {/* Top Row (Points 13-24) */}
                <div className="flex gap-1 mb-2">
                    {renderHome('black')}
                    {Array.from({ length: 6 }, (_, i) => renderPoint(12 + i, true))}
                    {renderBar()}
                    {Array.from({ length: 6 }, (_, i) => renderPoint(18 + i, true))}
                    {renderHome('white')}
                </div>

                {/* Bottom Row (Points 12-1) */}
                <div className="flex gap-1">
                    {renderHome('white')}
                    {Array.from({ length: 6 }, (_, i) => renderPoint(11 - i, false))}
                    {renderBar()}
                    {Array.from({ length: 6 }, (_, i) => renderPoint(5 - i, false))}
                    {renderHome('black')}
                </div>
            </div>
            
            {/* Instructions */}
            <div className="mt-6 p-4 bg-white rounded-lg shadow-lg max-w-2xl">
                <h3 className="text-lg font-bold mb-2" onContextMenu={onDebug}>How to Play:</h3>
                <ul className="text-sm space-y-1">
                    <li>• Click "Roll Dice" to start your turn</li>
                    <li>• Click on a piece to select it, then click destination</li>
                    <li>• Or drag and drop pieces to move them</li>
                    <li>• Must move pieces from the bar first if any are there</li>
                    <li>• Get all pieces to your home area to bear off</li>
                    <li>• First player to bear off all 15 pieces wins!</li>
                </ul>
            </div>
        </div>
    );
};

export default BackgammonBoard;