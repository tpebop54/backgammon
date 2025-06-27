'use client';

import React, { useState } from 'react';

const DraggableCircle: React.FC = () => {
    const [position, setPosition] = useState({ x: 200, y: 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div 
            className="w-full h-screen bg-gray-100 relative overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                className={`w-16 h-16 bg-blue-500 rounded-full cursor-move shadow-lg transition-transform ${
                    isDragging ? 'scale-110' : 'hover:scale-105'
                }`}
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    userSelect: 'none'
                }}
                onMouseDown={handleMouseDown}
            >
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                    🔵
                </div>
            </div>
            
            <div className="absolute top-4 left-4 text-gray-600">
                <p>Drag the circle around!</p>
                <p className="text-sm">Position: ({Math.round(position.x)}, {Math.round(position.y)})</p>
            </div>
        </div>
    );
};

export default DraggableCircle;