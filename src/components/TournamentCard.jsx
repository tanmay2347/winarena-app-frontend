export default function TournamentCard({
  id,
  game,
  mode,
  entry,
  prize,
  image,
  onJoin // 👈 Ek optional prop jo parent se aayega
}) {
  return (
    <div className="tournament-card">
      <div className="tournament-image">
        <img src={image} alt={game} />
        <span className="live-tag">
          ● LIVE
        </span>
      </div>

      <div className="tournament-info">
        <h3>{game}</h3>
        <p>{mode}</p>

        <div className="tournament-stats">
          <div>
            <small>Entry Fee</small>
            <strong>₹{entry}</strong>
          </div>

          <div>
            <small>Prize Pool</small>
            <strong>₹{prize}</strong>
          </div>
        </div>

        <button 
          className="join-btn"
          onClick={() => {
            if (onJoin) {
              onJoin(id, entry); // Parent component ko call karega
            } else {
              alert(`Joining ${game} tournament for ₹${entry}!`);
            }
          }}
        >
          JOIN NOW
        </button>
      </div>
    </div>
  );
}