import React, { useState, useEffect } from "react";
import Lobby from "./carrom/Lobby";
import GameView from "./carrom/GameView";
import socket from "./carrom/socket";
import "./carrom/styles.css";

export default function CarromGame() {
  const [inGame, setInGame] = useState(false);
  const [roomData, setRoomData] = useState(null);
  
  // 💰 Main WinArena Wallet se Balance Load Karna
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem("walletBalance");
    return saved ? parseFloat(saved) : 100.00; // Default 100 agar na ho
  });

  const [player, setPlayer] = useState({ 
    name: localStorage.getItem("userName") || "Player", 
    stats: { games: 0, wins: 0, pots: 0, coinsPocketed: 0 } 
  });
  const [queues, setQueues] = useState({});
  const [searching, setSearching] = useState(null);

  // 🔄 Main WinArena Wallet ke sath balance sync karne ka function
  const updateWalletBalance = (newBalance) => {
    const formatted = parseFloat(newBalance).toFixed(2);
    setBalance(parseFloat(formatted));
    localStorage.setItem("walletBalance", formatted);
    // Trigger custom event taaki header ya wallet page turant update ho jaye
    window.dispatchEvent(new Event("storage"));
  };

  useEffect(() => {
    socket.connect();

    // Send hello to backend with player name
    socket.emit("hello", { name: player.name });

    socket.on("room:found", (data) => {
      setRoomData(data.room);
      setInGame(true);
      setSearching(null);
    });

    socket.on("room:left", () => {
      setInGame(false);
      setRoomData(null);
      setSearching(null);
    });

    // 🔄 Queue update from backend
    socket.on("queue:update", (qData) => {
      setQueues(qData.queues || {});
    });

    // 💰 Backend se balance update aane par main WinArena wallet ko sync karna
    socket.on("balance", (data) => {
      if (data && typeof data.balance === "number") {
        updateWalletBalance(data.balance);
      }
    });

    return () => {
      socket.off("room:found");
      socket.off("room:left");
      socket.off("queue:update");
      socket.off("balance");
      socket.disconnect();
    };
  }, []);

  // 🎮 Matchmaking Handlers
  const handleFindMatch = (fee) => {
    if (balance < fee) {
      alert("Low balance! Please add funds to your wallet.");
      return;
    }
    setSearching({ fee, position: 1 });
    socket.emit("queue:join", { fee });
  };

  const handleBotMatch = (fee) => {
    if (balance < fee) {
      alert("Low balance!");
      return;
    }
    socket.emit("bot:play", { fee });
  };

  const handleCancelSearch = () => {
    setSearching(null);
    socket.emit("queue:leave");
  };

  const handleRename = (newName) => {
    setPlayer(prev => ({ ...prev, name: newName }));
    localStorage.setItem("userName", newName);
  };

  return (
    <div className="carrom-app-container">
      {!inGame ? (
        <Lobby
          socket={socket}
          player={player}
          balance={balance}
          queues={queues}
          searching={searching}
          onFind={handleFindMatch}
          onBot={handleBotMatch}
          onCancel={handleCancelSearch}
          onRename={handleRename}
        />
      ) : (
        <GameView socket={socket} initialRoom={roomData} />
      )}
    </div>
  );
}