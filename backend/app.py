from flask import Flask, request, jsonify
from flask_cors import CORS
try:
    from Position import Position
    from Negamaxer import Negamaxer
    GAME_ENGINE_AVAILABLE = True
    print("Game engine modules loaded successfully!")
except ImportError as e:
    GAME_ENGINE_AVAILABLE = False
    print(f"Warning: Game engine modules not available. Import error: {e}")
except Exception as e:
    GAME_ENGINE_AVAILABLE = False
    print(f"Warning: Game engine modules failed to load. Error: {e}")
import random

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'Connected backend is running!',
        'game_engine_available': GAME_ENGINE_AVAILABLE
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

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

    expected_dims = mode_dimensions[game_mode]
    rows, cols = expected_dims
    if len(board) != rows or any(len(row) != cols for row in board):
        return False

    for row in board:
        for cell in row:
            if cell not in [1, -1, 0]:
                return False

    return True

def simulate_board(moves):
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

        if GAME_ENGINE_AVAILABLE:
            game_position = Position(array_board=board)
            if game_position.check_winner() is None:
                return board  # return the valid board if there's no winner
        else:
            # Simple validation without game engine
            return board


@app.route('/bestmove', methods=['POST'])
def best_move():
    if not GAME_ENGINE_AVAILABLE:
        return jsonify({'error': 'Game engine not available'}), 503
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data sent'}), 400

    board = data.get('board')
    current_player = data.get('current_player')
    game_mode = data.get('game_mode', 'connect-4')  
    difficulty = data.get('difficulty', 'medium')


    if not validate_board(board, game_mode):
        return jsonify({'error': 'Invalid board format'}), 400

    if current_player not in [1, -1]:
        return jsonify({'error': 'Invalid current_player value - must be 1 or -1.'}), 400

    try:
        game_position = Position(array_board=board, mode=game_mode)

        winner = game_position.check_winner()
        if winner is not None:
            
            if game_mode == "anti":
                return jsonify({'best_move': None, 'board': board, 'outcome': current_player * -1}), 200
            
            return jsonify({
                'best_move': None,
                'board': game_position.array_board, 
                'outcome': winner
            }), 200
        

        if game_position.is_draw():
            return jsonify({
                'best_move': None,
                'board': game_position.array_board, 
                'outcome': -1  
            }), 200

        negamaxer = Negamaxer(difficulty=difficulty, mode=game_mode)
        best_col = negamaxer.choose_move(game_position, current_player)
        if best_col is None:
            return jsonify({'error': "Couldn't calculate the best move!"}), 500

        if game_mode == "popout" and best_col < 0:
            success = game_position.popout_piece(abs(best_col))
            if not success:
                return jsonify({'error': 'Invalid popout move'}), 400
        else:
            success = game_position.drop_piece(best_col, current_player)
            if not success:
                return jsonify({'error': 'Invalid drop move'}), 400

        outcome = game_position.check_winner()
        if outcome is None:
            outcome = 0 if not game_position.is_draw() else -1 

        return jsonify({
            'best_move': best_col,
            'board': game_position.array_board, 
            'outcome': outcome
        }), 200

    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/generate-board', methods=['POST'])
def generate_board():
    data = request.get_json()
    moves = data.get('moves', 0)

    if not isinstance(moves, int) or moves < 0:
        return jsonify({"error": "invalid moves parameter"}), 400

    board = simulate_board(moves)
    return jsonify({"board": board})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
