# main.py - FastAPI server
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
from enum import Enum

from backgammon_engine import BackgammonEngine
from bot_controller import BotController

app = FastAPI(title="Backgammon Bot API", version="1.0.0")

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium" 
    HARD = "hard"

class BoardPosition(BaseModel):
    # Board representation: 24 points + bar + off for each player
    # points[0-23] = board points (white's perspective)
    # bar_white, bar_black = pieces on bar
    # off_white, off_black = pieces borne off
    points: List[int]  # 24 integers representing pieces on each point
    bar_white: int
    bar_black: int
    off_white: int
    off_black: int
    
class GameState(BaseModel):
    board: BoardPosition
    dice: List[int]  # [die1, die2]
    player_to_move: str  # "white" or "black"
    cube_value: int = 1
    cube_owner: Optional[str] = None  # "white", "black", or None
    match_score_white: int = 0
    match_score_black: int = 0
    match_length: int = 1

class Move(BaseModel):
    from_point: int  # 1-24, or 0 for bar, 25 for off
    to_point: int    # 1-24, or 25 for off
    
class BotResponse(BaseModel):
    moves: List[Move]
    evaluation: float  # Position evaluation (-1 to 1)
    thinking_time_ms: int
    cube_action: Optional[str] = None  # "double", "take", "pass", None

# Initialize bot controller
bot_controller = BotController()

@app.post("/api/get-move")
async def get_bot_move(
    game_state: GameState,
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
) -> BotResponse:
    """
    Get the bot's move for the current game state
    """
    try:
        # Validate game state
        engine = BackgammonEngine()
        if not engine.is_valid_state(game_state):
            raise HTTPException(status_code=400, detail="Invalid game state")
        
        # Get bot move
        response = bot_controller.get_move(game_state, difficulty)
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating move: {str(e)}")

@app.post("/api/evaluate-position")
async def evaluate_position(
    game_state: GameState,
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
) -> Dict[str, float]:
    """
    Evaluate the current position without making a move
    """
    try:
        evaluation = bot_controller.evaluate_position(game_state, difficulty)
        return {"evaluation": evaluation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating position: {str(e)}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "bot_loaded": bot_controller.is_ready()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)


# bot_controller.py - Main bot logic
import time
import random
from typing import List
import numpy as np

from neural_network import BackgammonNet
from move_generator import MoveGenerator
from position_evaluator import PositionEvaluator

