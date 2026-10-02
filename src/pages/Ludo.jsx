import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = "https://winarena-app-backend-gfxt.onrender.com";

export default function Ludo() {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [inGame, setInGame] = useState(false);
  const [room, setRoom] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedFee, setSelectedFee] = useState(5);
  
  const userName = localStorage.getItem("userName") || "Player";
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem("walletBalance");
    return saved ? parseFloat(saved) : 500.00;
  });

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("login", userName, (res) => {
        if (res && res.balance !== undefined) {
          setBalance(res.balance);
          localStorage.setItem("walletBalance", res.balance.toFixed(2));
        }
      });
    });

    newSocket.on("searching", () => {
      setSearching(true);
    });

    newSocket.on("room", (roomData) => {
      setRoom(roomData);
      setInGame(true);
      setSearching(false);
    });

    newSocket.on("wallet", (newBal) => {
      setBalance(newBal);
      localStorage.setItem("walletBalance", newBal.toFixed(2));
      window.dispatchEvent(new Event("storage"));
    });

    newSocket.on("error_msg", (msg) => {
      alert(msg);
      setSearching(false);
    });

    return () => newSocket.disconnect();
  }, [userName]);

  const handleStartSearch = (fee) => {
    if (balance < fee) {
      alert("Insufficient wallet balance! Please add funds.");
      navigate("/wallet");
      return;
    }
    setSelectedFee(fee);
    if (socket) {
      socket.emit("search", { game: "ludo", fee });
      setSearching(true);
    } else {
      alert("Socket connection not established!");
    }
  };

  const handleCancelSearch = () => {
    setSearching(false);
    if (socket) socket.emit("cancel");
  };

  const handleRollDice = () => {
    if (socket) socket.emit("roll");
  };

  const handleMoveToken = (tokenIndex) => {
    if (socket) socket.emit("move", tokenIndex);
  };

  return (
    <div style={{ padding: "20px", color: "#fff", background: "#0f172a", minHeight: "100vh", maxWidth: "500px", margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* TOP HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button 
          onClick={() => navigate("/games")} 
          style={{ background: "#7c3aed", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
        >
          ← Games
        </button>
        <div style={{ background: "rgba(251, 191, 36, 0.15)", border: "1px solid #fbbf24", padding: "6px 14px", borderRadius: "20px", color: "#fbbf24", fontWeight: "900", fontSize: "13px" }}>
          ₹{balance.toFixed(2)}
        </div>
      </div>

      {!inGame ? (
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", color: "#fbbf24", fontWeight: "900", marginBottom: "8px" }}>🎲 LUDO BATTLE</h1>
          <p style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "30px" }}>Select entry fee to find live players or bots.</p>

          {searching ? (
            <div style={{ background: "#1e1b4b", padding: "30px", borderRadius: "16px", border: "2px solid #38bdf8" }}>
              <div style={{ fontSize: "24px", marginBottom: "10px" }}>🔍</div>
              <h3 style={{ color: "#38bdf8", marginBottom: "10px" }}>Finding Opponent...</h3>
              <p style={{ color: "#9ca3af", fontSize: "11px", marginBottom: "20px" }}>Matching with players or bot in ₹{selectedFee} battle.</p>
              <button 
                onClick={handleCancelSearch}
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "900", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              {[5, 10, 25, 50].map((fee) => (
                <div 
                  key={fee}
                  onClick={() => handleStartSearch(fee)}
                  style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)", border: "2px solid #38bdf8", padding: "20px", borderRadius: "16px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 15px rgba(56, 189, 248, 0.2)" }}
                >
                  <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: "700" }}>ENTRY FEE</span>
                  <h2 style={{ fontSize: "24px", color: "#fbbf24", margin: "6px 0", fontWeight: "900" }}>₹{fee}</h2>
                  <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: "800" }}>Win: ₹{Math.round(fee * 2 * 0.9)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* GAME BOARD & ROOM VIEW */
        <div style={{ background: "#1e1b4b", padding: "16px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", fontSize: "12px", fontWeight: "800" }}>
            <span style={{ color: "#ef4444" }}>🔴 {room.players[0]?.name}</span>
            <span style={{ color: "#fbbf24" }}>VS</span>
            <span style={{ color: "#eab308" }}>🟡 {room.players[1]?.name}</span>
          </div>

          <div style={{ background: "rgba(0,0,0,0.4)", padding: "12px", borderRadius: "10px", marginBottom: "14px", textAlign: "center", minHeight: "50px" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1" }}>{room.log[0]}</p>
          </div>

          {room.winner !== null ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <h2 style={{ color: "#22c55e", fontSize: "22px" }}>🏆 {room.players[room.winner].name} Won!</h2>
              <button 
                onClick={() => setInGame(false)}
                style={{ background: "#7c3aed", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "900", marginTop: "15px", cursor: "pointer" }}
              >
                Play Again
              </button>
            </div>
          ) : (
            <div>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <span style={{ fontSize: "12px", color: "#9ca3af", display: "block", marginBottom: "6px" }}>
                  Turn: <strong style={{ color: "#fff" }}>{room.players[room.turn]?.name}</strong>
                </span>
                <div style={{ fontSize: "32px", fontWeight: "900", color: "#fbbf24", margin: "10px 0" }}>
                  🎲 {room.dice !== null ? room.dice : "-"}
                </div>
                {!room.rolled && (
                  <button 
                    onClick={handleRollDice}
                    style={{ background: "#22c55e", color: "#000", border: "none", padding: "10px 24px", borderRadius: "10px", fontWeight: "900", cursor: "pointer" }}
                  >
                    ROLL DICE 🎲
                  </button>
                )}
              </div>

              {room.movable && room.movable.length > 0 && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "11px", color: "#38bdf8", marginBottom: "8px" }}>Click a token to move:</p>
                  <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                    {room.movable.map((tokenIdx) => (
                      <button 
                        key={tokenIdx}
                        onClick={() => handleMoveToken(tokenIdx)}
                        style={{ background: "#7c3aed", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "900", cursor: "pointer" }}
                      >
                        Token #{tokenIdx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}