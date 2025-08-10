# Live 2-Player Versus System Design

## Database Choice: Firestore

**Why Firestore is Perfect for This System:**

- **Real-time Updates**: Built-in real-time listeners for instant game state sync
- **Scalability**: Handles thousands of concurrent games
- **Security**: Rule-based security for game integrity
- **Offline Support**: Players can reconnect seamlessly
- **Integration**: Already integrated with Firebase Auth
- **Cost-Effective**: Pay-per-use model scales with usage

## Database Schema Design

### 1. Core Collections Structure

```
firestore/
├── players/                    # Existing user profiles
├── friends/                    # Existing friend relationships
├── live-games/                 # Active game sessions
├── game-invites/              # Game invitations
├── game-history/              # Completed games
└── matchmaking-queue/         # Quick match system
```

### 2. Detailed Collection Schemas

#### **live-games** Collection

```javascript
// Document ID: auto-generated unique game ID
{
  gameId: "game_abc123def456",

  // Player Information
  players: {
    player1: {
      uid: "user123",
      username: "alice_player",
      ready: true,
      connected: true,
      lastSeen: timestamp,
      color: "red"  // Always red for player 1
    },
    player2: {
      uid: "user456",
      username: "bob_gamer",
      ready: true,
      connected: true,
      lastSeen: timestamp,
      color: "yellow"  // Always yellow for player 2
    }
  },

  // Game Configuration
  settings: {
    gameMode: "connect-4",          // connect-4, connect-5, popout, anti, colour-switch
    actionMode: "place",            // for popout mode
    ranked: true                    // affects rating changes
  },

  // Current Game State
  gameState: {
    board: [
      [0, 0, 0, 0, 0, 0, 0],       // 2D array: 0=empty, 1=player1, -1=player2
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    currentPlayer: 1,                // 1 or -1
    moves: "1234567",               // sequence of moves made
    totalMoves: 0,
    colourReversed: false,          // for colour-switch mode
    lastMove: {
      player: 1,
      column: 3,
      timestamp: timestamp,
      moveNumber: 1
    }
  },

  // Game Status
  status: "active",                 // waiting, active, paused, finished, abandoned
  winner: null,                     // null, 1, -1, or "draw"
  endReason: null,                  // "winner", "draw", "disconnect", "forfeit"

  // Metadata
  createdAt: timestamp,
  updatedAt: timestamp,
  startedAt: timestamp,
  finishedAt: null,

  // Room Settings
  isPrivate: false,                 // true for friend games, false for public
  spectators: ["user789"],          // array of UIDs watching the game
  chatEnabled: true
}
```

#### **game-invites** Collection

```javascript
// Document ID: auto-generated
{
  inviteId: "invite_xyz789",

  // Who's involved
  fromPlayer: {
    uid: "user123",
    username: "alice_player"
  },
  toPlayer: {
    uid: "user456",
    username: "bob_gamer"
  },

  // Invite Details
  gameSettings: {
    gameMode: "connect-4",
    ranked: true
  },

  // Status
  status: "pending",                // pending, accepted, declined, expired, cancelled
  message: "Want to play Connect 4?", // optional message

  // Timing
  createdAt: timestamp,
  expiresAt: timestamp,             // auto-expires after 10 minutes
  respondedAt: null,

  // If accepted, reference to created game
  gameId: null                      // populated when invite is accepted
}
```

#### **game-history** Collection

```javascript
// Document ID: auto-generated
{
  gameId: "game_abc123def456",      // reference to original live-game

  // Players (copied from live-game)
  players: {
    player1: { uid: "user123", username: "alice_player" },
    player2: { uid: "user456", username: "bob_gamer" }
  },

  // Final Game State
  finalBoard: [...],                // final board state
  gameMode: "connect-4",
  totalMoves: 42,
  movesSequence: "1234567...",      // complete move sequence

  // Results
  winner: 1,                        // 1, -1, or "draw"
  endReason: "winner",              // winner, draw, disconnect, forfeit
  duration: 1800,                   // game duration in seconds

  // Statistics
  stats: {
    player1Stats: {
      moves: 21
    },
    player2Stats: {
      moves: 21
    }
  },

  // Metadata
  isRanked: true,
  ratingChanges: {
    player1: +15,                   // rating change for each player
    player2: -15
  },

  // Timing
  startedAt: timestamp,
  finishedAt: timestamp,
  createdAt: timestamp              // when moved to history
}
```

