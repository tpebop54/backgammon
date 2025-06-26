'use client';

import React, { useState } from 'react';

// Game state type definitions
type Player = 'white' | 'black';
type GameState = {
  board: number[]; // 24 points, positive = white pieces, negative = black pieces
  bar: { white: number; black: number }; // pieces on the bar
  home: { white: number; black: number }; // pieces borne off
  currentPlayer: Player;
  dice: [number, number] | null;
  usedDice: boolean[]; // track which dice have been used
  gamePhase: 'setup' | 'playing' | 'finished';
};

// Initial backgammon setup
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
    2    // point 24 (2 white pieces - black home board)
  ],
  bar: { white: 0, black: 0 },
  home: { white: 0, black: 0 },
  currentPlayer: 'white',
  dice: null,
  usedDice: [false, false],
  gamePhase: 'setup'
};

const BackgammonBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [draggedPiece, setDraggedPiece] = useState<{ fromPoint: number; player: Player } | null>(null);

  // Move validation logic
  const isValidMove = (fromPoint: number, toPoint: number, diceValue: number): boolean => {
    if (!gameState.dice || gameState.gamePhase !== 'playing') return false;
    
    const currentPieces = gameState.board[fromPoint];
    const targetPieces = gameState.board[toPoint];
    
    // Check if there's a piece of current player on the from point
    const isCurrentPlayerPiece = (gameState.currentPlayer === 'white' && currentPieces > 0) ||
                                 (gameState.currentPlayer === 'black' && currentPieces < 0);
    
    if (!isCurrentPlayerPiece) return false;
    
    // Check if the move distance matches the dice value
    const direction = gameState.currentPlayer === 'white' ? -1 : 1;
    const expectedToPoint = fromPoint + (diceValue * direction);
    
    if (expectedToPoint !== toPoint) return false;
    
    // Check if destination is blocked (more than 1 opponent piece)
    const isBlocked = (gameState.currentPlayer === 'white' && targetPieces < -1) ||
                      (gameState.currentPlayer === 'black' && targetPieces > 1);
    
    return !isBlocked;
  };

  const getAvailableDice = (): number[] => {
    if (!gameState.dice) return [];
    return gameState.dice.filter((_, index) => !gameState.usedDice[index]);
  };

  const canMoveFrom = (pointIndex: number): boolean => {
    if (!gameState.dice || gameState.gamePhase !== 'playing') return false;
    
    const pieces = gameState.board[pointIndex];
    const isCurrentPlayerPiece = (gameState.currentPlayer === 'white' && pieces > 0) ||
                                 (gameState.currentPlayer === 'black' && pieces < 0);
    
    if (!isCurrentPlayerPiece) return false;
    
    // Check if any dice value allows a valid move from this point
    const availableDice = getAvailableDice();
    const direction = gameState.currentPlayer === 'white' ? -1 : 1;
    
    return availableDice.some(diceValue => {
      const targetPoint = pointIndex + (diceValue * direction);
      if (targetPoint < 0 || targetPoint >= 24) return false;
      return isValidMove(pointIndex, targetPoint, diceValue);
    });
  };

  const makeMove = (fromPoint: number, toPoint: number, diceValue: number) => {
    if (!isValidMove(fromPoint, toPoint, diceValue)) return;

    setGameState(prev => {
      const newBoard = [...prev.board];
      const diceIndex = prev.dice!.indexOf(diceValue);
      const newUsedDice = [...prev.usedDice];
      
      // Move piece
      if (prev.currentPlayer === 'white') {
        newBoard[fromPoint] -= 1;
        
        // Handle hitting opponent piece
        if (newBoard[toPoint] === -1) {
          newBoard[toPoint] = 1;
          return {
            ...prev,
            board: newBoard,
            bar: { ...prev.bar, black: prev.bar.black + 1 },
            usedDice: newUsedDice.map((used, i) => i === diceIndex ? true : used)
          };
        } else {
          newBoard[toPoint] += 1;
        }
      } else {
        newBoard[fromPoint] += 1;
        
        // Handle hitting opponent piece
        if (newBoard[toPoint] === 1) {
          newBoard[toPoint] = -1;
          return {
            ...prev,
            board: newBoard,
            bar: { ...prev.bar, white: prev.bar.white + 1 },
            usedDice: newUsedDice.map((used, i) => i === diceIndex ? true : used)
          };
        } else {
          newBoard[toPoint] -= 1;
        }
      }
      
      // Mark dice as used
      newUsedDice[diceIndex] = true;
      
      // Check if turn is complete (all dice used)
      const turnComplete = newUsedDice.every(used => used);
      
      return {
        ...prev,
        board: newBoard,
        usedDice: newUsedDice,
        currentPlayer: turnComplete ? (prev.currentPlayer === 'white' ? 'black' : 'white') : prev.currentPlayer,
        dice: turnComplete ? null : prev.dice
      };
    });
  };

  const rollDice = () => {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    
    setGameState(prev => ({
      ...prev,
      dice: [dice1, dice2],
      usedDice: [false, false],
      gamePhase: 'playing'
    }));
  };

  const handleDragStart = (e: React.DragEvent, pointIndex: number) => {
    const pieces = gameState.board[pointIndex];
    const player = pieces > 0 ? 'white' : 'black';
    
    if (!canMoveFrom(pointIndex)) {
      e.preventDefault();
      return;
    }
    
    setDraggedPiece({ fromPoint: pointIndex, player });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Prevent text selection
    
    // Create a custom drag image (the checker piece)
    const dragImage = document.createElement('div');
    dragImage.style.width = '32px';
    dragImage.style.height = '32px';
    dragImage.style.borderRadius = '50%';
    dragImage.style.border = '2px solid';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px'; // Hide off-screen
    
    if (player === 'white') {
      dragImage.style.backgroundColor = 'white';
      dragImage.style.borderColor = '#1f2937';
    } else {
      dragImage.style.backgroundColor = '#1f2937';
      dragImage.style.borderColor = 'white';
    }
    
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 16, 16); // Center the drag image
    
    // Clean up the drag image after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toPoint: number) => {
    e.preventDefault();
    
    if (!draggedPiece) return;
    
    const availableDice = getAvailableDice();
    const direction = gameState.currentPlayer === 'white' ? -1 : 1;
    
    // Find which dice value allows this move
    const validDiceValue = availableDice.find(diceValue => {
      const expectedToPoint = draggedPiece.fromPoint + (diceValue * direction);
      return expectedToPoint === toPoint && isValidMove(draggedPiece.fromPoint, toPoint, diceValue);
    });
    
    if (validDiceValue) {
      makeMove(draggedPiece.fromPoint, toPoint, validDiceValue);
    }
    
    setDraggedPiece(null);
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
    // Re-enable text selection
    document.body.style.userSelect = 'auto';
  };

  const renderPoint = (pointIndex: number, isTopRow: boolean) => {
    const pieces = gameState.board[pointIndex];
    const absCount = Math.abs(pieces);
    const player = pieces > 0 ? 'white' : 'black';
    const canMove = canMoveFrom(pointIndex);
    
    // Create piece elements
    const pieceElements = [];
    for (let i = 0; i < Math.min(absCount, 5); i++) {
      pieceElements.push(
        <div
          key={i}
          draggable={canMove}
          onDragStart={(e) => canMove ? handleDragStart(e, pointIndex) : e.preventDefault()}
          onDragEnd={handleDragEnd}
          className={`w-8 h-8 rounded-full border-2 ${
            player === 'white' 
              ? 'bg-white border-gray-800' 
              : 'bg-gray-800 border-white'
          } ${canMove ? 'cursor-move hover:scale-110 transition-transform select-none' : 'select-none'}`}
        />
      );
    }
    
    // Add overflow indicator if more than 5 pieces
    if (absCount > 5) {
      pieceElements.push(
        <div
          key="overflow"
          draggable={canMove}
          onDragStart={(e) => handleDragStart(e, pointIndex)}
          onDragEnd={handleDragEnd}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
            player === 'white' 
              ? 'bg-white border-gray-800 text-gray-800' 
              : 'bg-gray-800 border-white text-white'
          } ${canMove ? 'cursor-move hover:scale-110 transition-transform select-none' : 'select-none'}`}
        >
          +{absCount - 5}
        </div>
      );
    }

    return (
      <div 
        className={`w-12 h-40 ${
          pointIndex % 2 === 0 ? 'bg-amber-600' : 'bg-amber-800'
        } ${
          isTopRow ? 'flex flex-col' : 'flex flex-col-reverse'
        } items-center justify-start p-1 transition-colors ${
          draggedPiece ? 'hover:bg-yellow-400' : ''
        }`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, pointIndex)}
      >
        <div className="flex flex-col items-center gap-1">
          {pieceElements}
        </div>
        <div className="text-xs text-white mt-auto">
          {pointIndex + 1}
        </div>
      </div>
    );
  };

  const renderBar = () => (
    <div className="w-16 h-40 bg-amber-900 flex flex-col items-center justify-center gap-2">
      <div className="text-white text-xs font-bold">BAR</div>
      {gameState.bar.black > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-white" />
          {gameState.bar.black > 1 && (
            <div className="text-white text-xs">×{gameState.bar.black}</div>
          )}
        </div>
      )}
      {gameState.bar.white > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-800" />
          {gameState.bar.white > 1 && (
            <div className="text-white text-xs">×{gameState.bar.white}</div>
          )}
        </div>
      )}
    </div>
  );

  const renderHome = (player: Player) => (
    <div className="w-16 h-40 bg-green-600 flex flex-col items-center justify-center gap-2">
      <div className="text-white text-xs font-bold">HOME</div>
      <div className="text-white text-xs">
        {player.toUpperCase()}: {gameState.home[player]}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center p-8 bg-amber-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-amber-900">Backgammon</h1>
      
      {/* Game Info */}
      <div className="mb-4 text-center">
        <div className="text-lg font-semibold text-amber-800">
          Current Player: {gameState.currentPlayer.toUpperCase()}
        </div>
        {gameState.dice && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="text-lg font-semibold">Dice:</div>
            <div className="flex gap-2">
              {gameState.dice.map((die, index) => (
                <div
                  key={index}
                  className={`w-12 h-12 border-2 border-gray-800 rounded-lg flex items-center justify-center text-2xl font-bold shadow-lg ${
                    gameState.usedDice[index] ? 'bg-gray-400 text-gray-600' : 'bg-white text-black'
                  }`}
                >
                  {die}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dice Roll Button */}
      {!gameState.dice && (
        <button
          onClick={rollDice}
          className="mb-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Roll Dice
        </button>
      )}

      {/* Board */}
      <div className="border-4 border-amber-900 bg-amber-200 p-4">
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

      {/* Game State Debug Info */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg max-w-2xl">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        <div className="text-sm">
          <div>Phase: {gameState.gamePhase}</div>
          <div>White pieces on board: {gameState.board.filter(p => p > 0).reduce((sum, p) => sum + p, 0)}</div>
          <div>Black pieces on board: {Math.abs(gameState.board.filter(p => p < 0).reduce((sum, p) => sum + p, 0))}</div>
        </div>
      </div>
    </div>
  );
};

export default BackgammonBoard;