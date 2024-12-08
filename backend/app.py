from flask import Flask, request, jsonify
from minimax import negamax
from position import Position

app = Flask(__name__)


@app.route('/move', methods=['POST'])
def get_move():
    board = request.json.get('board')  # Expecting a 2D array
    position = Position()
    position.board = board
    move = None
    best_score = float('-inf')

    for col in range(position.getWidth()):
        if position.canPlay(col):
            position.play(col)
            score = (-1) * negamax(position, depth=5, alpha=float('-inf'),
                             beta=float('inf'), isMaximising=False)
            position.undoMove(col)
            if score > best_score:
                best_score = score
                move = col

    return jsonify({"move": move})


if __name__ == '__main__':
    app.run(debug=True)
