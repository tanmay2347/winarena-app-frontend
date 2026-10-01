import React, { useEffect, useRef, useState } from "react";
import { 
  BOARD, FRAME, PLAY_MIN, PLAY_MAX, MID, POCKETS, 
  RED, BLACK, QUEEN, isLegalPlacement, isLegalBreak, clamp 
} from "./carrom.js";
import { sfx } from "./sfx.js";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PALETTE = {
  RED: { a: '#ff9cb0', b: '#e11d48', c: '#7c0a20', ring: 'rgba(255,120,150,0.85)' },
  BLACK: { a: '#8b97b0', b: '#2b3446', c: '#0b0f18', ring: 'rgba(160,175,205,0.7)' },
  QUEEN: { a: '#ffffff', b: '#eef2f9', c: '#a9b3c6', ring: '#ff5470' }
};

export default function Board({ live, me, onPlace, onShoot, soundRef }) {
  const canvasRef = useRef(null);
  const modelRef = useRef({ map: new Map(), fx: [] });
  const dragRef = useRef({ mode: null, px: 0, py: 0, dx: 0, dy: 0, power: 0 });
  const localStriker = useRef(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [size, setSize] = useState(560);

  /* ---------------- responsive size ---------------- */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.parentElement?.clientWidth || 520;
      setSize(Math.max(260, Math.min(w, window.innerHeight * 0.7, 760)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.parentElement);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  /* ---------------- pointer input ---------------- */
  const toBoard = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * BOARD,
      y: ((e.clientY - r.top) / r.height) * BOARD
    };
  };

  const moveStriker = (x, y) => {
    const g = liveRef.current;
    const legal = g?.isBreak
      ? [0, 1, 2, 3].some(s => isLegalBreak(x, y, s))
      : isLegalPlacement(x, y);
    const cx = clamp(x, PLAY_MIN + STRIKER_R, PLAY_MAX - STRIKER_R);
    const cy = clamp(y, PLAY_MIN + STRIKER_R, PLAY_MAX - STRIKER_R);
    localStriker.current = { x: cx, y: cy, legal };
    onPlace(cx, cy);
  };

  const onPointerDown = (e) => {
    const g = liveRef.current;
    if (!g || g.phase !== 'place' || g.turn !== me) return;
    const { x, y } = toBoard(e);
    const st = localStriker.current || g.striker || { x: MID, y: PLAY_MAX - 8 };
    const d = dist(x, y, st.x, st.y);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    if (d < STRIKER_R + 4.2 && g.strikerPlaced) {
      dragRef.current = { mode: 'aim', px: x, py: y, dx: 0, dy: 0, power: 0 };
    } else {
      dragRef.current = { mode: 'place' };
      moveStriker(x, y);
    }
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag.mode) return;
    const { x, y } = toBoard(e);
    if (drag.mode === 'place') {
      moveStriker(x, y);
    } else {
      drag.px = x; drag.py = y;
      const g = liveRef.current;
      const st = localStriker.current || g.striker;
      if (!st) return;
      let dx = st.x - x, dy = st.y - y;
      const len = Math.hypot(dx, dy);
      if (len > 0.6) {
        dx /= len; dy /= len;
        drag.dx = dx; drag.dy = dy;
        drag.power = clamp((len - 2) / 34, 0.02, 1);
      }
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag.mode === 'place') {
      const p = localStriker.current;
      if (p) onPlace(p.x, p.y, true);
    } else if (drag.mode === 'aim' && drag.power > 0.03) {
      onShoot(drag.dx, drag.dy, drag.power);
      localStriker.current = null;
    }
    dragRef.current = { mode: null, dx: 0, dy: 0, power: 0 };
  };

  /* ---------------- render loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, last = performance.now();

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const px = Math.round(size * dpr);
      if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncModel(modelRef, liveRef.current, soundRef);
      draw(ctx, size, liveRef.current, me, modelRef, dragRef, localStriker, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, me]);

  return (
    <div className="board-shell">
      <canvas
        ref={canvasRef}
        className="board"
        width={size}
        height={size}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  model = smoothed piece positions driven by the authoritative state
 * ------------------------------------------------------------------ */
function syncModel(model, live, soundRef) {
  if (!live || !live.pieces) return;
  const map = model.map;
  const seen = new Set();
  for (const p of live.pieces) {
    seen.add(p.k);
    const cur = map.get(p.k);
    if (cur) {
      cur.tx = p.x; cur.ty = p.y;
      if (cur.color !== p.color) cur.color = p.color;
    } else {
      map.set(p.k, { key: p.k, color: p.color, kind: p.kind, x: p.x, y: p.y, tx: p.x, ty: p.y, dying: false });
    }
  }
  for (const [key, cur] of map) {
    if (!seen.has(key) && !cur.dying) {
      cur.dying = true;
      const pk = nearestPocket(cur.x, cur.y);
      cur.px = pk.x; cur.py = pk.y;
      model.fx.push({ x: cur.x, y: cur.y, r: cur.kind === 'slug' ? SLUG_R : COIN_R, t: 0 });
      if (soundRef?.current && cur.kind !== 'slug') sfx.pocket();
    }
  }
}

