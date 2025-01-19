from flask import Flask, request, jsonify
from flask_cors import CORS

from Position import Position
from Negamaxer import Negamaxer

import random

app = Flask(__name__)
CORS(app)


def validate_board(board):
    if not isinstance(board, list) or len(board) != 6:
        return False
    for row in board:
        if not isinstance(row, list) or len(row) != 7:
            return False
        for cell in row:
            if cell not in [1, -1, 0]:
                return False
    return True


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

        game_position = Position(array_board=board)
        if game_position.check_winner() is None:
            return board


@app.route('/move', methods=['POST'])
def make_move():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data sent'}), 400

    col = data.get('column')
    board = data.get('board')
    current_player = data.get('current_player', 1)
    difficulty = data.get('difficulty', 'medium')

    if current_player != 1:
        return jsonify({'error': 'Only Player 1 can make a move'}), 400

    if not validate_board(board):
        return jsonify({'error': 'Invalid board format!'}), 400

    game_position = Position(array_board=board)

    success = game_position.drop_piece(col, 1)
    if not success:
        return jsonify({'error': 'Column is full or invalid!'}), 400

    winner = game_position.check_winner()
    is_draw = game_position.is_draw()

    if winner is not None or is_draw:
        return jsonify({
            'board': game_position.array_board,
            'current_player': 0,
            'winner': winner if winner is not None else 0,
            'is_draw': is_draw,
            'ai_move': None
        }), 200

    negamaxer = Negamaxer(difficulty=difficulty)
    ai_col = negamaxer.choose_move(game_position, -1)

    if ai_col is not None:
        success = game_position.drop_piece(ai_col, -1)
        if not success:
            return jsonify({'error': 'AI attempted an invalid move'}), 500
    else:
        return jsonify({'error': 'AI failed to choose move'}), 500

    winner = game_position.check_winner()
    is_draw = game_position.is_draw()

    return jsonify({
        'board': game_position.array_board,
        'current_player': 1 if (winner is None and not is_draw) else 0,
        'winner': winner if winner is not None else 0,
        'is_draw': is_draw,
        'ai_move': ai_col
    }), 200


@app.route('/bestmove', methods=['POST'])
def best_move():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data sent'}), 400

    board = data.get('board')
    current_player = data.get('current_player')
    difficulty = data.get('difficulty', 'medium')

    if current_player not in [1, -1]:
        return jsonify({'error': 'Invalid current_player value - must be 1 or -1.'}), 400

    if not validate_board(board):
        return jsonify({'error': 'Invalid board format'}), 400

    game_position = Position(array_board=board)
    negamaxer = Negamaxer(difficulty=difficulty)
    best_col = negamaxer.choose_move(game_position, current_player)

    if best_col is None:
        return jsonify({'error': "Couldn't calculate the best move!"}), 500

    return jsonify({'best_move': best_col}), 200


@app.route('/generate-board', methods=['POST'])
def generate_board():
    data = request.get_json()
    moves = data.get('moves', 0)

    if not isinstance(moves, int) or moves < 0:
        return jsonify({"error": "Invalid moves parameter"}), 400

    board = simulate_board(moves)
    return jsonify({"board": board})


@app.route('/column-scores', methods=['POST'])
def column_scores():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data sent'}), 400

    board = data.get('board')
    current_player = data.get('current_player')
    difficulty = data.get('difficulty', 'medium')

    if current_player not in [1, -1]:
        return jsonify({'error': 'Invalid current_player value - must be 1 or -1.'}), 400

    if not validate_board(board):
        return jsonify({'error': 'Invalid board format!'}), 400

    game_position = Position(array_board=board)
    negamaxer = Negamaxer(difficulty=difficulty)

    try:
        column_scores = negamaxer.get_column_scores(game_position, current_player)
        return jsonify({'column_scores': column_scores}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