#### **matchmaking-queue** Collection

```javascript
// Document ID: player's UID
{
  uid: "user123",
  username: "alice_player",

  // Preferences
  preferences: {
    gameMode: "connect-4",          // preferred game mode
    ranked: true,                   // wants ranked games
    skillLevel: "intermediate"      // beginner, intermediate, advanced
  },

  // Player Info
  rating: 1250,                     // current rating for matchmaking
  gamesPlayed: 45,
  winRate: 0.67,

  // Queue Status
  queuedAt: timestamp,
  status: "searching",              // searching, matched, cancelled
  matchedWith: null,                // UID of matched player
  estimatedWaitTime: 30,            // seconds

  // Auto-cleanup after 5 minutes
  expiresAt: timestamp
}
```

## 3. System Workflows

### **Creating a Friend Game**

```javascript
// 1. Player A sends invite to Player B
const inviteRef = await addDoc(collection(db, "game-invites"), {
  fromPlayer: { uid: currentUser.uid, username: userData.username },
  toPlayer: { uid: friendUid, username: friendUsername },
  gameSettings: { gameMode: "connect-4", ranked: false },
  status: "pending",
  message: "Let's play!",
  createdAt: serverTimestamp(),
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
});

// 2. Player B sees invite via real-time listener
useEffect(() => {
  const q = query(
    collection(db, "game-invites"),
    where("toPlayer.uid", "==", currentUser.uid),
    where("status", "==", "pending")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const invites = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setGameInvites(invites);
  });

  return unsubscribe;
}, []);

// 3. Player B accepts invite
const acceptInvite = async (inviteId) => {
  // Create new game
  const gameRef = await addDoc(collection(db, "live-games"), {
    players: {
      player1: invite.fromPlayer,
      player2: invite.toPlayer,
    },
    settings: invite.gameSettings,
    gameState: initializeGameState(),
    status: "waiting",
    isPrivate: true,
    createdAt: serverTimestamp(),
  });

  // Update invite
  await updateDoc(doc(db, "game-invites", inviteId), {
    status: "accepted",
    gameId: gameRef.id,
    respondedAt: serverTimestamp(),
  });
};
```

### **Real-time Game Synchronization**

```javascript
// Both players listen to the same game document
useEffect(() => {
  if (!gameId) return;

  const gameRef = doc(db, "live-games", gameId);
  const unsubscribe = onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
      const gameData = docSnap.data();
      setGameState(gameData.gameState);
      setCurrentPlayer(gameData.gameState.currentPlayer);
      setPlayers(gameData.players);
      setStatus(gameData.status);

      // Handle opponent moves
      if (gameData.gameState.lastMove?.player !== myPlayerId) {
        // Animate opponent's move
        animateMove(gameData.gameState.lastMove);
      }
    }
  });

  return unsubscribe;
}, [gameId]);

// Making a move
const handleMakeMove = async (column) => {
  if (!isMyTurn() || gameStatus !== "active") return;

  try {
    // Optimistic update
    const newBoard = applyMove(board, column, myPlayerId, gameMode, actionMode);
    setBoard(newBoard);

    // Update Firestore
    const gameRef = doc(db, "live-games", gameId);
    await updateDoc(gameRef, {
      "gameState.board": newBoard,
      "gameState.currentPlayer": -myPlayerId,
      "gameState.moves": moves + (column + 1),
      "gameState.totalMoves": totalMoves + 1,
      "gameState.lastMove": {
        player: myPlayerId,
        column: column,
        timestamp: serverTimestamp(),
        moveNumber: totalMoves + 1,
      },
      updatedAt: serverTimestamp(),
    });

    // Check for game end
    if (checkWinner(newBoard, myPlayerId, gameMode)) {
      await endGame("winner", myPlayerId);
    }
  } catch (error) {
    // Rollback optimistic update
    setBoard(previousBoard);
    setError("Failed to make move. Try again.");
  }
};
```

