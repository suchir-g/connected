import random

# https://www.youtube.com/watch?v=QYNRvMolN20&t=332s

def init_zobrist(rows, cols):
    table = [[[random.getrandbits(64) for _ in range(2)] for _ in range(cols)] for _ in range(rows)]
    return table

def compute_zobrist_hash(position, zobrist_table):
    h = 0
    for r in range(position.ROWS):
        for c in range(position.COLS):
            piece = position.array_board[r][c]
            if piece == 1:  # Player 1
                h ^= zobrist_table[r][c][0]
            elif piece == -1:  # Player 2
                h ^= zobrist_table[r][c][1]
    return h