import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from Position import Position
from Negamaxer import Negamaxer

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)

def validate_board(board, game_mode):
    print(board, game_mode)
    mode_dimensions = {
        'connect-4': (6, 7),
        'connect-5': (8, 9),
        'var-grid': None,
        'no-grav': None
    }

    if game_mode not in mode_dimensions:
        logging.warning(f"Unsupported game mode: {game_mode}")
        return False

    expected_dims = mode_dimensions.get(game_mode)

    if expected_dims:
        rows, cols = expected_dims
        if len(board) != rows:
            logging.warning(f"Invalid number of rows for {game_mode}: {len(board)} (expected {rows})")
            return False
        for row in board:
            if not isinstance(row, list) or len(row) != cols:
                logging.warning(f"Invalid row length for {game_mode}: {len(row)} (expected {cols})")
                return False
    else:
        # For variable grid modes, check dynamic dimensions
        if len(board) < 4 or len(board) > 10:
            return False
        for row in board:
            if len(row) < 4 or len(row) > 10:
                return False

    # Validate cell values
    for row in board:
        for cell in row:
            if cell not in [1, -1, 0]:
                return False

    return True


    return True

@app.route('/bestmove', methods=['POST'])
def best_move():
    """Calculate the best move based on the current board and the game mode."""
    logging.info("Received request for /bestmove")
    data = request.get_json()

    if not data:
        logging.warning("No data sent in request")
        return jsonify({'error': 'No data sent'}), 400

    board = data.get('board')
    current_player = data.get('current_player')
    game_mode = data.get('game_mode', 'connect-4')  # Default to 'connect-4' if not provided
    difficulty = data.get('difficulty', 'medium')  # Default to 'medium' if not provided

    logging.debug(f"Request data: {data}")

    # Validate board and player input
    if not validate_board(board, game_mode):
        logging.warning(f"Invalid board format: {board}")
        return jsonify({'error': 'Invalid board format'}), 400

    if current_player not in [1, -1]:
        logging.warning(f"Invalid current_player value: {current_player}")
        return jsonify({'error': 'Invalid current_player value - must be 1 or -1.'}), 400

    try:
        # Initialize position and negamaxer
        game_position = Position(array_board=board, mode=game_mode)

        # Check if the game is already over before making a move
        winner = game_position.check_winner()
        if winner is not None:
            logging.info(f"Game already over. Winner: {winner}")
            return jsonify({
                'best_move': None,
                'board': game_position.array_board,  # Include the final board state
                'outcome': winner
            }), 200

        if game_position.is_draw():
            logging.info("Game is a draw.")
            return jsonify({
                'best_move': None,
                'board': game_position.array_board,  # Include the final board state
                'outcome': -1  # -1 indicates a draw
            }), 200

        # Get the AI's move
        negamaxer = Negamaxer(difficulty=difficulty, mode=game_mode)
        best_col = negamaxer.choose_move(game_position, current_player)
        if best_col is None:
            logging.error("Failed to calculate the best move!")
            return jsonify({'error': "Couldn't calculate the best move!"}), 500

        # Apply the AI's move to the board
        game_position.drop_piece(best_col, current_player)

        # Check for a winner or draw after the AI's move
        outcome = game_position.check_winner()
        if outcome is None:
            outcome = 0 if not game_position.is_draw() else -1  # 0 for ongoing, -1 for draw

        logging.info(f"Best move: {best_col}, Outcome: {outcome}")
        logging.info(f"sending board {game_position.array_board}")
        return jsonify({
            'best_move': best_col,
            'board': game_position.array_board,  # Return updated board
            'outcome': outcome
        }), 200

    except Exception as e:
        logging.exception("An unexpected error occurred while processing the request.")
        return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    logging.info("Starting the Flask application on port 5000")
    app.run(debug=True, port=5000)