function nearestPocket(x, y) {
  let best = POCKETS[0], bd = 1e9;
  for (const p of POCKETS) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/* ------------------------------------------------------------------ */
function draw(ctx, size, g, me, model, dragRef, localStriker, dt) {
  const S = size / BOARD;
  ctx.save();
  ctx.scale(S, S);

  /* ------- wooden frame ------- */
  const frameGrad = ctx.createLinearGradient(0, 0, 100, 100);
  frameGrad.addColorStop(0, '#3d2517');
  frameGrad.addColorStop(0.5, '#2a1810');
  frameGrad.addColorStop(1, '#1c100a');
  ctx.fillStyle = frameGrad;
  roundRect(ctx, 0.4, 0.4, 99.2, 99.2, 3.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,196,101,0.2)';
  ctx.lineWidth = 0.35;
  ctx.stroke();

  /* ------- play surface ------- */
  ctx.save();
  roundRect(ctx, PLAY_MIN, PLAY_MIN, PLAY, PLAY, 1.5);
  ctx.clip();
  const wood = ctx.createLinearGradient(PLAY_MIN, PLAY_MIN, PLAY_MAX, PLAY_MAX);
  wood.addColorStop(0, '#eccb96');
  wood.addColorStop(0.4, '#dbb076');
  wood.addColorStop(0.72, '#cfa065');
  wood.addColorStop(1, '#bb8750');
  ctx.fillStyle = wood;
  ctx.fillRect(PLAY_MIN, PLAY_MIN, PLAY, PLAY);
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 0.22;
  for (let i = 0; i < 48; i++) {
    const y = PLAY_MIN + (i / 48) * PLAY + Math.sin(i * 1.7) * 0.45;
    ctx.beginPath();
    ctx.moveTo(PLAY_MIN, y);
    for (let x = PLAY_MIN; x <= PLAY_MAX; x += 5) ctx.lineTo(x, y + Math.sin(x * 0.2 + i) * 0.4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  roundRect(ctx, PLAY_MIN, PLAY_MIN, PLAY, PLAY, 1.5);
  ctx.strokeStyle = 'rgba(88,54,24,0.6)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  /* ------- markings ------- */
  ctx.strokeStyle = 'rgba(88,54,24,0.42)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(MID, MID, INNER_R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([1.1, 1.0]);
  ctx.strokeStyle = 'rgba(88,54,24,0.3)';
  ctx.lineWidth = 0.24;
  ctx.beginPath();
  ctx.moveTo(PLAY_MIN, PLAY_MIN); ctx.lineTo(PLAY_MAX, PLAY_MAX);
  ctx.moveTo(PLAY_MAX, PLAY_MIN); ctx.lineTo(PLAY_MIN, PLAY_MAX);
  ctx.stroke();
  ctx.restore();

  /* ------- pockets ------- */
  for (const p of POCKETS) {
    const grad = ctx.createRadialGradient(p.x, p.y - 0.4, 0.2, p.x, p.y, POCKET_R + 1.1);
    grad.addColorStop(0, '#000');
    grad.addColorStop(0.7, '#05070b');
    grad.addColorStop(1, 'rgba(5,7,11,0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R + 1.1, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R + 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#04060a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R + 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!g) { ctx.restore(); return; }

  const myTurn = g.turn === me && g.phase === 'place';

  /* ------- break zone hint ------- */
  if (myTurn && g.isBreak) {
    ctx.save();
    ctx.setLineDash([0.9, 0.9]);
    ctx.strokeStyle = 'rgba(20,120,90,0.6)';
    ctx.lineWidth = 0.5;
    const r = INNER_R + STRIKER_R + 0.5;
    ctx.beginPath();
    ctx.moveTo(MID + Math.SQRT2 * r, MID); ctx.lineTo(PLAY_MIN + STRIKER_R, MID);
    ctx.moveTo(MID - Math.SQRT2 * r, MID); ctx.lineTo(PLAY_MAX - STRIKER_R, MID);
    ctx.moveTo(MID, MID + Math.SQRT2 * r); ctx.lineTo(MID, PLAY_MIN + STRIKER_R);
    ctx.moveTo(MID, MID - Math.SQRT2 * r); ctx.lineTo(MID, PLAY_MAX - STRIKER_R);
    ctx.stroke();
    ctx.restore();
  }

  /* ------- pieces ------- */
  const k = 1 - Math.exp(-dt * 26);
  const slow = 1 - Math.exp(-dt * 10);
  for (const p of model.map.values()) {
    if (p.dying) { p.x += (p.px - p.x) * slow; p.y += (p.py - p.y) * slow; continue; }
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
  }
  for (const p of model.map.values()) {
    if (p.dying) continue;
    if (p.kind === 'slug') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, SLUG_R, 0, Math.PI * 2);
      const sg = ctx.createRadialGradient(p.x - 0.3, p.y - 0.3, 0.05, p.x, p.y, SLUG_R);
      sg.addColorStop(0, '#fffaf0');
      sg.addColorStop(1, '#b6a88f');
      ctx.fillStyle = sg;
      ctx.fill();
    } else {
      drawDisc(ctx, p.x, p.y, COIN_R, PALETTE[p.color] || PALETTE.QUEEN, p.color === QUEEN);
    }
  }

  /* ------- striker ------- */
  const st = localStriker.current || g.striker;
  const owner = g.players.find(p => p.id === g.turn)?.color || 'RED';
  const pal = PALETTE[owner] || PALETTE.RED;
  if (st) {
    const dim = g.turn === me ? 1 : 0.7;
    ctx.save();
    ctx.globalAlpha = dim;
    const sg = ctx.createRadialGradient(st.x - 1, st.y - 1.1, 0.2, st.x, st.y, STRIKER_R);
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(0.45, '#d8dee9');
    sg.addColorStop(1, '#7c8595');
    ctx.beginPath();
    ctx.arc(st.x, st.y, STRIKER_R, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 1.1;
    ctx.shadowOffsetY = 0.4;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = pal.ring;
    ctx.lineWidth = 0.42;
    ctx.stroke();
    ctx.globalAlpha = dim * 0.92;
    ctx.beginPath();
    ctx.arc(st.x, st.y, STRIKER_R * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = pal.b;
    ctx.fill();
    ctx.restore();

    if (myTurn && dragRef.current.mode === 'place' && localStriker.current) {
      ctx.save();
      ctx.strokeStyle = localStriker.current.legal ? 'rgba(30,190,130,0.95)' : 'rgba(230,50,80,0.95)';
      ctx.lineWidth = 0.32;
      ctx.setLineDash([0.9, 0.7]);
      ctx.beginPath();
      ctx.arc(st.x, st.y, STRIKER_R + 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const drag = dragRef.current;
    if (drag.mode === 'aim' && drag.power > 0.02) {
      const len = 4 + drag.power * 30;
      const ex = st.x + drag.dx * len, ey = st.y + drag.dy * len;
      const hot = drag.power > 0.82;
      ctx.save();
      ctx.setLineDash([1.4, 1.1]);
      ctx.lineWidth = 0.45;
      const grad = ctx.createLinearGradient(st.x, st.y, ex, ey);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, hot ? 'rgba(255,84,112,0.95)' : 'rgba(244,196,101,0.9)');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(st.x + drag.dx * (STRIKER_R + 0.5), st.y + drag.dy * (STRIKER_R + 0.5));
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      const ah = 1.8;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - drag.dx * ah - drag.dy * ah * 0.62, ey - drag.dy * ah + drag.dx * ah * 0.62);
      ctx.lineTo(ex - drag.dx * ah + drag.dy * ah * 0.62, ey - drag.dy * ah - drag.dx * ah * 0.62);
      ctx.closePath();
      ctx.fillStyle = hot ? 'rgba(255,84,112,0.95)' : 'rgba(244,196,101,0.95)';
      ctx.fill();
      ctx.setLineDash([0.5, 0.9]);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(drag.px, drag.py);
      ctx.lineTo(st.x, st.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ------- power meter ------- */
  const drag = dragRef.current;
  if (drag.mode === 'aim' && drag.power > 0.02) {
    const bx = PLAY_MIN + 4, by = PLAY_MAX - 5, bw = 22, bh = 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, bx, by, bw, bh, 1); ctx.fill();
    const p = clamp(drag.power, 0, 1);
    ctx.fillStyle = p > 0.82 ? '#ff5470' : p > 0.55 ? '#f4c465' : '#2ee6a8';
    roundRect(ctx, bx + 0.25, by + 0.25, (bw - 0.5) * p, bh - 0.5, 0.7); ctx.fill();
    ctx.restore();
  }

  /* ------- pocket effects ------- */
  const fx = model.fx;
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    if (f.t > 0.5) { fx.splice(i, 1); continue; }
    const p = f.t / 0.5;
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * (1 + p * 0.8), 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.3;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawDisc(ctx, x, y, r, pal, isQueen) {
  ctx.save();
  ctx.shadowColor = 'rgba(60,35,10,0.5)';
  ctx.shadowBlur = 0.9;
  ctx.shadowOffsetY = 0.35;
  const g = ctx.createRadialGradient(x - r * 0.36, y - r * 0.4, r * 0.12, x, y, r * 1.02);
  g.addColorStop(0, pal.a);
  g.addColorStop(0.55, pal.b);
  g.addColorStop(1, pal.c);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(x, y, r - 0.16, 0, Math.PI * 2);
  ctx.strokeStyle = pal.ring;
  ctx.lineWidth = 0.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 0.15;
  ctx.stroke();
  if (isQueen) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5470';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r * 0.62}px ui-sans-serif, system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Q', x, y + r * 0.03);
  }
  ctx.restore();
}