class BotController:
    def __init__(self):
        self.move_generator = MoveGenerator()
        self.evaluator = PositionEvaluator()
        
        # Load pre-trained models for different difficulties
        self.models = {
            "easy": BackgammonNet("models/easy_model.pth"),
            "medium": BackgammonNet("models/medium_model.pth"), 
            "hard": BackgammonNet("models/hard_model.pth")
        }
        
        # Difficulty settings
        self.difficulty_params = {
            "easy": {
                "search_depth": 1,
                "noise_factor": 0.3,  # Add randomness to moves
                "mistake_probability": 0.15
            },
            "medium": {
                "search_depth": 2,
                "noise_factor": 0.1,
                "mistake_probability": 0.05
            },
            "hard": {
                "search_depth": 3,
                "noise_factor": 0.0,
                "mistake_probability": 0.0
            }
        }
    
    def get_move(self, game_state: GameState, difficulty: str) -> BotResponse:
        start_time = time.time()
        
        # Generate all legal moves
        legal_moves = self.move_generator.get_legal_moves(game_state)
        
        if not legal_moves:
            return BotResponse(
                moves=[],
                evaluation=0.0,
                thinking_time_ms=int((time.time() - start_time) * 1000)
            )
        
        # Get difficulty parameters
        params = self.difficulty_params[difficulty]
        model = self.models[difficulty]
        
        # Evaluate each move
        best_moves = None
        best_evaluation = float('-inf')
        
        for moves in legal_moves:
            # Apply moves to get resulting position
            test_state = self._apply_moves(game_state, moves)
            
            # Evaluate position
            evaluation = self._evaluate_with_search(
                test_state, 
                model, 
                params["search_depth"]
            )
            
            # Add noise for easier difficulties
            if params["noise_factor"] > 0:
                noise = random.gauss(0, params["noise_factor"])
                evaluation += noise
            
            if evaluation > best_evaluation:
                best_evaluation = evaluation
                best_moves = moves
        
        # Occasionally make suboptimal moves for easier difficulties
        if random.random() < params["mistake_probability"]:
            best_moves = random.choice(legal_moves)
            best_evaluation = self.evaluator.evaluate(
                self._apply_moves(game_state, best_moves), 
                model
            )
        
        thinking_time = int((time.time() - start_time) * 1000)
        
        return BotResponse(
            moves=best_moves,
            evaluation=best_evaluation,
            thinking_time_ms=thinking_time
        )
    
    def evaluate_position(self, game_state: GameState, difficulty: str) -> float:
        model = self.models[difficulty]
        return self.evaluator.evaluate(game_state, model)
    
    def _evaluate_with_search(self, game_state: GameState, model: BackgammonNet, depth: int) -> float:
        """Simple minimax search for move evaluation"""
        if depth == 0:
            return self.evaluator.evaluate(game_state, model)
        
        # For deeper search, you'd implement proper minimax with opponent responses
        # This is a simplified version
        return self.evaluator.evaluate(game_state, model)
    
    def _apply_moves(self, game_state: GameState, moves: List[Move]) -> GameState:
        """Apply a sequence of moves to get the resulting position"""
        # Implementation would modify the board state
        # This is a placeholder - you'd implement the actual move logic
        return game_state
    
    def is_ready(self) -> bool:
        return all(model.is_loaded() for model in self.models.values())


# neural_network.py - Neural network model
import torch
import torch.nn as nn
import numpy as np

class BackgammonNet(nn.Module):
    def __init__(self, model_path: str = None):
        super(BackgammonNet, self).__init__()
        
        # Network architecture
        # Input: 28 features (24 points + 2 bars + 2 off + game state info)
        self.input_layer = nn.Linear(28, 128)
        self.hidden1 = nn.Linear(128, 64)
        self.hidden2 = nn.Linear(64, 32)
        self.output = nn.Linear(32, 1)  # Single output for position evaluation
        
        self.relu = nn.ReLU()
        self.tanh = nn.Tanh()
        
        self.model_path = model_path
        self.loaded = False
        
        if model_path:
            self.load_model()
    
    def forward(self, x):
        x = self.relu(self.input_layer(x))
        x = self.relu(self.hidden1(x))
        x = self.relu(self.hidden2(x))
        x = self.tanh(self.output(x))  # Output between -1 and 1
        return x
    
    def load_model(self):
        try:
            if self.model_path:
                state_dict = torch.load(self.model_path, map_location='cpu')
                self.load_state_dict(state_dict)
                self.eval()
                self.loaded = True
        except FileNotFoundError:
            print(f"Model file {self.model_path} not found. Using random weights.")
            self.loaded = True
    
    def is_loaded(self) -> bool:
        return self.loaded


# requirements.txt content:
"""
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
torch==2.1.0
numpy==1.24.3
python-multipart==0.0.6
"""

# Example client usage:
"""
import requests

# Example game state
game_state = {
    "board": {
        "points": [0, 2, 0, 0, 0, -5, 0, -3, 0, 0, 0, 5, -5, 0, 0, 0, 3, 0, 5, 0, 0, 0, 0, -2],
        "bar_white": 0,
        "bar_black": 0,
        "off_white": 0,
        "off_black": 0
    },
    "dice": [3, 4],
    "player_to_move": "white",
    "cube_value": 1,
    "match_score_white": 0,
    "match_score_black": 0,
    "match_length": 7
}

# Get move from API
response = requests.post(
    "http://localhost:8000/api/get-move",
    json=game_state,
    params={"difficulty": "medium"}
)

print(response.json())
"""