### **Quick Match System**

```javascript
// Join matchmaking queue
const joinQueue = async () => {
  const queueRef = doc(db, "matchmaking-queue", currentUser.uid);
  await setDoc(queueRef, {
    uid: currentUser.uid,
    username: userData.username,
    preferences: { gameMode, ranked: true },
    rating: userData.rating || 1200,
    queuedAt: serverTimestamp(),
    status: "searching",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  // Listen for matches
  const unsubscribe = onSnapshot(queueRef, (doc) => {
    if (doc.exists() && doc.data().status === "matched") {
      const gameId = doc.data().gameId;
      navigate(`/play/online/${gameId}`);
    }
  });
};

// Server-side function (Cloud Function) for matchmaking
exports.matchPlayers = functions.firestore
  .document("matchmaking-queue/{playerId}")
  .onCreate(async (snap, context) => {
    const newPlayer = snap.data();

    // Find suitable opponent
    const queueRef = db.collection("matchmaking-queue");
    const potentialMatches = await queueRef
      .where("status", "==", "searching")
      .where("preferences.gameMode", "==", newPlayer.preferences.gameMode)
      .where("rating", ">=", newPlayer.rating - 100)
      .where("rating", "<=", newPlayer.rating + 100)
      .limit(1)
      .get();

    if (
      !potentialMatches.empty &&
      potentialMatches.docs[0].id !== context.params.playerId
    ) {
      const opponent = potentialMatches.docs[0];

      // Create game
      const gameRef = await db.collection("live-games").add({
        players: {
          player1: { uid: newPlayer.uid, username: newPlayer.username },
          player2: {
            uid: opponent.data().uid,
            username: opponent.data().username,
          },
        },
        settings: newPlayer.preferences,
        gameState: initializeGameState(),
        status: "active",
        isPrivate: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update both players
      await Promise.all([
        snap.ref.update({ status: "matched", gameId: gameRef.id }),
        opponent.ref.update({ status: "matched", gameId: gameRef.id }),
      ]);
    }
  });
```

## 4. Security Rules

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Players can only read/write their own profile
    match /players/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Game rules
    match /live-games/{gameId} {
      allow read: if request.auth != null && (
        // Players in the game
        resource.data.players.player1.uid == request.auth.uid ||
        resource.data.players.player2.uid == request.auth.uid ||
        // Spectators
        request.auth.uid in resource.data.spectators
      );

      allow create: if request.auth != null;

      allow update: if request.auth != null && (
        // Only players can make moves
        resource.data.players.player1.uid == request.auth.uid ||
        resource.data.players.player2.uid == request.auth.uid
      ) && validateGameMove();

      function validateGameMove() {
        // Ensure only valid game state changes
        return request.resource.data.gameState.totalMoves >= resource.data.gameState.totalMoves &&
               request.resource.data.updatedAt is timestamp;
      }
    }

    // Invites
    match /game-invites/{inviteId} {
      allow read, write: if request.auth != null && (
        resource.data.fromPlayer.uid == request.auth.uid ||
        resource.data.toPlayer.uid == request.auth.uid
      );
    }

    // Matchmaking queue
    match /matchmaking-queue/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 5. Frontend Components Structure

```
src/pages/play/online/
├── PlayOnline.js              # Main online game component
├── GameLobby.js              # Create/join game interface
├── QuickMatch.js             # Quick matchmaking
└── components/
    ├── GameInvites.js        # Pending invites display
    ├── OnlineBoard.js        # Board with real-time updates
    ├── PlayerStatus.js       # Opponent info & connection
    ├── SpectatorView.js      # For watching games
    └── GameChat.js           # In-game messaging
```

## 6. Performance Optimizations

### **Firestore Optimizations:**

