import React, { useEffect, useRef, useState } from 'react';
import Board from './Board.jsx';
import { sfx } from "./sfx.js";

const TIERS = [2, 5, 10, 25];

function Pips({ p }) {
  return (
    <div className="pips">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className={`pip ${i < p.pocketed ? 'on' : ''} ${p.color}`} />
      ))}
      <div className={`pip ${p.coveredQueen ? 'on' : ''} WHITE`} title="Queen" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={'f' + i} className={`pip ${i < p.fouls ? 'foul' : ''}`} title="Foul" />
      ))}
    </div>
  );
}

function PlayerCard({ p, isMe, active, connected }) {
  return (
    <div className={`pcard ${p.color} ${active ? 'active' : ''}`}>
      <div className="pcard-head">
        <div className="avatar">{(p.name || '?').slice(0, 1).toUpperCase()}</div>
        <div className="pcard-id">
          <div className="pcard-name">
            {p.name}{isMe ? ' (you)' : ''}
            {p.isBot ? <span className="tag" style={{ padding: '1px 6px', fontSize: 9 }}>BOT</span> : null}
          </div>
          <div className="pcard-role">
            {p.color === 'RED' ? '🔴 Red' : '⚫ Black'} · {isMe ? 'your side' : 'opponent'}
          </div>
        </div>
        <div className="pcard-score">
          <b>{p.score}</b>
          <span>points</span>
        </div>
      </div>
      <Pips p={p} />
      <div className="meta-row">
        <span className="tag">{p.pocketed}/9 pocketed</span>
        {p.coveredQueen ? <span className="tag gold">👑 queen covered</span> : null}
        {p.fouls > 0 ? <span className="tag red">{p.fouls} foul{p.fouls > 1 ? 's' : ''}</span> : null}
        {isMe ? (
          <span className="tag green">online</span>
        ) : (
          <span className={`tag ${connected ? 'green' : 'red'}`}>
            <span className={`dot ${connected ? 'pulse' : ''}`} />{connected ? 'online' : 'disconnected'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function GameView({
  room, game, me, live, onPlace, onShoot, onLeave, onRematch,
  soundOn, toggleSound, soundRef, chat, onSend, opponentConnected, result
}) {
  const [msg, setMsg] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [nextFee, setNextFee] = useState(room.fee);
  const chatRef = useRef(null);

  useEffect(() => { setNextFee(room.fee); }, [room.fee]);
  useEffect(() => {
    if (result) {
      setShowResult(true);
      const won = result.winnerId === me;
      if (won) sfx.win(); else if (!result.winnerId) sfx.click(); else sfx.lose();
    }
  }, [result]);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

  const opp = game.players.find(p => p.id !== me);
  const my = game.players.find(p => p.id === me);
  const myTurn = game.turn === me;
  const finished = game.status === 'over';

  const hint = finished
    ? 'Game over'
    : myTurn
      ? (game.phase === 'shot'
        ? '🔥 Striker in motion…'
        : game.strikerPlaced
          ? 'Drag the striker backwards, then release to shoot'
          : game.isBreak
            ? 'Break shot — place the striker on the green diagonal, outside the circle'
            : 'Drag anywhere on the board to place your striker')
      : `${opp?.name || 'Opponent'} is ${game.phase === 'shot' ? 'shooting' : 'placing the striker'}…`;

  const meOut = result ? (result.a.id === me ? result.a : result.b) : null;

  return (
    <div className="game">
      <div className="game-bar">
        <div className="tag blue">Board #{room.id}</div>
        <div className="tag gold">Entry ₹{room.fee}</div>
        <div className="pot"><span className="coin" />Pot ₹{room.pot}</div>
        <div className="tag">5% platform fee</div>
        <div className="spacer" />
        {game.queenShowdown && !finished ? <div className="tag red">👑 Only the queen is left!</div> : null}
        <button className={`icon-btn ${soundOn ? '' : 'off'}`} onClick={toggleSound} title="Toggle sound">
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button className="btn ghost sm" onClick={() => { if (confirm('Leave the game? You will forfeit the pot.')) onLeave(); }}>
          Leave
        </button>
      </div>

      <div className="game-main">
        <div className="board-wrap">
          <div className={`turn-banner ${myTurn ? 'mine' : 'theirs'}`}>
            {myTurn
              ? <><span className="dot pulse" style={{ color: '#2ee6a8' }} /> Your turn — {my?.color === 'RED' ? 'Red' : 'Black'}</>
              : <><span className="dot pulse" style={{ color: '#ff5470' }} /> {opp?.name}'s turn</>}
          </div>
          <Board
            live={live}
            me={me}
            onPlace={onPlace}
            onShoot={onShoot}
            soundRef={soundRef}
          />
          <div className="hint">{hint}</div>
        </div>

        <div className="side">
          {game.players
            .slice()
            .sort((a, b) => (a.id === me ? 1 : 0) - (b.id === me ? 1 : 0))
            .map(p => (
              <PlayerCard
                key={p.id}
                p={p}
                isMe={p.id === me}
                active={p.id === game.turn}
                connected={p.id === me ? true : opponentConnected}
              />
            ))}

          <div className="panel card-pad">
            <div className="section-title" style={{ margin: '0 0 10px' }}>Match log</div>
            <div className="log-list">
              {game.log.map((l, i) => (
                <div key={i} className={`log-item ${l.kind}`}>{l.text}</div>
              ))}
            </div>
          </div>

          <div className="panel card-pad chat">
            <div className="section-title" style={{ margin: '0 0 10px' }}>Chat</div>
            <div className="chat-log" ref={chatRef}>
              {chat.length === 0 ? <div className="empty">Say hello 👋</div> : chat.map((c, i) => (
                <div className="chat-msg" key={i}>
                  <b>{c.name.split(' ')[0]}:</b> {c.text}
                </div>
              ))}
            </div>
            <form className="chat-form" onSubmit={e => { e.preventDefault(); if (msg.trim()) { onSend(msg.trim()); setMsg(''); } }}>
              <input value={msg} onChange={e => setMsg(e.target.value)} maxLength={140} placeholder="Type a message…" />
              <button className="btn ghost sm" type="submit">Send</button>
            </form>
          </div>
        </div>
      </div>

      {showResult && result && (
        <div className="overlay">
          <div className="modal">
            <div style={{ fontSize: 40 }}>{result.winnerId ? (result.winnerId === me ? '🏆' : '😔') : '🤝'}</div>
            <h2>{result.winnerId === me ? 'You won!' : result.winnerId ? `${result.players.find(p => p.id === result.winnerId)?.name} wins` : 'Draw!'}</h2>
            <p className="sub">{result.reason}</p>

            <div className="big" style={{ color: result.winnerId === me ? 'var(--green)' : 'var(--muted)' }}>
              {meOut?.amount ? `+₹${meOut.amount}` : '₹0'}
            </div>
            <p style={{ color: 'var(--dim)', fontSize: 12.5, margin: '4px 0 16px' }}>
              New balance ₹{meOut?.balance ?? 0}
            </p>

            <div style={{ textAlign: 'left' }}>
              {(result.a ? [result.a, result.b] : []).map((r, i) => (
                <div className="payout-row" key={i}>
                  <span>{r.name}{r.id === me ? ' (you)' : ''} {r.won ? '🏆' : ''}</span>
                  <b style={{ color: r.amount ? 'var(--green)' : 'var(--dim)' }}>
                    {r.amount ? `+₹${r.amount}` : '₹0'}
                  </b>
                </div>
              ))}
              <div className="payout-row">
                <span>Pot / platform</span>
                <b>₹{result.pot} / ₹{result.platformFee}</b>
              </div>
            </div>

            <div className="section-title" style={{ margin: '18px 0 8px', justifyContent: 'center' }}>Rematch entry</div>
            <div className="tier-picker">
              {TIERS.map(t => (
                <div
                  key={t}
                  className={`tier-chip ${nextFee === t ? 'sel' : ''}`}
                  onClick={() => setNextFee(t)}
                >₹{t}</div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => { setShowResult(false); onLeave(true); }}>Back to lobby</button>
              <button className="btn green" onClick={() => { setShowResult(false); onRematch(nextFee); }}>
                Rematch ₹{nextFee}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
