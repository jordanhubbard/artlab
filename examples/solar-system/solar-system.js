// Solar System — audio-reactive 3D solar system, the Artlab reference demo.
//
// Scale: 1 AU = 100 Three.js units, Earth radius = 2.5 units, 1 year = 120 s.
// Textures: Solar System Scope 2k pack (https://www.solarsystemscope.com/textures/)
// Sun and Moon use procedural materials — no texture files required.

const AU           = 100;
const PLANET_SCALE = 2.5;
const SUN_RADIUS   = 10.0;
const YEAR_SECS    = 120.0;

// Orbital data: [semiMajorAU, periodYears, radiusEarth, tiltDeg, color, texturePath]
const PLANET_DATA = {
  mercury: { a: 0.387, period: 0.241, re: 0.383, tilt:   0.03, color: 0x9e9e9e, tex: 'assets/textures/mercury/2k_mercury.jpg' },
  venus:   { a: 0.723, period: 0.615, re: 0.949, tilt: 177.4,  color: 0xe8c870, tex: 'assets/textures/venus/2k_venus_atmosphere.jpg' },
  earth:   { a: 1.000, period: 1.000, re: 1.000, tilt:  23.44, color: 0x2255aa, tex: 'assets/textures/earth/2k_earth_daymap.jpg' },
  mars:    { a: 1.524, period: 1.881, re: 0.532, tilt:  25.19, color: 0xc1440e, tex: 'assets/textures/mars/2k_mars.jpg' },
  jupiter: { a: 5.204, period: 11.86, re: 11.209,tilt:   3.13, color: 0xc88b3a, tex: 'assets/textures/jupiter/2k_jupiter.jpg' },
  saturn:  { a: 9.537, period: 29.46, re: 9.449, tilt:  26.73, color: 0xead6a5, tex: 'assets/textures/saturn/2k_saturn.jpg' },
  uranus:  { a: 19.19, period: 84.01, re: 4.007, tilt:  97.77, color: 0x7de8e8, tex: 'assets/textures/uranus/2k_uranus.jpg' },
  neptune: { a: 30.07, period: 164.8, re: 3.883, tilt:  28.32, color: 0x3f54ba, tex: 'assets/textures/neptune/2k_neptune.jpg' },
};

// Atmosphere tint per planet [r,g,b]
const ATM_COLOR = {
  venus:   [1.0, 0.85, 0.50],
  mars:    [0.9, 0.40, 0.20],
  jupiter: [0.85, 0.70, 0.45],
  uranus:  [0.50, 0.90, 0.90],
  neptune: [0.20, 0.40, 1.00],
};

function makeAtmosphere(THREE, parent, r, rgb) {
  const ageo = new THREE.SphereGeometry(r, 32, 32);
  const amat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...rgb),
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const atm = new THREE.Mesh(ageo, amat);
  parent.add(atm);
  return atm;
}

