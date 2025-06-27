import React from 'react';

interface HomeProps {
  player: 'white' | 'black';
  homeCount: number;
  pipCount: number;
  canBearOffNow: boolean;
  isDraggingOwnChecker: boolean;
  hasValidBearOffMoves: boolean;
  dragOverPoint: number | null;
  handleBearOff: () => void;
  handleDragOver: (e: React.DragEvent, pointIndex?: number) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleHomeDrop: (e: React.DragEvent, player: 'white' | 'black') => void;
}

const Home: React.FC<HomeProps> = ({
  player,
  homeCount,
  pipCount,
  canBearOffNow,
  isDraggingOwnChecker,
  hasValidBearOffMoves,
  dragOverPoint,
  handleBearOff,
  handleDragOver,
  handleDragLeave,
  handleHomeDrop,
}) => {
  const showDropZone = isDraggingOwnChecker && canBearOffNow && hasValidBearOffMoves;
  const isBeingDraggedOver = dragOverPoint === -2 && showDropZone;
  return (
    <div
      className={`w-20 h-40 bg-green-600 flex flex-col items-center justify-center gap-2 transition-colors relative ${showDropZone ? 'hover:bg-green-500 cursor-pointer ring-2 ring-green-400 bg-green-100' : ''} ${isBeingDraggedOver ? 'ring-4 ring-purple-400 bg-purple-100' : ''}`}
      onClick={showDropZone ? handleBearOff : undefined}
      onDragOver={showDropZone ? (e) => { handleDragOver(e, -2); } : undefined}
      onDragLeave={showDropZone ? handleDragLeave : undefined}
      onDrop={showDropZone ? (e) => handleHomeDrop(e, player) : undefined}
    >
      {player === 'black' && (
        <div className="absolute top-1 left-1 right-1 flex justify-center text-xs text-black bg-amber-200 rounded px-2 py-1 shadow font-mono">
          {pipCount} pips
        </div>
      )}
      <div className="text-white text-2xl font-bold mb-2 mt-2 flex-1 flex items-center justify-center">{homeCount}</div>
      {player === 'white' && (
        <div className="absolute bottom-1 left-1 right-1 flex justify-center text-xs text-black bg-amber-200 rounded px-2 py-1 shadow font-mono">
          {pipCount} pips
        </div>
      )}
    </div>
  );
};

export default Home;
