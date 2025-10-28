import React, { useState, useEffect } from "react";
import { Client } from "@heroiclabs/nakama-js";
import { HOST } from "../nakama/nakamaHelper";

export default function TicTacToe({ name }) {
  const [client] = useState(() => new Client("defaultkey", HOST, "7350", false));
  const [socket, setSocket] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [matchFound, setMatchFound] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [board, setBoard] = useState(Array(9).fill(0)); // 0=empty,1=X,2=O
  const [turn, setTurn] = useState(1);
  const [playerNum, setPlayerNum] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [winner, setWinner] = useState(null);
  const [gameOver, setGameOver] = useState(false);

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matchmakingFailed, setMatchmakingFailed] = useState(false);

  const displayMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 4000);
  };

  useEffect(() => {
    if (!name) return;
    let countdown;
    let timeout;

    async function connect() {
      try {
        setIsLoading(true);
        console.log("🔌 Connecting to Nakama...");

        const session = await client.authenticateDevice(`device-${name}`, true);
        const s = client.createSocket(false, false);
        await s.connect(session, true);
        setSocket(s);

        console.log("🎯 Added to matchmaking...");
        const t = await s.addMatchmaker("*", 2, 2, {}, {});
        setTicket(t);

        countdown = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(countdown);
              if (!matchFound) cancelQueue(s, t);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        timeout = setTimeout(async () => {
          if (!matchFound) {
            await cancelQueue(s, t);
            setMatchmakingFailed(true);
            displayMessage("⏰ No opponent found in 30 seconds.");
          }
        }, 30000);

        s.onmatchmakermatched = async (matched) => {
          clearInterval(countdown);
          clearTimeout(timeout);
          setIsLoading(false);
          setMatchFound(true);
          setMatchmakingFailed(false);
          setMatchId(matched.match_id);

          console.log("✅ Match found! Joining match:", matched.match_id);
          await s.joinMatch(matched.match_id);
        };

        s.onmatchdata = (data) => {
          try {
            const msg = JSON.parse(new TextDecoder().decode(data.data));
            console.log("📨 Match update:", msg);

            switch (msg.type) {
              case "init_roles":
                if (msg.p1 === session.user_id) setPlayerNum(1);
                else if (msg.p2 === session.user_id) setPlayerNum(2);
                console.log("🎭 Role set -> Player", msg.p1 === session.user_id ? "1 (X)" : "2 (O)");
                break;

              case "update":
                updateBoard(msg);
                break;

              case "game_over":
                updateBoard(msg);
                setWinner(msg.winner);
                setGameOver(true);
                break;

              case "error":
                displayMessage(`🚨 ${msg.error}`);
                break;

              default:
                console.log("📦 Unknown message:", msg);
            }
          } catch (e) {
            console.error("Failed to parse match data:", e);
          }
        };
      } catch (err) {
        console.error("❌ Connection error:", err);
        setIsLoading(false);
        displayMessage("❌ Connection failed. Check console for details.");
      }
    }

    async function cancelQueue(s, t) {
      try {
        console.log("🚫 Cancelling matchmaking...");
        if (t && s) await s.removeMatchmaker(t.ticket);
        setTicket(null);
        setIsLoading(false);
      } catch (err) {
        console.error("Error cancelling queue:", err);
      }
    }

    connect();

    return () => {
      clearInterval(countdown);
      clearTimeout(timeout);
      if (socket) socket.close();
    };
  }, [name, client]);

  const updateBoard = (msg) => {
    if (msg.board) {
      const flat = msg.board.flat();
      setBoard(flat);
    }
    if (msg.next_turn) setTurn(msg.next_turn);
  };

  const makeMove = async (index) => {
    if (!matchFound || !socket || gameOver || board[index] !== 0) return;

    const x = Math.floor(index / 3);
    const y = index % 3;

    if (turn !== playerNum) {
      displayMessage("⏸️ It's not your turn!");
      return;
    }

    const newBoard = [...board];
    newBoard[index] = playerNum;
    setBoard(newBoard);
    setTurn(playerNum === 1 ? 2 : 1);

    const msg = JSON.stringify({ x, y });
    console.log("📤 Sending move:", msg);
    await socket.sendMatchState(matchId, 1, msg);
  };

  const symbolFor = (val) => (val === 1 ? "X" : val === 2 ? "O" : "");

  const Cell = ({ value, index }) => (
    <div
      className={`flex items-center justify-center text-4xl font-extrabold cursor-pointer transition-colors duration-200
        aspect-square border-2 border-slate-600
        ${value === 0 && turn === playerNum && !gameOver ? 'hover:bg-indigo-100 active:bg-indigo-200' : ''}
        ${value === 1 ? 'text-blue-600' : value === 2 ? 'text-red-600' : 'text-gray-300'}`}
      onClick={() => makeMove(index)}
    >
      {symbolFor(value)}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      <div className="bg-white shadow-2xl rounded-xl p-8 max-w-md w-full my-8">
        <h1 className="text-4xl font-bold text-center text-indigo-700 mb-6 border-b-2 border-indigo-200 pb-2">
          Nakama Tic-Tac-Toe
        </h1>

        {message && (
          <div className="p-3 mb-4 bg-yellow-100 text-yellow-800 rounded-lg text-center font-medium">
            {message}
          </div>
        )}

        {/* Waiting for match */}
        {!matchFound && ticket && !matchmakingFailed && (
          <div className="text-center p-6 bg-indigo-50 rounded-lg shadow-inner">
            <p className="text-lg font-bold text-indigo-700">🎟️ Matchmaking Ticket</p>
            <p className="text-sm text-gray-600 mt-1 break-all">{ticket.ticket}</p>
            <p className="mt-4 text-indigo-600 font-semibold">Waiting for opponent...</p>
            <p className="text-gray-500 text-sm mt-1">Time left: {timeLeft}s</p>
          </div>
        )}

        {/* Matchmaking failed */}
        {matchmakingFailed && (
          <div className="text-center p-6 bg-red-50 rounded-lg shadow-inner">
            <p className="text-red-600 font-semibold">❌ Matchmaking Failed</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* In game */}
        {matchFound && !gameOver && (
          <>
            <div className="text-center mb-6">
              <p className="text-xl font-bold">
                You are Player {playerNum ?? "?"} ({playerNum === 1 ? "X" : "O"})
              </p>
              <p
                className={`text-2xl font-semibold mt-2 p-2 rounded-full inline-block ${
                  turn === playerNum
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {turn === playerNum ? "🟢 Your Turn" : "⚪ Opponent’s Turn"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1 p-2 bg-slate-300 rounded-lg shadow-inner">
              {board.map((cell, index) => (
                <Cell key={index} value={cell} index={index} />
              ))}
            </div>
          </>
        )}

        {/* Game Over */}
        {gameOver && (
          <div className="text-center p-8 bg-indigo-100 rounded-lg shadow-xl">
            <h2 className="text-3xl font-extrabold text-indigo-700 mb-3">🏁 Game Over!</h2>
            {winner === 0 ? (
              <p className="text-2xl text-gray-800">🤝 Draw!</p>
            ) : (
              <p className="text-2xl font-bold text-green-600">
                🏆 Player {winner} ({symbolFor(winner)}) Wins!
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150"
            >
              Play Again
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-6 pt-4 border-t border-gray-100">
          This game uses Nakama for real-time multiplayer networking.
        </p>
      </div>
    </div>
  );
}
