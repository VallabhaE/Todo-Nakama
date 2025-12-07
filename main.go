package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"sync"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

type Box struct {
	board     [3][3]int
	moves     int
	turn      int // 1 or 2 (whose turn)
	playerIDs [2]string
}

var (
	GlobalMatchMap = make(map[string]*Box)
	Sockets        = make(map[string][]runtime.Presence)
	globalMu       sync.Mutex
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Backend module loaded")

	if err := initializer.RegisterMatch("xoxo", newMatch); err != nil {
		logger.Error("Failed to register match:", err)
		return err
	}
	if err := initializer.RegisterMatchmakerMatched(MatchmakerMatched); err != nil {
		logger.Error("Failed to register matchmaker callback:", err)
		return err
	}

	logger.Info(" Match type 'xoxo' registered")
	return nil
}

type match struct {
	matchid string
}

func newMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
	return &match{}, nil
}

func (m *match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	m.matchid = "match-" + strconv.FormatInt(time.Now().UnixNano(), 10)

	globalMu.Lock()
	GlobalMatchMap[m.matchid] = &Box{turn: 1}
	Sockets[m.matchid] = []runtime.Presence{}
	globalMu.Unlock()

	logger.Info("Match initialized:", m.matchid)
	return map[string]interface{}{}, 1, "xoxo"
}

func (m *match) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB,
	nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher,
	tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {

	globalMu.Lock()
	count := len(Sockets[m.matchid])
	globalMu.Unlock()

	if count >= 2 {
		return state, false, "Match full"
	}
	return state, true, ""
}

func (m *match) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB,
	nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher,
	tick int64, state interface{}, presences []runtime.Presence) interface{} {

	globalMu.Lock()
	for _, p := range presences {
		Sockets[m.matchid] = append(Sockets[m.matchid], p)
		box := GlobalMatchMap[m.matchid]
		if len(Sockets[m.matchid]) <= 2 {
			box.playerIDs[len(Sockets[m.matchid])-1] = p.GetUserId()
		}
	}
	playerCount := len(Sockets[m.matchid])
	globalMu.Unlock()

	// Notify about player joined
	joinMsg := map[string]interface{}{
		"type":         "player_joined",
		"player_count": playerCount,
	}
	data, _ := json.Marshal(joinMsg)
	dispatcher.BroadcastMessage(1, data, nil, nil, true)

	if playerCount == 2 {
		box := GlobalMatchMap[m.matchid]
		initMsg := map[string]interface{}{
			"type": "init_roles",
			"p1":   box.playerIDs[0],
			"p2":   box.playerIDs[1],
		}
		initData, _ := json.Marshal(initMsg)
		dispatcher.BroadcastMessage(1, initData, nil, nil, true)
		logger.Info("🎮 Sent role assignment for match:", m.matchid)
	}

	return state
}

func (m *match) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB,
	nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher,
	tick int64, state interface{}, presences []runtime.Presence) interface{} {

	globalMu.Lock()
	for _, p := range presences {
		players := Sockets[m.matchid]
		for i, player := range players {
			if player.GetUserId() == p.GetUserId() {
				Sockets[m.matchid] = append(players[:i], players[i+1:]...)
				break
			}
		}
	}
	playerCount := len(Sockets[m.matchid])
	globalMu.Unlock()

	leaveMsg := map[string]interface{}{
		"type":         "player_left",
		"player_count": playerCount,
	}
	data, _ := json.Marshal(leaveMsg)
	dispatcher.BroadcastMessage(2, data, nil, nil, true)

	return state
}

type Move struct {
	X int `json:"x"`
	Y int `json:"y"`
}

func (m *match) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB,
	nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher,
	tick int64, state interface{}, messages []runtime.MatchData) interface{} {

	for _, msg := range messages {
		sender := msg.GetUserId()
		var move Move
		if err := json.Unmarshal(msg.GetData(), &move); err != nil {
			logger.Error("Invalid move format:", err)
			continue
		}

		globalMu.Lock()
		box := GlobalMatchMap[m.matchid]
		playerIndex := -1
		for i, id := range box.playerIDs {
			if id == sender {
				playerIndex = i + 1 // 1 or 2
				break
			}
		}

		if playerIndex == -1 {
			globalMu.Unlock()
			continue
		}

		if playerIndex != box.turn {
			errMsg := map[string]interface{}{
				"type":  "error",
				"error": "Not your turn",
			}
			data, _ := json.Marshal(errMsg)
			dispatcher.BroadcastMessage(3, data, []runtime.Presence{msg}, nil, true)
			globalMu.Unlock()
			continue
		}

		// Validate move
		if move.X < 0 || move.X >= 3 || move.Y < 0 || move.Y >= 3 || box.board[move.X][move.Y] != 0 {
			errMsg := map[string]interface{}{
				"type":  "error",
				"error": "Invalid move",
			}
			data, _ := json.Marshal(errMsg)
			dispatcher.BroadcastMessage(3, data, []runtime.Presence{msg}, nil, true)
			globalMu.Unlock()
			continue
		}

		// Apply move
		box.board[move.X][move.Y] = playerIndex
		box.moves++

		winner := checkWinner(box.board)
		draw := (winner == 0 && box.moves == 9)

		resp := map[string]interface{}{
			"type":   "update",
			"x":      move.X,
			"y":      move.Y,
			"player": playerIndex,
			"board":  box.board,
		}

		if winner != 0 {
			resp["type"] = "game_over"
			resp["winner"] = winner
		} else if draw {
			resp["type"] = "game_over"
			resp["winner"] = 0
		} else {
			// Switch turn
			if box.turn == 1 {
				box.turn = 2
			} else {
				box.turn = 1
			}
			resp["next_turn"] = box.turn
		}

		data, _ := json.Marshal(resp)
		dispatcher.BroadcastMessage(4, data, nil, nil, true) // Broadcast to all

		globalMu.Unlock()
	}

	return state
}

func checkWinner(b [3][3]int) int {
	for i := 0; i < 3; i++ {
		if b[i][0] != 0 && b[i][0] == b[i][1] && b[i][1] == b[i][2] {
			return b[i][0]
		}
		if b[0][i] != 0 && b[0][i] == b[1][i] && b[1][i] == b[2][i] {
			return b[0][i]
		}
	}
	if b[0][0] != 0 && b[0][0] == b[1][1] && b[1][1] == b[2][2] {
		return b[0][0]
	}
	if b[0][2] != 0 && b[0][2] == b[1][1] && b[1][1] == b[2][0] {
		return b[0][2]
	}
	return 0
}

func (m *match) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB,
	nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher,
	tick int64, state interface{}, graceSeconds int) interface{} {

	globalMu.Lock()
	delete(GlobalMatchMap, m.matchid)
	delete(Sockets, m.matchid)
	globalMu.Unlock()

	logger.Info("Match terminated:", m.matchid)
	return state
}

func (m *match) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB,
	nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher,
	tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

func MatchmakerMatched(ctx context.Context, logger runtime.Logger, db *sql.DB,
	nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {

	logger.Info("Matchmaker matched:", len(entries), "players")

	params := map[string]interface{}{
		"created_at": time.Now().Unix(),
	}
	matchID, err := nk.MatchCreate(ctx, "xoxo", params)
	if err != nil {
		return "", err
	}

	logger.Info("Created match:", matchID)
	return matchID, nil
}
