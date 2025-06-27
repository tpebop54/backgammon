import React from 'react';

interface ControlsProps {
  onUndo: () => void;
  onConfirm: () => void;
  onNewGame: () => void;
  canUndo: boolean;
  canConfirm: boolean;
  showNewGame: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  onUndo,
  onConfirm,
  onNewGame,
  canUndo,
  canConfirm,
  showNewGame,
}) => {
  return (
    <div className="flex gap-4 mb-4">
      <button
        onClick={onUndo}
        className={`px-6 py-2 rounded-lg text-white text-lg font-bold shadow transition-colors ${
          canUndo ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'
        }`}
        disabled={!canUndo}
      >
        Undo
      </button>
      <button
        onClick={onConfirm}
        className={`px-6 py-2 rounded-lg text-white text-lg font-bold shadow ${
          canConfirm
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
        disabled={!canConfirm}
      >
        Confirm Moves
      </button>
      {showNewGame && (
        <button
          onClick={onNewGame}
          className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xl"
        >
          New Game
        </button>
      )}
    </div>
  );
};

export default Controls;
