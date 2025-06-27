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
};

interface SocketContextType {
  gameState: GameState | null;
  sendMove: (newState: GameState) => void;
  resetGame: () => void;
  joinRoom: (roomId: string) => void;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
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
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameState');
    };
  }, []);

  const joinRoom = (roomId: string) => {
    roomRef.current = roomId;
    if (socketRef.current) {
      socketRef.current.emit('join', roomId);
    }
  };

  const sendMove = (newState: GameState) => {
    if (socketRef.current) {
      socketRef.current.emit('makeMove', { roomId: roomRef.current, newState });
    }
  };

  const resetGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('reset', roomRef.current);
    }
  };

  return (
    <SocketContext.Provider value={{ gameState, sendMove, resetGame, joinRoom, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocketGame() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketGame must be used within SocketProvider');
  return ctx;
}
