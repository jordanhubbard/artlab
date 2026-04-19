// Typography Art — a neon digital-art poster rendered entirely in Three.js.
// A glowing ARTLAB logotype pulses over a dark grid, with cycling quote
// subtitles drawn as emissive 3D text planes approximated via canvas texture.

const QUOTES = [
  "Art is the lie that reveals the truth.",
  "Every child is an artist.",
  "Creativity is intelligence having fun.",
  "The purpose of art is washing dust from the soul.",
  "Art enables us to find ourselves and lose ourselves.",
  "To create is to resist.",
];
const QUOTE_INTERVAL = 4.0;

export function setup(ctx) {
  const { THREE, plane, mesh, ambient } = ctx;

  ctx.camera.position.set(0, 0, 5);

  ctx.add(ambient(0x000000, 1.0));

  // Dark backdrop plane
  const bg = mesh(plane(20, 12), { color: 0x060608, roughness: 1.0, metalness: 0.0 });
  bg.material.emissive = new THREE.Color(0x060608);
  bg.position.set(0, 0, -1);
  ctx.add(bg);

  // Grid lines (horizontal)
  for (let row = 0; row < 13; row++) {
    const y = row - 6.0;
    const line = mesh(plane(20, 0.01), { color: 0x000000, roughness: 1.0, metalness: 0.0 });
    line.material.emissive = new THREE.Color(0x0a1a2a);
    line.position.set(0, y, -0.5);
    ctx.add(line);
  }

  // Grid lines (vertical)
  for (let col = 0; col < 21; col++) {
    const x = col - 10.0;
    const line = mesh(plane(0.01, 12), { color: 0x000000, roughness: 1.0, metalness: 0.0 });
    line.material.emissive = new THREE.Color(0x0a1a2a);
    line.position.set(x, 0, -0.5);
    ctx.add(line);
  }

  // Canvas texture for the neon logotype and quote
  const canvas  = document.createElement('canvas');
  canvas.width  = 1280;
  canvas.height = 720;
  ctx._canvas   = canvas;
  ctx._canvasCtx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  ctx._texture  = texture;

  // Full-screen quad in front of scene to display canvas artwork
  const quadGeo = plane(20, 11.25);
  const quadMat = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false
  });
  const quad = new THREE.Mesh(quadGeo, quadMat);
  quad.position.set(0, 0, 0.5);
  ctx.add(quad);

  ctx._quoteIdx  = 0;
  ctx._lastQuote = 0;
}

export function update(ctx, dt) {
  const elapsed = ctx.elapsed;
  const c = ctx._canvasCtx;

  c.clearRect(0, 0, 1280, 720);

  const pulse = 0.75 + 0.25 * Math.sin(elapsed * 0.8);

  // Outer glow passes
  c.font = 'bold 160px monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  c.fillStyle = `rgba(0,255,200,${0.18 * pulse})`;
  c.filter = 'blur(28px)';
  c.fillText('ARTLAB', 640, 300);

  c.fillStyle = `rgba(0,255,200,${0.18 * pulse})`;
  c.filter = 'blur(14px)';
  c.fillText('ARTLAB', 640, 300);

  c.fillStyle = `rgba(80,255,220,${0.5 * pulse})`;
  c.filter = 'blur(6px)';
  c.fillText('ARTLAB', 640, 300);

  c.filter = 'none';
  c.fillStyle = `rgba(200,255,245,${pulse})`;
  c.fillText('ARTLAB', 640, 300);

  c.strokeStyle = `rgba(0,255,200,${0.6 * pulse})`;
  c.lineWidth = 2;
  c.strokeText('ARTLAB', 640, 300);

  // Cycling quote
  const qElapsed = elapsed - ctx._lastQuote;
  if (qElapsed >= QUOTE_INTERVAL) {
    ctx._quoteIdx  = (ctx._quoteIdx + 1) % QUOTES.length;
    ctx._lastQuote = elapsed;
  }
  const qe = elapsed - ctx._lastQuote;
  let fade = 1.0;
  if (qe < 0.6)                    fade = qe / 0.6;
  else if (qe > QUOTE_INTERVAL - 0.6) fade = (QUOTE_INTERVAL - qe) / 0.6;

  const quote = QUOTES[ctx._quoteIdx];
  c.font = '22px monospace';
  c.fillStyle = `rgba(100,220,200,${fade * 0.9})`;
  c.filter = 'blur(1.5px)';
  c.fillText(quote, 640, 420);
  c.filter = 'none';
  c.fillStyle = `rgba(180,255,235,${fade * 0.95})`;
  c.fillText(quote, 640, 420);

  // Decorative rule
  const ruleAlpha = 0.5 + 0.3 * Math.sin(elapsed * 1.2);
  c.strokeStyle = `rgba(0,255,200,${ruleAlpha})`;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(200, 370);
  c.lineTo(1080, 370);
  c.stroke();

  // Corner branding
  c.font = '12px monospace';
  c.fillStyle = 'rgba(0,180,150,0.6)';
  c.textAlign = 'left';
  c.fillText('ARTLAB v1.0', 20, 700);
  c.textAlign = 'right';
  c.fillText('generative art engine', 1260, 700);

  ctx._texture.needsUpdate = true;
}
