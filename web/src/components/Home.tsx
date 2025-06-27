import React from 'react';

interface HomeProps {
  player: 'white' | 'black';
  homeCount: number;
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
      className={`w-16 h-40 bg-green-600 flex flex-col items-center justify-center gap-2 transition-colors ${showDropZone ? 'hover:bg-green-500 cursor-pointer ring-2 ring-green-400 bg-green-100' : ''} ${isBeingDraggedOver ? 'ring-4 ring-purple-400 bg-purple-100' : ''}`}
      onClick={showDropZone ? handleBearOff : undefined}
      onDragOver={showDropZone ? (e) => { handleDragOver(e, -2); } : undefined}
      onDragLeave={showDropZone ? handleDragLeave : undefined}
      onDrop={showDropZone ? (e) => handleHomeDrop(e, player) : undefined}
    >
      <div className="text-white text-xs font-bold">HOME</div>
      <div className="text-white text-lg font-bold">{homeCount}</div>
      <div className="text-white text-xs">{player.toUpperCase()}</div>
    </div>
  );
};

export default Home;
