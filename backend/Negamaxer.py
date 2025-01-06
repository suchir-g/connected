import pickle
import random
from zobristHashing import init_zobrist, compute_zobrist_hash

class Negamaxer:
    def __init__(self, difficulty='medium', opening_book_file='opening_book.pkl'):
        self.difficulty_settings = {
            'very_easy': 1,
            'easy': 1,
            'medium': 2,
            'hard': 3,
            'very_hard': 3,
            'expert': 5,
        }
        self.max_depth = self.difficulty_settings.get(difficulty, 3)
        self.difficulty = difficulty

        # table and everything is just for expert level
        if difficulty == 'expert':
            try:
                with open(opening_book_file, 'rb') as f:
                    self.opening_book = pickle.load(f)
            except FileNotFoundError:
                self.opening_book = {}
                print("no opening book found. Now playing without one.")

            self.zobrist_table = init_zobrist(rows=6, cols=7)  
            self.transposition_table = {}  # for caching negamax results
        else:
            # get rid of all of them
            self.opening_book = None
            self.zobrist_table = None
            self.transposition_table = None

    def choose_move(self, position, player):
        # if it's in the opening book, use it
        if self.difficulty == 'expert' and self.opening_book is not None:
            board_key = str(position.array_board)
            if board_key in self.opening_book:
                best_move = self.opening_book[board_key]["move"]
                return best_move

        valid_moves = position.get_valid_moves()

        # check for immediate winning moves
        for move in valid_moves:
            new_position = position.copy()
            new_position.drop_piece(move, player)
            if new_position.check_winner() == player:
                print(f"Guaranteed win move found: {move}")
                return move

        # check for moves that block the opponent's winning move
        for move in valid_moves:
            new_position = position.copy()
            new_position.drop_piece(move, -player)
            if new_position.check_winner() == -player:
                print(f"Blocking opponent's winning move: {move}")
                return move

        # fall back to negamax if no guaranteed win or block is found
        # this is the time expensive bit
        best_score = -float('inf')
        best_move = None

        for move in valid_moves:
            new_position = position.copy()
            new_position.drop_piece(move, player)

            # negamax means it's the same scoring system just negative on both sides (due to symmetry)

            score = -self.negamax(new_position, -player, self.max_depth, -float('inf'), float('inf')) 
            if score > best_score:
                best_score = score
                best_move = move

        return best_move

    def negamax(self, position, player, depth, alpha, beta):
        # terminal state check or depth limit reached
        if depth == 0 or position.check_winner() is not None or position.is_draw():
            return self.evaluate(position, player)

        # expert: use zobrist hashing and transposition table
        if self.difficulty == 'expert' and self.zobrist_table is not None:
            pos_hash = compute_zobrist_hash(position, self.zobrist_table)

            # lookup in the transposition table
            tt_key = (pos_hash, depth)
            if tt_key in self.transposition_table:
                return self.transposition_table[tt_key]

        best_score = -float('inf')
        valid_moves = position.get_valid_moves()

        for move in valid_moves:
            new_position = position.copy()
            new_position.drop_piece(move, player)
            score = -self.negamax(new_position, -player, depth - 1, -beta, -alpha)
            best_score = max(best_score, score)
            alpha = max(alpha, score)
            if alpha >= beta:
                break 

        # if it hasn't seen it before it saves it to the transposition table
        if self.difficulty == 'expert' and self.zobrist_table is not None:
            self.transposition_table[tt_key] = best_score

        return best_score

    def evaluate(self, position, player):
        # if it's a winning or losing position return something very high
        if position.check_winner() == player:
            return 10000 
        elif position.check_winner() == -player:
            return -10000

        score = 0
        for r in range(position.ROWS):
            for c in range(position.COLS):
                if position.array_board[r][c] == player:
                    score += position.count_alignments(position.array_board, r, c, player, self.difficulty)
                elif position.array_board[r][c] == -player:
                    score -= position.count_alignments(position.array_board, r, c, -player, self.difficulty)

        return score
