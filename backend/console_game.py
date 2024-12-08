import requests
import numpy as np

API_URL = "http://127.0.0.1:5000/move"


class Connect4Game:
    def __init__(self):
        self.board = np.zeros((6, 7), dtype=int)  # 6 rows x 7 columns board
        self.current_player = 1  # Player 1 starts

    def display_board(self):
        print("\nCurrent Board:")
        print(np.flip(self.board, 0))  # Flip vertically for better readability
        print(" 0  1  2  3  4  5  6")  # Column indices for reference

    def is_valid_move(self, col):
        return self.board[5][col] == 0

    def make_move(self, col):
        for row in range(6):
            if self.board[row][col] == 0:
                self.board[row][col] = self.current_player
                break

    def undo_move(self, col):
        for row in reversed(range(6)):
            if self.board[row][col] != 0:
                self.board[row][col] = 0
                break

    def check_winner(self):
        # Check horizontal, vertical, and diagonal matches
        for row in range(6):
            for col in range(7 - 3):
                if all(self.board[row, col:col + 4] == self.current_player):
                    return True

        for col in range(7):
            for row in range(6 - 3):
                if all(self.board[row:row + 4, col] == self.current_player):
                    return True

        for row in range(6 - 3):
            for col in range(7 - 3):
                if all([self.board[row + i][col + i] == self.current_player for i in range(4)]):
                    return True
                if all([self.board[row + 3 - i][col + i] == self.current_player for i in range(4)]):
                    return True

        return False

    def get_bot_move(self):
        response = requests.post(API_URL, json={"board": self.board.tolist()})
        if response.status_code == 200:
            return response.json()["move"]
        else:
            print("Error:", response.json())
            return None

    def play(self):
        print("Welcome to Connect 4!")
        self.display_board()

        while True:
            if self.current_player == 1:
                print("\nYour turn!")
                try:
                    col = int(input("Enter column (0-6): "))
                    if not (0 <= col < 7) or not self.is_valid_move(col):
                        print("Invalid move. Try again.")
                        continue
                except ValueError:
                    print("Invalid input. Please enter a number between 0 and 6.")
                    continue
            else:
                print("\nBot's turn...")
                col = self.get_bot_move()
                if col is None:
                    print("Bot encountered an error. Exiting.")
                    break

            self.make_move(col)
            self.display_board()

            if self.check_winner():
                print(f"\nPlayer {self.current_player} wins!")
                break

            # Switch player
            self.current_player = 3 - self.current_player

            if np.all(self.board != 0):
                print("\nIt's a draw!")
                break


if __name__ == "__main__":
    game = Connect4Game()
    game.play()
