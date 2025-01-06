from typing import Optional, List
import random

class Position:
    ROWS = 6
    COLS = 7

    def __init__(self,
                 array_board: Optional[List[List[int]]] = None,
                 p1_bitboard: int = 0,
                 p2_bitboard: int = 0):
        # if nothing is provided in initialisation, it tries to build up from the bitboards and if not it just initialises to an empty board
        if array_board is None:
            self.array_board = [[0] * self.COLS for _ in range(self.ROWS)]
            for c in range(self.COLS):
                for r in range(self.ROWS):
                    idx = c * self.ROWS + r  # column-major index
                    mask = 1 << idx
                    if p1_bitboard & mask:
                        self.array_board[r][c] = 1
                    elif p2_bitboard & mask:
                        self.array_board[r][c] = -1
            self.p1_bitboard = p1_bitboard
            self.p2_bitboard = p2_bitboard
        else:
            # build bitboards from the given array
            self.array_board = array_board
            self.p1_bitboard = 0
            self.p2_bitboard = 0
            for r in range(self.ROWS):
                for c in range(self.COLS):
                    val = self.array_board[r][c]
                    if val != 0:
                        idx = c * self.ROWS + r
                        if val == 1:
                            self.p1_bitboard |= (1 << idx)
                        elif val == -1:
                            self.p2_bitboard |= (1 << idx)

    def copy(self):
        new_array = [row[:] for row in self.array_board]
        return Position(array_board=new_array,
                        p1_bitboard=self.p1_bitboard,
                        p2_bitboard=self.p2_bitboard)

    def drop_piece(self, col: int, player: int) -> bool:
        if col < 0 or col >= self.COLS:
            return False

        for row in reversed(range(self.ROWS)):
            if self.array_board[row][col] == 0:
                self.array_board[row][col] = player

                idx = col * self.ROWS + row
                if player == 1:
                    self.p1_bitboard |= (1 << idx)
                else:
                    self.p2_bitboard |= (1 << idx)

                return True
        return False

    def get_valid_moves(self) -> List[int]:
        valid = []
        for c in range(self.COLS):
            if self.array_board[0][c] == 0:
                valid.append(c)
        return valid

    def check_winner(self) -> Optional[int]:
        directions = [(1,0), (0,1), (1,1), (1,-1)]  # down, right, diag down-right, diag up-right
        for r in range(self.ROWS):
            for c in range(self.COLS):
                val = self.array_board[r][c]
                if val == 0:
                    continue
                for dr, dc in directions:
                    rr, cc = r, c
                    count = 0
                    for _ in range(4):
                        if 0 <= rr < self.ROWS and 0 <= cc < self.COLS:
                            if self.array_board[rr][cc] == val:
                                count += 1
                                rr += dr
                                cc += dc
                            else:
                                break
                        else:
                            break
                    if count == 4:
                        return val
        return None

    def is_draw(self) -> bool:
        if self.check_winner() is not None:
            return False
        for row in self.array_board:
            if 0 in row:
                return False
        return True

    def count_alignments(self, board, row, col, player, difficulty):
        directions = [(1, 0), (0, 1), (1, 1), (1, -1)]  # vertical, horizontal, diagonal
        align_score = 0
 
        if difficulty == 'very_easy':
            weights = {2: 10, 3: 5, 4: 1000}
            consider_open_ends = False
            directions_to_check = [(1, 0)]  # only vertical/horizontal because it's dumber
        elif difficulty == 'easy':
            weights = {2: 5, 3: 50, 4: 1000}
            consider_open_ends = False
            directions_to_check = [(1, 0)]
        elif difficulty == 'medium':
            weights = {2: 10, 3: 100, 4: 1000}
            consider_open_ends = True
            directions_to_check = directions
        else:
            weights = {2: 10, 3: 100, 4: 1000}
            consider_open_ends = True
            directions_to_check = directions
            # possibly add advanced weighting?

        for dr, dc in directions_to_check:
            for shift in range(-3, 1):
                count = 0
                blocked = False
                for i in range(4):
                    r, c = row + (shift + i) * dr, col + (shift + i) * dc
                    if 0 <= r < len(board) and 0 <= c < len(board[0]):
                        if board[r][c] == player:
                            count += 1
                        elif board[r][c] == -player:
                            blocked = True
                            break
                    else:
                        blocked = True
                        break
                
                if not blocked and count > 1:
                    score_add = weights.get(count, 0)
                    if consider_open_ends:
                        open_ends = 0
                        before_r, before_c = row + (shift - 1) * dr, col + (shift - 1) * dc
                        after_r, after_c = row + (shift + 4) * dr, col + (shift + 4) * dc

                        if (0 <= before_r < len(board) and 0 <= before_c < len(board[0]) 
                            and board[before_r][before_c] != -player):
                            open_ends += 1
                        if (0 <= after_r < len(board) and 0 <= after_c < len(board[0]) 
                            and board[after_r][after_c] != -player):
                            open_ends += 1

                        if count == 2:
                            if open_ends == 2:
                                score_add += 5
                            elif open_ends == 1:
                                score_add += 2
                        if count == 3:
                            if open_ends == 2:
                                score_add += 20
                            elif open_ends == 1:
                                score_add += 10
                    
                    align_score += score_add

        return align_score