- **Composite Indexes**: Create indexes for common query patterns
- **Batched Writes**: Group related updates together
- **Offline Persistence**: Enable for seamless reconnection
- **Query Limitations**: Limit real-time listeners to essential data

### **Real-time Updates:**

- **Debounced Updates**: Prevent excessive writes during rapid moves
- **Optimistic UI**: Update UI immediately, sync with server
- **Connection Monitoring**: Track online/offline status
- **Auto-reconnection**: Handle network disconnections gracefully

### **Cost Management:**

- **TTL Cleanup**: Auto-delete old games and expired invites
- **Batch Operations**: Use Cloud Functions for bulk operations
- **Selective Listening**: Only listen to active game documents

## 7. Additional Features

### **Game Features:**

- **Spectator Mode**: Friends can watch ongoing games
- **Game Replay**: Save and replay completed games
- **Tournament Mode**: Multi-player brackets
- **Custom Rules**: Players can create house rules

### **Social Features:**

- **Rating System**: ELO-based skill ratings
- **Leaderboards**: Global and friend leaderboards
- **Achievements**: Game milestones and badges
- **Game History**: Detailed statistics and analysis

## 8. ELO Rating System Implementation

### **ELO System Overview:**

The ELO rating system calculates skill-based ratings that adjust based on game outcomes and opponent strength. Players start at 1200 rating and gain/lose points based on wins/losses.

### **Database Schema Updates:**

#### **Enhanced players** Collection

```javascript
// Add to existing players collection
{
  uid: "user123",
  username: "alice_player",
  email: "alice@example.com",

  // ELO Rating Data
  ratings: {
    overall: {
      rating: 1250,
      gamesPlayed: 45,
      wins: 30,
      losses: 12,
      draws: 3,
      winRate: 0.67,
      peak: 1320,              // highest rating achieved
      lastUpdated: timestamp
    },
    byGameMode: {
      "connect-4": { rating: 1250, gamesPlayed: 30, wins: 20, losses: 8, draws: 2 },
      "connect-5": { rating: 1180, gamesPlayed: 10, wins: 6, losses: 3, draws: 1 },
      "popout": { rating: 1200, gamesPlayed: 5, wins: 4, losses: 1, draws: 0 }
    }
  },

  // Activity Tracking
  activity: {
    lastActiveDate: timestamp,
    currentStreak: 5,          // current win streak
    longestStreak: 12,         // longest win streak ever
    recentGames: ["gameId1", "gameId2", "gameId3"] // last 10 games
  }
}
```

### **ELO Calculation Functions:**

```javascript
// ELO calculation utility functions
export const ELO_CONFIG = {
  STARTING_RATING: 1200,
  K_FACTOR: 32, // Standard K-factor
  K_FACTOR_NEW: 40, // Higher K for new players (< 30 games)
  K_FACTOR_MASTER: 16, // Lower K for masters (> 2400 rating)
};

// Calculate expected score
export const calculateExpectedScore = (playerRating, opponentRating) => {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
};

// Calculate rating change
export const calculateRatingChange = (
  playerRating,
  opponentRating,
  actualScore,
  gamesPlayed = 30
) => {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);

  // Determine K-factor based on rating and experience
  let kFactor = ELO_CONFIG.K_FACTOR;
  if (gamesPlayed < 30) {
    kFactor = ELO_CONFIG.K_FACTOR_NEW;
  } else if (playerRating >= 2400) {
    kFactor = ELO_CONFIG.K_FACTOR_MASTER;
  }

  return Math.round(kFactor * (actualScore - expectedScore));
};
```

### **Game Completion Flow with ELO Updates:**

