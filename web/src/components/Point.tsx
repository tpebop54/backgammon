import React from 'react';

interface PointProps {
  pointIndex: number;
  isTopRow: boolean;
  pieces: number;
  highlight: string;
  isCurrentPlayerPiece: boolean;
  hasValidMoves: boolean;
  canDrag: boolean;
  draggingPointIndex: number | null;
  draggingCheckerIndex: number | null;
  handlePointClick: (pointIndex: number) => void;
  handleDragStart: (e: React.DragEvent, pointIndex: number, checkerIndex: number) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent, pointIndex: number) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, pointIndex: number) => void;
}

const Point: React.FC<PointProps> = ({
  pointIndex,
  isTopRow,
  pieces,
  highlight,
  isCurrentPlayerPiece,
  hasValidMoves,
  canDrag,
  draggingPointIndex,
  draggingCheckerIndex,
  handlePointClick,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
}) => {
  const absCount = Math.abs(pieces);
  const player = pieces > 0 ? 'white' : 'black';
  // Only render pieces if there are any
  if (absCount === 0) {
    return (
      <div
        className={`w-12 h-40 ${pointIndex % 2 === 0 ? 'bg-amber-600' : 'bg-amber-800'} ${isTopRow ? 'flex flex-col' : 'flex flex-col-reverse'} items-center justify-start p-1 cursor-pointer hover:bg-yellow-400 transition-colors ${highlight}`}
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
        onClick={isCurrentPlayerPiece && canDrag ? () => handlePointClick(pointIndex) : undefined}
        onDragStart={isCurrentPlayerPiece && canDrag ? (e) => handleDragStart(e, pointIndex, i) : undefined}
        onDragEnd={isCurrentPlayerPiece && canDrag ? handleDragEnd : undefined}
        className={`absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 ${player === 'white' ? 'bg-white border-gray-800' : 'bg-gray-800 border-white'} select-none transition-transform ${canDrag ? 'cursor-move hover:scale-110 z-10' : 'cursor-pointer'}`}
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
        onClick={isCurrentPlayerPiece && canDrag ? () => handlePointClick(pointIndex) : undefined}
        onDragStart={isCurrentPlayerPiece && canDrag ? (e) => handleDragStart(e, pointIndex, i) : undefined}
        onDragEnd={isCurrentPlayerPiece && canDrag ? handleDragEnd : undefined}
        className={`absolute left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${player === 'white' ? 'bg-white border-gray-800 text-gray-800' : 'bg-gray-800 border-white text-white'} select-none transition-transform ${canDrag ? 'cursor-move hover:scale-110 z-10' : 'cursor-pointer'}`}
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
      className={`w-12 h-40 ${pointIndex % 2 === 0 ? 'bg-amber-600' : 'bg-amber-800'} ${isTopRow ? 'flex flex-col' : 'flex flex-col-reverse'} items-center justify-start p-1 cursor-pointer hover:bg-yellow-400 transition-colors ${highlight} relative`}
      onClick={isCurrentPlayerPiece && canDrag ? () => handlePointClick(pointIndex) : undefined}
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

export default Point;
