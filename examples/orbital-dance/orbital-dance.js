// Orbital Dance — a luminous central sphere with 5 colored planets orbiting
// at staggered radii and speeds. Each planet leaves a ring of 20 ghost
// spheres marking its recent positions, creating glowing orbital trails.

const PLANET_COUNT = 5;
const TRAIL_LEN    = 20;

const PLANET_DATA = [
  { radius: 2.8, speed: 1.10, color: 0xff3333, emissive: 0x660000, trailEmissive: 0x330000, tilt:  0.00, phase: 0.00 },
  { radius: 4.2, speed: 0.72, color: 0x3388ff, emissive: 0x001155, trailEmissive: 0x000833, tilt:  0.25, phase: 1.26 },
  { radius: 5.6, speed: 0.50, color: 0x44ee44, emissive: 0x003300, trailEmissive: 0x001100, tilt: -0.18, phase: 2.51 },
  { radius: 7.0, speed: 0.35, color: 0xbb44ff, emissive: 0x330066, trailEmissive: 0x1a0033, tilt:  0.40, phase: 3.77 },
  { radius: 8.5, speed: 0.24, color: 0xffcc00, emissive: 0x443300, trailEmissive: 0x221100, tilt: -0.30, phase: 5.03 },
];

export function setup(ctx) {
  const { THREE, sphere, mesh, ambient, point } = ctx;

  ctx.camera.position.set(0, 12, 20);
  ctx.camera.lookAt(0, 0, 0);
  ctx.controls.enabled = false;  // camera auto-orbits in update()

  ctx.add(ambient(0x060610, 1.0));

  // Central sun
  const sunMesh = mesh(sphere(0.9, 16), {
    color: 0xfffbe8, roughness: 1.0, metalness: 0.0
  });
  sunMesh.material.emissive = new THREE.Color(0xffcc44);
  ctx.add(sunMesh);

  // Sun light
  const sunLight = point(0xffdd88, 3.5, 0, 2);
  sunLight.position.set(0, 0, 0);
  ctx.add(sunLight);

  // Planets + trails
  ctx._planets = [];
  for (let pi = 0; pi < PLANET_COUNT; pi++) {
    const pd = PLANET_DATA[pi];
    const planetMesh = mesh(sphere(0.28, 12), { color: pd.color, roughness: 0.4, metalness: 0.7 });
    planetMesh.material.emissive = new THREE.Color(pd.emissive);
    planetMesh.position.set(pd.radius, 0, 0);
    ctx.add(planetMesh);

    const trail = [];
    for (let ti = 0; ti < TRAIL_LEN; ti++) {
      const ghost = mesh(sphere(0.08, 6), { color: 0x000000, roughness: 1.0, metalness: 0.0 });
      ghost.material.emissive = new THREE.Color(pd.trailEmissive);
      ghost.position.set(pd.radius, 0, 0);
      ctx.add(ghost);
      trail.push(ghost);
    }

    ctx._planets.push({ mesh: planetMesh, trail, data: pd });
  }
}

export function update(ctx, dt) {
  const elapsed = ctx.elapsed;

  // Slowly rotate camera
  ctx.camera.position.x = 20 * Math.sin(elapsed * 0.08);
  ctx.camera.position.z = 20 * Math.cos(elapsed * 0.08);
  ctx.camera.lookAt(0, 0, 0);

  for (const planet of ctx._planets) {
    const { radius, speed, tilt, phase } = planet.data;
    const angle = elapsed * speed + phase;

    const px = radius * Math.cos(angle);
    let pz   = radius * Math.sin(angle);
    const py = pz * Math.sin(tilt);
    pz       = pz * Math.cos(tilt);

    planet.mesh.position.set(px, py, pz);

    for (let ti = 0; ti < TRAIL_LEN; ti++) {
      const trailAngle = angle - (ti + 1) * 0.08;
      const tx = radius * Math.cos(trailAngle);
      let tz   = radius * Math.sin(trailAngle);
      const ty = tz * Math.sin(tilt);
      tz        = tz * Math.cos(tilt);

      planet.trail[ti].position.set(tx, ty, tz);

      const fade = 1.0 - (ti + 1) / (TRAIL_LEN + 1);
      const s = 0.4 * fade;
      planet.trail[ti].scale.set(s, s, s);
    }
  }
}

export function teardown(ctx) {
  ctx.controls.enabled = true
}
