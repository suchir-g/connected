from flask import Flask, request, jsonify
from flask_cors import CORS

from Position import Position
from Negamaxer import Negamaxer

import random

app = Flask(__name__)
CORS(app)

game_position = None  #for continuous games
negamaxer = Negamaxer(difficulty='medium')

def validate_board(board):
    # dimensionally validate board
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
    from Position import Position  

    while True:
        # initialises a 2d empty array (weird python syntax but it's just a list of lists)
        board = [[0 for _ in range(7)] for _ in range(6)]
        current_player = 1

        for _ in range(moves):
            # randomly select a valid column
            valid_columns = [col for col in range(7) if board[0][col] == 0]
            if not valid_columns:
                break 
            column = random.choice(valid_columns)

            # drop piece in the selected column
            for row in range(5, -1, -1):
                if board[row][column] == 0:
                    board[row][column] = current_player
                    break

            # alternate between players
            current_player = -current_player

        game_position = Position(array_board=board)
        if game_position.check_winner() is None:
            return board  # return the valid board if there's no winner


@app.route('/start', methods=['POST'])
def start_game():
    global game_position
    game_position = Position()  # initialize an empty board

    return jsonify({
        "board": game_position.array_board, 
        "current_player": 1  # player 1 goes first who's encoded by a 1
    }), 200

@app.route('/move', methods=['POST'])
def make_move():
    global game_position, negamaxer

    if game_position is None:
        return jsonify({'error': 'Game not started'}), 400

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data sent'}), 400

    col = data.get('column')
    board = data.get('board')
    current_player = data.get('current_player', 1)

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

@app.route('/set-difficulty', methods=['POST'])
def set_difficulty():
    global negamaxer
    data = request.get_json()
    if not data or 'difficulty' not in data:
        return jsonify({'error': 'missing fields'}), 400

    difficulty = data['difficulty']
    if difficulty not in ['very_easy', 'easy', 'medium', 'hard', 'very_hard', 'expert']:
        return jsonify({'error': 'invalid difficulty'}), 400

    negamaxer = Negamaxer(difficulty=difficulty)
    return jsonify({'message': 'difficulty updated to ' + difficulty}), 200

@app.route('/bestmove', methods=['POST'])
def best_move():
    negamaxer = Negamaxer(difficulty='very_hard')

    data = request.get_json()
    if not data:
        return jsonify({'error': 'no data sent'}), 400

    board = data.get('board')
    current_player = data.get('current_player')

    if current_player not in [1, -1]:
        return jsonify({'error': 'invalid current_player value - must be 1 or -1.'}), 400

    if not validate_board(board):
        return jsonify({'error': 'invalid board format'}), 400

    game_position = Position(array_board=board)

    best_col = negamaxer.choose_move(game_position, current_player)

    if best_col is None:
        return jsonify({'error': "couldn't calculate the best move!"}), 500

    return jsonify({'best_move': best_col}), 200

@app.route('/generate-board', methods=['POST'])
def generate_board():
    data = request.get_json()
    moves = data.get('moves', 0)

    if not isinstance(moves, int) or moves < 0:
        return jsonify({"error": "invalid moves parameter"}), 400

    board = simulate_board(moves)
    return jsonify({"board": board})

@app.route('/column-scores', methods=['POST'])
def column_scores():
    print("Received request to /column-scores")
    global negamaxer

    data = request.get_json()
    if not data:
        print("Error: No data received")
        return jsonify({'error': 'No data sent'}), 400

    board = data.get('board')
    current_player = data.get('current_player')

    if current_player not in [1, -1]:
        print("Error: Invalid current_player value")
        return jsonify({'error': 'Invalid current_player value - must be 1 or -1.'}), 400

    if not validate_board(board):
        print("Error: Invalid board format")
        return jsonify({'error': 'Invalid board format!'}), 400

    game_position = Position(array_board=board)
    print(f"Processing column scores for player {current_player} with board:\n{board}")

    try:
        column_scores = negamaxer.get_column_scores(game_position, current_player)
        print("Column scores calculated successfully:", column_scores)
        return jsonify({'column_scores': column_scores}), 200
    except Exception as e:
        print("Error during column score computation:", str(e))
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True, port=5000)
