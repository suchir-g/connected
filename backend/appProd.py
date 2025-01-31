from flask import Flask, request, jsonify
from flask_cors import CORS
from Position import Position
from Negamaxer import Negamaxer
import random

app = Flask(__name__)
CORS(app)

def validate_board(board, game_mode):
    mode_dimensions = {
        'connect-4': (6, 7),
        'connect-5': (8, 9),
        'popout': (6, 7),
        'anti': (6, 7),
        'colour-switch': (6, 7),
    }
    if game_mode not in mode_dimensions:
        return False
    rows, cols = mode_dimensions[game_mode]
    return (
        len(board) == rows and
        all(len(row) == cols for row in board) and
        all(cell in [1, -1, 0] for row in board for cell in row)
    )

def simulate_board(moves):
    while True:
        board = [[0 for _ in range(7)] for _ in range(6)]
        current_player = 1
        for _ in range(moves):
            valid_columns = [col for col in range(7) if board[0][col] == 0]
            if not valid_columns:
                break
            column = random.choice(valid_columns)
            for row in range(5, -1, -1):
                if board[row][column] == 0:
                    board[row][column] = current_player
                    break
            current_player = -current_player
        if Position(array_board=board).check_winner() is None:
            return board

@app.route('/bestmove', methods=['POST'])
def best_move():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data sent'}), 400
    board = data.get('board')
    current_player = data.get('current_player')
    game_mode = data.get('game_mode', 'connect-4')
    difficulty = data.get('difficulty', 'medium')
    if not validate_board(board, game_mode) or current_player not in [1, -1]:
        return jsonify({'error': 'Invalid input'}), 400
    game_position = Position(array_board=board, mode=game_mode)
    winner = game_position.check_winner()
    if winner is not None:
        return jsonify({'best_move': None, 'board': board, 'outcome': winner}), 200
    if game_position.is_draw():
        return jsonify({'best_move': None, 'board': board, 'outcome': -1}), 200
    negamaxer = Negamaxer(difficulty=difficulty, mode=game_mode)
    best_col = negamaxer.choose_move(game_position, current_player)
    if best_col is None:
        return jsonify({'error': 'Failed to calculate best move'}), 500
    success = (
        game_position.popout_piece(abs(best_col)) if game_mode == "popout" and best_col < 0
        else game_position.drop_piece(best_col, current_player)
    )
    if not success:
        return jsonify({'error': 'Invalid move'}), 400
    outcome = game_position.check_winner() or (0 if not game_position.is_draw() else -1)
    return jsonify({'best_move': best_col, 'board': game_position.array_board, 'outcome': outcome}), 200

@app.route('/generate-board', methods=['POST'])
def generate_board():
    data = request.get_json()
    moves = data.get('moves', 0)
    if not isinstance(moves, int) or moves < 0:
        return jsonify({"error": "invalid moves parameter"}), 400
    return jsonify({"board": simulate_board(moves)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
