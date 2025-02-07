from typing import Optional, List

class Position:
    def __init__(
        self,
        rows: int = 6,
        cols: int = 7,
        mode: str = "connect-4",
        array_board: Optional[List[List[int]]] = None,
        p1_bitboard: int = 0,
        p2_bitboard: int = 0
    ):
        self.mode = mode
        self.ROWS = rows
        self.COLS = cols

        if mode == "connect-5":
            self.n_in_a_row = 5
            self.ROWS = 8
            self.COLS = 9
        else:
            self.n_in_a_row = 4

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
        return Position(
            rows=self.ROWS,
            cols=self.COLS,
            mode=self.mode,
            array_board=new_array,
            p1_bitboard=self.p1_bitboard,
            p2_bitboard=self.p2_bitboard
        )

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



    def popout_piece(self, col: int) -> bool:
        if col < 0 or col >= self.COLS:
            return False

        # traverse bottom to top in the column
        for row in range(self.ROWS - 1, -1, -1):
            if self.array_board[row][col] != 0:
                self.array_board[row][col] = 0

                # shift down everything above
                for r in range(row, 0, -1):
                    self.array_board[r][col] = self.array_board[r - 1][col]
                self.array_board[0][col] = 0

                # synchronize bitboards
                self.update_bitboards()
                return True
        return False

    def update_bitboards(self):

        self.p1_bitboard = 0
        self.p2_bitboard = 0
        for r in range(self.ROWS):
            for c in range(self.COLS):
                idx = c * self.ROWS + r
                if self.array_board[r][c] == 1:
                    self.p1_bitboard |= (1 << idx)
                elif self.array_board[r][c] == -1:
                    self.p2_bitboard |= (1 << idx)

    def get_valid_moves(self) -> List[int]:
        valid = []
        for c in range(self.COLS):
            if self.array_board[0][c] == 0:
                valid.append(c)
        return valid

    def _has_connect_n(self, bitboard: int) -> bool:

        n = self.n_in_a_row
        directions = [(1, 0), (0, 1), (1, 1), (1, -1)]
        for r in range(self.ROWS):
            for c in range(self.COLS):
                idx = c * self.ROWS + r
                if bitboard & (1 << idx):
                    for dr, dc in directions:
                        found = True
                        for step in range(1, n):
                            rr = r + dr * step
                            cc = c + dc * step
                            if (rr < 0 or rr >= self.ROWS or
                                cc < 0 or cc >= self.COLS):
                                found = False
                                break
                            next_idx = cc * self.ROWS + rr
                            if not (bitboard & (1 << next_idx)):
                                found = False
                                break
                        if found:
                            return True
        return False

    def check_winner(self) -> Optional[int]:
        if self._has_connect_n(self.p1_bitboard):
            return 1
        if self._has_connect_n(self.p2_bitboard):
            return -1
        return None

    def is_draw(self) -> bool:
        """
        A draw occurs if there is no winner AND no empty space left.
        """
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
            weights = {2: 10, 3: 5, self.n_in_a_row: 1000}
            consider_open_ends = False
            directions_to_check = [(1, 0)]  # "dumber" – just vertical/horizontal
        elif difficulty == 'easy':
            weights = {2: 5, 3: 50, self.n_in_a_row: 1000}
            consider_open_ends = False
            directions_to_check = [(1, 0)]
        elif difficulty == 'medium':
            weights = {2: 10, 3: 100, self.n_in_a_row: 1000}
            consider_open_ends = True
            directions_to_check = directions
        else:  # 'hard', or anything else
            weights = {2: 10, 3: 100, self.n_in_a_row: 1000}
            consider_open_ends = True
            directions_to_check = directions

        for dr, dc in directions_to_check:
            for shift in range(-self.n_in_a_row + 1, 1):
                count = 0
                blocked = False
                for i in range(self.n_in_a_row):
                    r = row + (shift + i) * dr
                    c = col + (shift + i) * dc
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
                        before_r = row + (shift - 1) * dr
                        before_c = col + (shift - 1) * dc
                        after_r = row + (shift + self.n_in_a_row) * dr
                        after_c = col + (shift + self.n_in_a_row) * dc

                        # Check "before"
                        if (0 <= before_r < len(board) and
                            0 <= before_c < len(board[0]) and
                            board[before_r][before_c] != -player):
                            open_ends += 1
                        # Check "after"
                        if (0 <= after_r < len(board) and
                            0 <= after_c < len(board[0]) and
                            board[after_r][after_c] != -player):
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
