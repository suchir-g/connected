from Negamaxer import Negamaxer
import pickle 
from Position import Position

def generate_opening_book(ai, max_depth=3):
    opening_book = {}

    def recursive_generate(position, depth, player):
        if depth == 0 or position.check_winner() is not None or position.is_draw():
            return

        pos_key = str(position.array_board)  
        if pos_key in opening_book:
            return 

        best_move = ai.choose_move(position, player)
        opening_book[pos_key] = {"move": best_move, "depth": depth}

        for move in position.get_valid_moves():
            new_position = position.copy()
            new_position.drop_piece(move, player)
            recursive_generate(new_position, depth - 1, -player)

    initial_position = Position()
    recursive_generate(initial_position, max_depth, player=1)

    with open('opening_book.pkl', 'wb') as f:
        pickle.dump(opening_book, f)
    print(f"saved !")

ai = Negamaxer(difficulty='expert')
generate_opening_book(ai, max_depth=5)