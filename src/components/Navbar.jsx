import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  WalletCards
} from "lucide-react";

export default function Navbar() {
  const navigate = useNavigate();

  // 💰 LocalStorage se real wallet balance fetch karna
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem("walletBalance");
    return saved ? parseFloat(saved).toFixed(2) : "0.00";
  });

  useEffect(() => {
    // 🔄 Balance sync handle karne ke liye event listener
    const handleStorageChange = () => {
      const saved = localStorage.getItem("walletBalance");
      if (saved) {
        setBalance(parseFloat(saved).toFixed(2));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Custom interval ya focus listener bhi rakh sakte hain instant update ke liye
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="navbar">
      <div className="brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
        <img src="/logo.png" alt="WinArena" style={{ height: "35px" }} />
      </div>

      <div className="nav-right">
        {/* 💰 Wallet par click karne se /wallet page par chale jayenge */}
        <div 
          className="wallet-mini" 
          style={{ padding: "6px 12px", cursor: "pointer" }}
          onClick={() => navigate("/wallet")}
        >
          <WalletCards size={19} />
          <div className="wallet-text">
            <small>Wallet</small>
            <strong>₹{balance}</strong>
          </div>
        </div>

        <button className="icon-btn" onClick={() => alert("No new notifications!")}>
          <Bell size={21} />
          <span className="notification-dot" />
        </button>

        <div className="avatar" onClick={() => navigate("/profile")} style={{ cursor: "pointer" }}>
          👤
        </div>
      </div>
    </header>
  );
}