# Connected

Connected is a web application that allows users to play Connect 4 against an AI or locally with another player. The application also includes features for user authentication, game statistics, and training positions.

## Features

* Play Connect 4 against an AI with adjustable difficulty levels
* Play Connect 4 locally with another player
* User authentication and profile management
* Game statistics and history tracking
* Training positions for early and late game scenarios

## Backend

The backend is built using Flask and includes the following main components:

* `backend/app.py`: The main Flask application file that defines the API endpoints for starting a game, making a move, setting difficulty, getting the best move, and generating a random board.
* `backend/Negamaxer.py`: Implements the Negamax algorithm for the AI player, including difficulty settings and an opening book for expert level.
* `backend/position.py`: Represents the game board and provides methods for making moves, checking for a winner, and evaluating board positions.
* `backend/generateOpeningBook.py`: Script to generate an opening book for the AI player.
* `backend/opening_book.pkl`: The opening book file used by the AI player (content not shown).
* `backend/zobristHashing.py`: Implements Zobrist hashing for efficient board state representation (content not shown).

## Frontend

The frontend is built using React and includes the following main components:

* `frontend/src/App.js`: The main application file that defines the routes and components for the application.
* `frontend/src/components/board/Board.js`: The Connect 4 board component that renders the game board and handles user interactions.
* `frontend/src/pages/play/bot/PlayBot.js`: The page for playing against the AI, including difficulty selection and move handling.
* `frontend/src/pages/play/local/PlayLocal.js`: The page for playing locally with another player.
* `frontend/src/pages/auth/Register.js` and `frontend/src/pages/auth/Login.js`: Pages for user registration and login.
* `frontend/src/pages/dashboard/Dashboard.js`: The user dashboard that displays game statistics and recent games.
* `frontend/src/pages/training/PositionTrainer.js`: The page for training positions, allowing users to practice early and late game scenarios.

## Getting Started

### Prerequisites

* Node.js and npm
* Python 3.x
* Flask

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. Start the backend server:
   ```bash
   cd backend
   python app.py
   ```
2. Start the frontend development server:
   ```bash
   cd frontend
   npm start
   ```

Open http://localhost:3000 in your browser to view the application.

## API Endpoints

* `POST /start`: Start a new game
* `POST /move`: Make a move
* `POST /set-difficulty`: Set the AI difficulty
* `POST /bestmove`: Get the best move for the current board state
* `POST /generate-board`: Generate a random board with a specified number of moves

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
