import pickle
import random
from zobristHashing import init_zobrist, compute_zobrist_hash

class Negamaxer:
    def __init__(self, difficulty='medium', opening_book_file='opening_book.pkl', mode='connect-4'):
        self.difficulty_settings = {
            'very_easy': 1,
            'easy': 1,
            'medium': 2,
            'hard': 3,
            'very_hard': 4,
            'expert': 6 if mode == "connect-4" else 4,
        }
        self.max_depth = self.difficulty_settings.get(difficulty, 3)
        self.difficulty = difficulty
        self.mode = mode

        rows = 6  
        cols = 7  

        if mode == "connect-5":
            rows = 8
            cols = 9

        if difficulty == 'expert' and mode == "connect-4": # only zobrist on expert connect 4
            try:
                with open(opening_book_file, 'rb') as f:
                    self.opening_book = pickle.load(f)
            except FileNotFoundError:
                self.opening_book = {}
                print("No opening book found. Now playing without one.")

            self.zobrist_table = init_zobrist(rows, cols)
            self.transposition_table = {}  
        else:
            self.opening_book = None
            self.zobrist_table = None
            self.transposition_table = None

    def order_moves(self, moves):
        center = 3 if self.mode == "connect-4" else 4  
        return sorted(moves, key=lambda move: abs(move - center))

    def choose_move(self, position, player):
        print("choosing move for player", player)
        print("position", position.array_board)
        valid_moves = self.order_moves(position.get_valid_moves()) 
        popout_moves = []  

        if position.mode == "popout":
            popout_moves = self.order_moves([-col for col in range(position.COLS) if any(position.array_board[row][col] != 0 for row in range(position.ROWS))])

        best_score = -float('inf')
        best_move = None


        total_moves = sum(row.count(0) for row in position.array_board)  
        flip_colors = self.mode == "colour-switch" and (total_moves % 3 == 0)

        for move in valid_moves:
            new_position = position.copy()
            new_position.drop_piece(move, player)
            if flip_colors:
                player = -player
            score = -self.negamax(new_position, -player, self.max_depth, -float('inf'), float('inf'))
            if flip_colors:
                player = -player  
            if score > best_score:
                best_score = score
                best_move = move

        for move in popout_moves:
            col = abs(move)
            new_position = position.copy()
            if new_position.popout_piece(col):
                if flip_colors:
                    player = -player  
                score = -self.negamax(new_position, -player, self.max_depth, -float('inf'), float('inf'))
                if flip_colors:
                    player = -player  
                if score > best_score:
                    best_score = score
                    best_move = move

        return best_move

    def negamax(self, position, player, depth, alpha, beta):
        if depth == 0 or position.check_winner() is not None or position.is_draw():
            return self.evaluate(position, player)

        if self.difficulty == 'expert' and self.zobrist_table is not None:
            pos_hash = compute_zobrist_hash(position, self.zobrist_table)
            tt_key = (pos_hash, depth)
            if tt_key in self.transposition_table:
                return self.transposition_table[tt_key]

        best_score = -float('inf')

        total_moves = sum(row.count(0) for row in position.array_board) 
        flip_colors = self.mode == "colour-switch" and (total_moves % 3 == 0)

        valid_moves = self.order_moves(position.get_valid_moves())

        popout_moves = []
        if position.mode == "popout":
            popout_moves = self.order_moves([
                -col for col in range(position.COLS)
                if any(position.array_board[row][col] != 0 for row in range(position.ROWS))
            ])

        for move in valid_moves:
            new_position = position.copy()
            new_position.drop_piece(move, player)
            if flip_colors:
                player = -player  
            score = -self.negamax(new_position, -player, depth - 1, -beta, -alpha)
            if flip_colors:
                player = -player  
            best_score = max(best_score, score)
            alpha = max(alpha, score)
            if alpha >= beta:
                break

        for move in popout_moves:
            col = abs(move)  
            new_position = position.copy()
            if new_position.popout_piece(col):
                if flip_colors:
                    player = -player  
                score = -self.negamax(new_position, -player, depth - 1, -beta, -alpha)
                if flip_colors:
                    player = -player  
                best_score = max(best_score, score)
                alpha = max(alpha, score)
                if alpha >= beta:
                    break

        if self.difficulty == 'expert' and self.zobrist_table is not None and position.mode == "connect-4":
            self.transposition_table[tt_key] = best_score

        return best_score

    def evaluate(self, position, player):
        winner = position.check_winner()
        if winner == player:
            if position.mode == "anti":
                return -10000  
            return 10000
        elif winner == -player:
            if position.mode == "anti":
                return 10000  
            return -10000

        score = 0
        for r in range(position.ROWS):
            for c in range(position.COLS):
                if position.array_board[r][c] == player:
                    score += position.count_alignments(position.array_board, r, c, player, self.difficulty)
                elif position.array_board[r][c] == -player:
                    score -= position.count_alignments(position.array_board, r, c, -player, self.difficulty)

        return score
