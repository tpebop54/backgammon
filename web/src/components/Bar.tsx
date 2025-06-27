import React from 'react';

interface BarProps {
  bar: { white: number; black: number };
  currentPlayer: 'white' | 'black';
  possibleMoves: Array<{ from: number; to: number; dice: number }>;

  gamePhase: string;
  handleBarDragStart: (e: React.DragEvent, player: 'white' | 'black') => void;
  handleDragEnd: () => void;
}

const Bar: React.FC<BarProps> = ({
  bar,
  currentPlayer,
  possibleMoves,
  gamePhase,
  handleBarDragStart,
  handleDragEnd,
}) => {
  return (
    <div className="w-4 h-40 bg-black flex flex-col justify-between items-center mx-1 relative">
      {/* Black checkers (top only) */}
      <div
        className="flex flex-col items-center absolute top-0 left-0 right-0"
        style={{ height: '50%' }}
      >
        {Array.from({ length: bar.black }, (_, i) => (
          <div
            key={`bar-black-inboard-${i}`}
            draggable={
              currentPlayer === 'black' &&
              possibleMoves.some((move) => move.from === -1) &&
              gamePhase === 'playing'
            }
            onDragStart={(e) =>
              currentPlayer === 'black' &&
              possibleMoves.some((move) => move.from === -1) &&
              gamePhase === 'playing'
                ? handleBarDragStart(e, 'black')
                : e.preventDefault()
            }
            onDragEnd={handleDragEnd}
            className={`w-4 h-4 rounded-full border-2 bg-gray-800 border-white select-none transition-transform ${
              currentPlayer === 'black' &&
              possibleMoves.some((move) => move.from === -1) &&
              gamePhase === 'playing'
                ? 'cursor-move hover:scale-110'
                : ''
            }`}
            style={{ userSelect: 'none', margin: '1px 0' }}
          />
        ))}
      </div>
      {/* White checkers (bottom only) */}
      <div
        className="flex flex-col items-center absolute bottom-0 left-0 right-0"
        style={{ height: '50%' }}
      >
        {Array.from({ length: bar.white }, (_, i) => (
          <div
            key={`bar-white-inboard-${i}`}
            draggable={
              currentPlayer === 'white' &&
              possibleMoves.some((move) => move.from === -1) &&
              gamePhase === 'playing'
            }
            onDragStart={(e) =>
              currentPlayer === 'white' &&
              possibleMoves.some((move) => move.from === -1) &&
              gamePhase === 'playing'
                ? handleBarDragStart(e, 'white')
                : e.preventDefault()
            }
            onDragEnd={handleDragEnd}
            className={`w-4 h-4 rounded-full border-2 bg-white border-gray-800 select-none transition-transform ${
              currentPlayer === 'white' &&
              possibleMoves.some((move) => move.from === -1) &&
              gamePhase === 'playing'
                ? 'cursor-move hover:scale-110'
                : ''
            }`}
            style={{ userSelect: 'none', margin: '1px 0' }}
          />
        ))}
      </div>
    </div>
  );
};

export default Bar;
