import React, { useEffect, useState } from 'react';

const TIERS = [
  { fee: 2, label: 'Casual', hue: 'blue' },
  { fee: 5, label: 'Regular', hue: 'green' },
  { fee: 10, label: 'Serious', hue: 'purple' },
  { fee: 25, label: 'High stakes', hue: 'gold' }
];

const payout = (fee) => Math.round(fee * 2 * 0.95 * 100) / 100;

export default function Lobby({
  player, balance, queues = {}, searching, onFind, onBot, onCancel, onRename
}) {
  const [name, setName] = useState(player?.name || '');
  const [top, setTop] = useState([]);

  useEffect(() => { setName(player?.name || ''); }, [player?.name]);
  useEffect(() => {
    let alive = true;
    fetch('/api/leaderboard').then(r => r.json()).then(d => alive && setTop(d.top || [])).catch(() => {});
    return () => { alive = false; };
  }, [player?.stats?.games]);

  return (
    <div className="lobby">
      <div className="lobby-hero">
        <h1>Carrom Arena</h1>
        <p>
          Pick an entry fee, get matched with a real player at the <b>same fee</b>, and race to pot
          all nine of your coins — then cover the queen to take the pot.
        </p>
      </div>

      {searching ? (
        <div className="searching">
          <div className="radar" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3>Searching for a ₹{searching.fee} match…</h3>
            <p>
              {(queues[searching.fee] || 0) > 1
                ? `${queues[searching.fee]} players in this pool · you are #${searching.position}`
                : 'Waiting for another player to join this pool…'}
            </p>
          </div>
          <button className="btn ghost" onClick={onCancel}>Cancel search</button>
        </div>
      ) : (
        <>
          <div className="section-title">Choose your entry fee</div>
          <div className="tiers">
            {TIERS.map(t => {
              const waiting = (queues && queues[t.fee]) || 0;
              const afford = balance >= t.fee;
              return (
                <div key={t.fee} className={`tier fee${t.fee}`}>
                  <div className="tier-top">
                    <div>
                      <div className="tier-fee"><span>₹</span>{t.fee}</div>
                      <div className="tier-label">{t.label} · wins ₹{payout(t.fee)}</div>
                    </div>
                    <div className={`waiting-pill ${waiting > 0 ? 'live' : ''}`}>
                      <span className="dot" />{waiting} waiting
                    </div>
                  </div>
                  <div className="tier-actions">
                    <button className="btn" disabled={!afford} onClick={() => onFind(t.fee)}>
                      Find match
                    </button>
                    <button className="btn ghost" disabled={!afford} onClick={() => onBot(t.fee)} title="Play a practice game against the bot">
                      🤖
                    </button>
                  </div>
                  <div className="tier-foot">
                    <span>Entry ₹{t.fee} · pot ₹{t.fee * 2}</span>
                    <span>{afford ? 'Wallet OK' : 'Low balance'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="lobby-cols">
        <div>
          <div className="section-title">Your account</div>
          <div className="panel card-pad">
            <div className="profile-row">
              <input
                className="field"
                value={name}
                maxLength={16}
                onChange={e => setName(e.target.value)}
                onBlur={() => onRename(name)}
                placeholder="Your name"
              />
              <button className="btn ghost" onClick={() => onRename(name)}>Save</button>
            </div>
            <div className="stat-grid">
              <div className="stat"><b>{player?.stats?.games ?? 0}</b><span>Boards</span></div>
              <div className="stat"><b>{player?.stats?.wins ?? 0}</b><span>Wins</span></div>
              <div className="stat"><b>₹{player?.stats?.pots ?? 0}</b><span>Won</span></div>
              <div className="stat"><b>{player?.stats?.coinsPocketed ?? 0}</b><span>Coins</span></div>
            </div>
            <p style={{ color: 'var(--dim)', fontSize: 12.5, marginBottom: 0, lineHeight: 1.6, marginTop: 14 }}>
              New accounts start with a ₹100 demo wallet. The platform keeps 5% of every pot.
              You are never matched with yourself — the queue holds one seat per player.
            </p>
          </div>

          <div className="section-title">How to play</div>
          <div className="panel card-pad">
            <ul className="rules-list">
              <li><span className="rule-ic">🎯</span><span><b>Win the board</b> — pocket all nine of your coins, then cover the white queen in the same shot.</span></li>
              <li><span className="rule-ic">↩️</span><span><b>Break shot</b> — place the striker on the diagonal, outside the inner circle, and scatter the medallion.</span></li>
              <li><span className="rule-ic">✨</span><span><b>Cover & continue</b> — every time you pot your own coin or the queen you keep the striker and shoot again.</span></li>
              <li><span className="rule-ic">⚠️</span><span><b>Fouls cost you</b> — pocketing the opponent's coin, dropping the striker or leaving the queen uncovered gives the opponent a point.</span></li>
              <li><span className="rule-ic">🪨</span><span><b>Slugs</b> — each pocketed coin drops a carrom man on the board. Use them to block your rival.</span></li>
            </ul>
          </div>
        </div>

        <div>
          <div className="section-title">Live leaderboard</div>
          <div className="panel card-pad" style={{ minHeight: 180 }}>
            {top.length === 0 ? (
              <div className="empty">No players yet — be the first!</div>
            ) : top.map((p, i) => (
              <div className="lb-row" key={p.id}>
                <div className="lb-rank">{i + 1}</div>
                <div className="lb-name">{p.name}{p.id === player?.id ? ' (you)' : ''}</div>
                <div className="tag blue">{p.stats.wins}W</div>
                <div className="lb-val">₹{p.balance}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}