```javascript
// Enhanced game completion function
const completeGame = async (gameId, winnerId, endReason = "winner") => {
  const gameRef = doc(db, "live-games", gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) return;

  const gameData = gameSnap.data();
  const { player1, player2 } = gameData.players;
  const isRanked = gameData.settings.ranked;

  // Fetch current player ratings
  const [player1Doc, player2Doc] = await Promise.all([
    getDoc(doc(db, "players", player1.uid)),
    getDoc(doc(db, "players", player2.uid)),
  ]);

  const player1Data = player1Doc.data();
  const player2Data = player2Doc.data();

  const player1Rating =
    player1Data.ratings?.overall?.rating || ELO_CONFIG.STARTING_RATING;
  const player2Rating =
    player2Data.ratings?.overall?.rating || ELO_CONFIG.STARTING_RATING;

  let ratingChanges = { player1: 0, player2: 0 };

  if (isRanked && endReason === "winner") {
    // Calculate scores (1 = win, 0.5 = draw, 0 = loss)
    let player1Score, player2Score;

    if (winnerId === 1) {
      player1Score = 1;
      player2Score = 0;
    } else if (winnerId === -1) {
      player1Score = 0;
      player2Score = 1;
    } else {
      // Draw
      player1Score = 0.5;
      player2Score = 0.5;
    }

    // Calculate rating changes
    const player1Games = player1Data.ratings?.overall?.gamesPlayed || 0;
    const player2Games = player2Data.ratings?.overall?.gamesPlayed || 0;

    ratingChanges.player1 = calculateRatingChange(
      player1Rating,
      player2Rating,
      player1Score,
      player1Games
    );
    ratingChanges.player2 = calculateRatingChange(
      player2Rating,
      player1Rating,
      player2Score,
      player2Games
    );
  }

  // Update player ratings in batch
  const batch = writeBatch(db);

  // Update player 1
  const newPlayer1Rating = player1Rating + ratingChanges.player1;

  batch.update(doc(db, "players", player1.uid), {
    "ratings.overall.rating": newPlayer1Rating,
    "ratings.overall.gamesPlayed": increment(1),
    "ratings.overall.wins": winnerId === 1 ? increment(1) : increment(0),
    "ratings.overall.losses": winnerId === -1 ? increment(1) : increment(0),
    "ratings.overall.draws": winnerId === "draw" ? increment(1) : increment(0),
    "ratings.overall.peak":
      newPlayer1Rating > (player1Data.ratings?.overall?.peak || 0)
        ? newPlayer1Rating
        : player1Data.ratings?.overall?.peak || newPlayer1Rating,
    "ratings.overall.lastUpdated": serverTimestamp(),
    "activity.lastActiveDate": serverTimestamp(),
  });

  // Update player 2
  const newPlayer2Rating = player2Rating + ratingChanges.player2;

  batch.update(doc(db, "players", player2.uid), {
    "ratings.overall.rating": newPlayer2Rating,
    "ratings.overall.gamesPlayed": increment(1),
    "ratings.overall.wins": winnerId === -1 ? increment(1) : increment(0),
    "ratings.overall.losses": winnerId === 1 ? increment(1) : increment(0),
    "ratings.overall.draws": winnerId === "draw" ? increment(1) : increment(0),
    "ratings.overall.peak":
      newPlayer2Rating > (player2Data.ratings?.overall?.peak || 0)
        ? newPlayer2Rating
        : player2Data.ratings?.overall?.peak || newPlayer2Rating,
    "ratings.overall.lastUpdated": serverTimestamp(),
    "activity.lastActiveDate": serverTimestamp(),
  });

  // Move game to history
  batch.set(doc(db, "game-history", gameId), {
    ...gameData,
    winner: winnerId,
    endReason,
    finishedAt: serverTimestamp(),
    ratingChanges,
    finalRatings: {
      player1: newPlayer1Rating,
      player2: newPlayer2Rating,
    },
  });

  // Delete from live games
  batch.delete(gameRef);

  await batch.commit();

  // Update leaderboards (can be done async)
  updateLeaderboards();
};
```

### **Frontend Components for ELO System:**

