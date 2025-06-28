'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../utils/socket';

export type GameState = {
  board: number[];
  bar: { white: number; black: number };
  home: { white: number; black: number };
  currentPlayer: 'white' | 'black';
  dice: number[] | null;
  usedDice: boolean[];
  gamePhase: 'setup' | 'playing' | 'finished';
  possibleMoves: Array<{ from: number; to: number; dice: number }>;
  timers: { white: number; black: number }; // server-synced timers (required)
};

interface SocketContextType {
  gameState: GameState | null;
  sendMove: (moves: { from: number; to: number; dice: number }[], playerColor: 'white' | 'black' | null) => void;
  resetGame: () => void;
  joinRoom: (roomId: string) => void;
  connected: boolean;
  playerColor: 'white' | 'black' | null; // Add playerColor to context
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
  const socketRef = useRef<any>(null);
  const roomRef = useRef<string>('default');

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('gameState', (state: GameState) => {
      setGameState(state);
    });
    socket.on('playerAssignment', ({ color }: { color: 'white' | 'black' }) => {
      setPlayerColor(color);
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameState');
      socket.off('playerAssignment');
    };
  }, []);

  const joinRoom = (roomId: string) => {
    roomRef.current = roomId;
    if (socketRef.current) {
      socketRef.current.emit('join', roomId);
    }
  };

  // Accepts an array of moves for a full turn
  const sendMoves = (moves: { from: number; to: number; dice: number }[], playerColor: 'white' | 'black' | null) => {
    if (socketRef.current && playerColor) {
      socketRef.current.emit('makeMove', { roomId: roomRef.current, moves, playerColor });
    }
  };

  const resetGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('reset', roomRef.current);
    }
  };

  return (
    <SocketContext.Provider value={{ gameState, sendMove: sendMoves, resetGame, joinRoom, connected, playerColor }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocketGame() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketGame must be used within SocketProvider');
  return ctx;
}
