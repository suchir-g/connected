from position import Position


def negamax(p: Position, depth: int, alpha: int, beta: int, isMaximising: bool):
    w, h = p.getWidth(), p.getHeight()

    # Guard clauses
    if p.getNumberOfMoves() == h * w:  # Board is full
        return 0
    if depth == 0:  # Max depth reached
        return evaluate(p, isMaximising)

    for i in range(w):
        if p.canPlay(i) and p.isWinningMove(i):
            return h * w + 1 - p.getNumberOfMoves() // 2

    bestScore = -float("inf") if isMaximising else float("inf")

    for i in range(w):
        if not p.canPlay(i):
            continue

        p.play(i)
        score = -negamax(p, depth - 1, -beta, -alpha, not isMaximising)
        p.undoMove(i)

        if isMaximising:
            bestScore = max(bestScore, score)
            alpha = max(alpha, score)
        else:
            bestScore = min(bestScore, score)
            beta = min(beta, score)

        if alpha >= beta:  # Alpha-beta pruning
            break

    return bestScore


def evaluate(position: Position, is_maximizing: bool) -> int:
    score = 0
    current_player = 1 if is_maximizing else -1
    opponent = -current_player

    # Center column preference
    center_column = position.getWidth() // 2
    center_count = sum(1 for row in range(position.getHeight())
                       if position.board[row][center_column] == current_player)
    score += center_count * 3

    # Potential threats and blocking
    for row in range(position.getHeight()):
        for col in range(position.getWidth()):
            if position.board[row][col] == current_player:
                # Check horizontal, vertical, and diagonal alignments
                score += count_potential_threats(position,
                                                 row, col, current_player)
            elif position.board[row][col] == opponent:
                score -= count_potential_threats(position, row, col, opponent)

    return score


def count_potential_threats(position: Position, row: int, col: int, player: int) -> int:
    score = 0

    directions = [
        (1, 0),  # Vertical
        (0, 1),  # Horizontal
        (1, 1),  # Diagonal down-right
        (1, -1)  # Diagonal down-left
    ]

    for d_row, d_col in directions:
        threat_score = evaluate_direction(
            position, row, col, d_row, d_col, player)
        score += threat_score

    return score


def evaluate_direction(position: Position, row: int, col: int, d_row: int, d_col: int, player: int) -> int:
    count = 0
    empty_count = 0
    board = position.board
    height, width = position.getHeight(), position.getWidth()

    for step in range(4):  # Check up to 4 cells in this direction
        r, c = row + d_row * step, col + d_col * step

        if 0 <= r < height and 0 <= c < width:  # Ensure within bounds
            if board[r][c] == player:
                count += 1
            elif board[r][c] == 0:
                empty_count += 1
            else:  # Opponent's piece blocks this line
                return 0
        else:
            return 0  # Out of bounds blocks this line

    # Scoring logic:
    # - 3 pieces and 1 empty space = high threat (4 points)
    # - 2 pieces and 2 empty spaces = medium threat (2 points)
    # - 1 piece and 3 empty spaces = low threat (1 point)
    if count + empty_count == 4:
        if count == 3:
            return 4  # Strong winning potential
        elif count == 2:
            return 2  # Medium threat
        elif count == 1:
            return 1  # Weak threat

    return 0  # No valid threat