export function setup(ctx) {
  const { THREE } = ctx;

  // Camera and controls
  ctx.camera.position.set(0, 80, 200);
  ctx.camera.lookAt(0, 0, 0);
  ctx.controls.target.set(0, 0, 0);
  ctx.controls.minDistance = 20;
  ctx.controls.maxDistance = 5000;

  // Lighting
  const sunLight = new THREE.PointLight(0xffeebb, 10000, 0, 2);
  sunLight.position.set(0, 0, 0);
  ctx.add(sunLight);
  ctx.add(new THREE.AmbientLight(0x111122, 0.5));

  // Starfield
  const starGeo  = new THREE.BufferGeometry();
  const starVerts = new Float32Array(120000 * 3);
  for (let i = 0; i < 120000 * 3; i++) {
    starVerts[i] = (Math.random() - 0.5) * 120000;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: true });
  ctx._stars = new THREE.Points(starGeo, starMat);
  ctx.add(ctx._stars);

  // Sun — procedural emissive (no texture required)
  const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
  const sunMat = new THREE.MeshStandardMaterial({
    color:             new THREE.Color(1.0, 0.95, 0.7),
    emissive:          new THREE.Color(1.0, 0.75, 0.20),
    emissiveIntensity: 1.2,
    roughness:         0.4,
    metalness:         0.0,
  });
  ctx._sunMesh = new THREE.Mesh(sunGeo, sunMat);
  ctx.add(ctx._sunMesh);

  // Build planets
  ctx._planets     = {};
  ctx._orbitAngles = {};

  for (const [name, pd] of Object.entries(PLANET_DATA)) {
    const r      = pd.re * PLANET_SCALE;
    const geo    = new THREE.SphereGeometry(r, 64, 64);
    const texMap = ctx.loadTexture(pd.tex);
    const mat    = new THREE.MeshStandardMaterial({
      map:       texMap,
      color:     pd.color,
      roughness: 0.8,
      metalness: 0.0,
    });

    // Earth gets night-map emissive and cloud shell
    if (name === 'earth') {
      const nightTex  = ctx.loadTexture('assets/textures/earth/2k_earth_nightmap.jpg');
      const cloudsTex = ctx.loadTexture('assets/textures/earth/2k_earth_clouds.jpg');
      mat.emissiveMap = nightTex;
      mat.emissive    = new THREE.Color(0.15, 0.10, 0.04);

      const cloudGeo = new THREE.SphereGeometry(r * 1.008, 64, 64);
      const cloudMat = new THREE.MeshStandardMaterial({
        map: cloudsTex, alphaMap: cloudsTex,
        transparent: true, opacity: 0.55, depthWrite: false,
      });
      const clouds = new THREE.Mesh(cloudGeo, cloudMat);

      const body = new THREE.Mesh(geo, mat);
      body.rotation.z = pd.tilt * Math.PI / 180;
      body.add(clouds);
      body._clouds = clouds;

      makeAtmosphere(THREE, body, r * 1.028, [0.3, 0.6, 1.0]);

      ctx._planets[name] = body;
      ctx.add(body);
    } else {
      const body = new THREE.Mesh(geo, mat);
      body.rotation.z = pd.tilt * Math.PI / 180;

      if (ATM_COLOR[name]) {
        makeAtmosphere(THREE, body, r * 1.02, ATM_COLOR[name]);
      }

      // Saturn gets rings
      if (name === 'saturn') {
        const inner   = r * 1.11;
        const outer   = r * 2.27;
        const ringGeo = new THREE.RingGeometry(inner, outer, 128);
        const pos = ringGeo.attributes.position;
        const uv  = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const dist = Math.sqrt(pos.getX(i) ** 2 + pos.getY(i) ** 2);
          uv.setXY(i, (dist - inner) / (outer - inner), 0);
        }
        const ringTex = ctx.loadTexture('assets/textures/saturn/2k_saturn_ring_alpha.png');
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xead6a5,
          map: ringTex, alphaMap: ringTex,
          transparent: true, opacity: 0.9,
          side: THREE.DoubleSide, depthWrite: false,
        });
        const rings = new THREE.Mesh(ringGeo, ringMat);
        rings.rotation.x = Math.PI / 2;
        body.add(rings);
      }

      ctx._planets[name] = body;
      ctx.add(body);
    }

    // Orbit guide ellipse
    const aCurve  = new THREE.EllipseCurve(0, 0, pd.a * AU, pd.a * AU, 0, Math.PI * 2, false, 0);
    const aPoints = aCurve.getPoints(256);
    const aGeo    = new THREE.BufferGeometry().setFromPoints(aPoints.map(p => new THREE.Vector3(p.x, 0, p.y)));
    const aMat    = new THREE.LineBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.4 });
    ctx.add(new THREE.Line(aGeo, aMat));

    ctx._orbitAngles[name] = Math.random() * Math.PI * 2;
  }

  // Moon — procedural grey (no texture required)
  const moonR   = 0.273 * PLANET_SCALE;
  const moonGeo = new THREE.SphereGeometry(moonR, 32, 32);
  const moonMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.95, metalness: 0.0 });
  ctx._moon      = new THREE.Mesh(moonGeo, moonMat);
  ctx.add(ctx._moon);
  ctx._moonAngle = 0;
}

export function update(ctx, dt) {
  // Sun gentle rotation
  ctx._sunMesh.rotation.y += dt * 0.05;

  // Advance planets
  for (const [name, pd] of Object.entries(PLANET_DATA)) {
    const body = ctx._planets[name];
    if (!body) continue;

    const angSpeed = (2 * Math.PI) / (pd.period * YEAR_SECS);
    ctx._orbitAngles[name] += angSpeed * dt;
    const angle = ctx._orbitAngles[name];

    const dist = pd.a * AU;
    body.position.set(dist * Math.cos(angle), 0, dist * Math.sin(angle));

    body.rotation.y += dt * (1.0 / pd.period) * 0.5;

    if (name === 'earth' && body._clouds) {
      body._clouds.rotation.y += dt * 0.03;
    }
  }

  // Moon orbits Earth
  if (ctx._moon && ctx._planets.earth) {
    ctx._moonAngle += dt * (2 * Math.PI / (27.3 * (YEAR_SECS / 365.25)));
    const earth    = ctx._planets.earth;
    const moonDist = 0.00257 * AU;
    ctx._moon.position.set(
      earth.position.x + moonDist * Math.cos(ctx._moonAngle),
      earth.position.y,
      earth.position.z + moonDist * Math.sin(ctx._moonAngle)
    );
  }
}
