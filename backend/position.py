class Position:
    __WIDTH = 7
    __HEIGHT = 6

    def __init__(self):
        # Initialize the board as a 2D array
        self.board = [[0 for _ in range(self.__WIDTH)]
                      for _ in range(self.__HEIGHT)]
        self.moves = 0

    def canPlay(self, col):
        # Check if the top row in the column is empty
        return self.board[0][col] == 0

    def play(self, col):
        for row in reversed(range(self.__HEIGHT)):
            if self.board[row][col] == 0:
                self.board[row][col] = 1 if self.moves % 2 == 0 else -1
                self.moves += 1
                break

    def undoMove(self, col):
        for row in range(self.__HEIGHT):
            if self.board[row][col] != 0:
                self.board[row][col] = 0
                self.moves -= 1
                break

    def isWinningMove(self, col):
        if not self.canPlay(col):
            return False
        self.play(col)
        result = self.checkWin()
        self.undoMove(col)
        return result

    def getNumberOfMoves(self):
        return self.moves

    def getWidth(self):
        return self.__WIDTH

    def getHeight(self):
        return self.__HEIGHT

    def checkWin(self):
        # Check for 4-in-a-row horizontally, vertically, and diagonally
        for row in range(self.__HEIGHT):
            for col in range(self.__WIDTH):
                if self.board[row][col] != 0 and (
                    self.checkDirection(row, col, 1, 0) or
                    self.checkDirection(row, col, 0, 1) or
                    self.checkDirection(row, col, 1, 1) or
                    self.checkDirection(row, col, 1, -1)
                ):
                    return True
        return False

    def checkDirection(self, row, col, d_row, d_col):
        count = 0
        player = self.board[row][col]
        for step in range(4):
            r, c = row + d_row * step, col + d_col * step
            if 0 <= r < self.__HEIGHT and 0 <= c < self.__WIDTH and self.board[r][c] == player:
                count += 1
            else:
                break
        return count == 4
