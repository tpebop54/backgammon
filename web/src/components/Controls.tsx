import React from 'react';

interface ControlsProps {
  onUndo: () => void;
  onConfirm: () => void;
  onRollDice: () => void;
  onNewGame: () => void;
  canUndo: boolean;
  canConfirm: boolean;
  canRoll: boolean;
  showNewGame: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  onUndo,
  onConfirm,
  onRollDice,
  onNewGame,
  canUndo,
  canConfirm,
  canRoll,
  showNewGame,
}) => {
  return (
    <div className="flex gap-4 mb-4">
      <button
        onClick={onUndo}
        className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-lg font-bold shadow"
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
      {canRoll && (
        <button
          onClick={onRollDice}
          className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xl font-bold shadow-lg"
        >
          Roll Dice
        </button>
      )}
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
