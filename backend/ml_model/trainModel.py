import csv
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error

CSV_PATH = "./trainingData/allTests.csv"   
ROWS = 6                
COLUMNS = 7             
TEST_SIZE = 0.2         
RANDOM_STATE = 42        


def parse_position(position_string):
    board = [[0 for _ in range(COLUMNS)] for _ in range(ROWS)]
    current_player = 1  

    for move_char in position_string.strip():
        col = int(move_char) - 1

        if not 0 <= col < COLUMNS:
            print(f"Invalid column '{col}' in position_string: {position_string}")
            continue 

        for row in reversed(range(ROWS)):
            if board[row][col] == 0:
                board[row][col] = current_player
                break
        current_player *= -1  

    return board


def flatten(board):
    flattened = []
    for row in range(ROWS):
        for col in range(COLUMNS):
            flattened.append(board[row][col])
    return flattened

def load_connect4_data(csv_path):
    X, y = [], []
    with open(csv_path, "r", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            # Expected format: position_string,score
            position_string, score_str = row
            board_2d = parse_position(position_string)
            board_flat = flatten(board_2d)
            X.append(board_flat)
            y.append(float(score_str))
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

def main():
    X, y = load_connect4_data(CSV_PATH)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE
    )

    model = MLPRegressor(
        hidden_layer_sizes=(64, 32, 32, 32),  
        activation='relu',
        solver='adam',
        max_iter=200, 
        random_state=RANDOM_STATE
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    mse = mean_squared_error(y_test, y_pred)
    print(f"Test MSE: {mse:.4f}")

    sample_index = 0
    sample_board = X_test[sample_index].reshape(1, -1) 
    predicted_score = model.predict(sample_board)
    print(f"Sample board's predicted score: {predicted_score[0]:.2f}")
    print(f"True score for that sample: {y_test[sample_index]:.2f}")

if __name__ == "__main__":
    main()