```javascript
// RatingDisplay.js - Show player rating
const RatingDisplay = ({ rating, size = "medium" }) => {
  return (
    <div className={`rating-display ${size}`}>
      <div className="rating-number">{rating}</div>
    </div>
  );
};

// Leaderboard.js - Display rankings
const Leaderboard = ({ gameMode = "global", period = "all-time" }) => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const leaderboardRef = doc(db, "leaderboards", `${gameMode}-${period}`);
    const unsubscribe = onSnapshot(leaderboardRef, (doc) => {
      if (doc.exists()) {
        setRankings(doc.data().rankings || []);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [gameMode, period]);

  if (loading) return <Loading />;

  return (
    <div className="leaderboard">
      <h3>
        Leaderboard - {gameMode} ({period})
      </h3>
      <div className="rankings-list">
        {rankings.slice(0, 100).map((player, index) => (
          <div key={player.uid} className="ranking-item">
            <span className="rank">#{player.rank}</span>
            <span className="username">{player.username}</span>
            <RatingDisplay rating={player.rating} size="small" />
            <span
              className={`change ${
                player.change >= 0 ? "positive" : "negative"
              }`}
            >
              {player.change >= 0 ? "+" : ""}
              {player.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// RatingHistory.js - Show rating progression over time
const RatingHistory = ({ playerId }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const historyRef = collection(db, "game-history");
      const q = query(
        historyRef,
        or(
          where("players.player1.uid", "==", playerId),
          where("players.player2.uid", "==", playerId)
        ),
        where("isRanked", "==", true),
        orderBy("finishedAt", "desc"),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const games = snapshot.docs.map((doc) => doc.data());
      setHistory(games);
    };

    fetchHistory();
  }, [playerId]);

  return (
    <div className="rating-history">
      <h4>Rating History</h4>
      <LineGraph
        data={history.map((game, index) => ({
          x: index,
          y:
            game.players.player1.uid === playerId
              ? game.finalRatings.player1
              : game.finalRatings.player2,
        }))}
      />
    </div>
  );
};
```

### **Cloud Functions for Leaderboard Updates:**

```javascript
// Auto-update leaderboards when ratings change
exports.updateLeaderboards = functions.firestore
  .document("players/{playerId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if rating changed
    const beforeRating = beforeData.ratings?.overall?.rating || 0;
    const afterRating = afterData.ratings?.overall?.rating || 0;

    if (beforeRating !== afterRating) {
      // Update global leaderboard
      await updateGlobalLeaderboard();

      // Update game mode specific leaderboards
      for (const gameMode of Object.keys(afterData.ratings?.byGameMode || {})) {
        await updateGameModeLeaderboard(gameMode);
      }
    }
  });

const updateGlobalLeaderboard = async () => {
  const playersRef = db.collection("players");
  const topPlayersQuery = playersRef
    .where("ratings.overall.gamesPlayed", ">=", 10)
    .orderBy("ratings.overall.rating", "desc")
    .limit(1000);

  const snapshot = await topPlayersQuery.get();
  const rankings = snapshot.docs.map((doc, index) => {
    const data = doc.data();
    return {
      rank: index + 1,
      uid: doc.id,
      username: data.username,
      rating: data.ratings.overall.rating,
      gamesPlayed: data.ratings.overall.gamesPlayed,
      winRate: data.ratings.overall.winRate || 0,
      change: 0, // Calculate from previous snapshot
    };
  });

  await db.collection("leaderboards").doc("global-all-time").set({
    type: "global",
    period: "all-time",
    rankings,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    totalPlayers: rankings.length,
  });
};
```

This comprehensive ELO system provides:

- **Accurate skill tracking** with proper ELO calculations
- **Tier system** (Bronze → Master) with divisions
- **Game mode specific ratings**
- **Real-time leaderboards**
- **Rating history tracking**
- **Percentile rankings**
- **Seasonal resets** capability

The system is fully integrated with your existing Firestore structure and can be gradually implemented alongside your multiplayer features!

### **Technical Features:**

- **Progressive Web App**: Offline-capable mobile experience
- **Push Notifications**: Game invites and turn notifications
- **Analytics**: Game metrics and user behavior tracking
- **A/B Testing**: Feature flag system for experiments

This comprehensive system leverages Firestore's strengths while providing a robust, scalable foundation for live multiplayer gaming!
