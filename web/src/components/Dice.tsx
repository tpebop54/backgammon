import React from 'react';

interface DiceProps {
  dice: number[] | null;
  usedDice: boolean[];
}

const Dice: React.FC<DiceProps> = ({ dice, usedDice }) => {
  if (!dice) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <div className="flex gap-2">
        {dice.map((die, index) => (
          <div
            key={index}
            className={`w-12 h-12 border-2 border-gray-800 rounded-lg flex items-center justify-center text-2xl font-bold shadow-lg transition-all ${usedDice[index] ? 'bg-gray-400 text-gray-600 scale-90' : 'bg-white text-black'}`}
          >
            {die}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dice;
