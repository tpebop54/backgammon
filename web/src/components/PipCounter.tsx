import React from 'react';

interface PipCounterProps {
  pipCount: number;
  position: 'top' | 'bottom'; // 'top' for black, 'bottom' for white
}

const PipCounter: React.FC<PipCounterProps> = ({ pipCount, position }) => (
  <div
    className={`absolute ${position === 'top' ? 'top-1' : 'bottom-1'} left-1 right-1 flex justify-center text-xs text-black bg-amber-200 rounded px-2 py-1 shadow font-mono`}
  >
    {pipCount} pips
  </div>
);

export default PipCounter;
