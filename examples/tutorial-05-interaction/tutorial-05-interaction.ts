// Tutorial 05 — Interaction: raycasting, hover, click, and keyboard events on a 5x5 cube grid.
import * as Three from 'three';

const GRID = 5, SPACING = 1.8;
const COL_BASE   = 0x2244aa;
const COL_HOVER  = 0xffdd44;
const COL_CLICK  = 0xff4422;

export function setup(ctx) {
  const { Three: T, scene } = ctx;

  ctx.setHelp('Hover a cube to highlight   •   Click to launch it   •   R: reset   •   G: toggle grid');
  ctx.camera.position.set(0, 6, 12);
  ctx.camera.lookAt(0, 0, 0);

  ctx.add(new Three.AmbientLight(0x223355, 0.8));
  const d = new Three.DirectionalLight(0xffffff, 1.2);
  d.position.set(5, 10, 6);
  ctx.add(d);
  const rim = new Three.PointLight(0x4466ff, 1.0, 30);
  rim.position.set(-6, 4, -4);
  ctx.add(rim);

  const geo = new Three.BoxGeometry(1.1, 1.1, 1.1);
  ctx._cubes = [];

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const mat = new Three.MeshStandardMaterial({
        color: COL_BASE, roughness: 0.4, metalness: 0.2,
        emissive: new Three.Color(0x112244),
      });
      const mesh = new Three.Mesh(geo, mat);
      const x = (c - (GRID - 1) / 2) * SPACING;
      const z = (r - (GRID - 1) / 2) * SPACING;
      mesh.position.set(x, 0, z);
      mesh.userData.baseX = x;
      mesh.userData.baseZ = z;
      mesh.userData.fly = 0;
      ctx.add(mesh);
      ctx._cubes.push(mesh);
    }
  }

  ctx._raycaster = new Three.Raycaster();
  ctx._mouse = new Three.Vector2(-9, -9);
  ctx._hovered = null;
  ctx._gridHelper = null;
  ctx._showGrid = false;

  ctx._onMouseMove = (e) => {
    const el = ctx.renderer.domElement;
    const rect = el.getBoundingClientRect();
    ctx._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    ctx._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  };

  ctx._onClick = (e) => {
    const el = ctx.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const mx =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const my = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    ctx._raycaster.setFromCamera({ x: mx, y: my }, ctx.camera);
    const hits = ctx._raycaster.intersectObjects(ctx._cubes);
    if (hits.length > 0) {
      const cube = hits[0].object;
      cube.userData.fly = 1.0;
    }
  };

  ctx._onKey = (e) => {
    if (e.key === 'r' || e.key === 'R') {
      for (const cube of ctx._cubes) {
        cube.userData.fly = 0;
        cube.position.y = 0;
        cube.material.color.setHex(COL_BASE);
        cube.material.emissive.setHex(0x112244);
      }
    }
    if (e.key === 'g' || e.key === 'G') {
      ctx._showGrid = !ctx._showGrid;
      if (ctx._showGrid) {
        ctx._gridHelper = new Three.GridHelper(20, 20, 0x334466, 0x223355);
        ctx._gridHelper.position.y = -0.56;
        ctx.add(ctx._gridHelper);
      } else if (ctx._gridHelper) {
        ctx.scene.remove(ctx._gridHelper);
        ctx._gridHelper = null;
      }
    }
  };

  window.addEventListener('mousemove', ctx._onMouseMove);
  window.addEventListener('click',     ctx._onClick);
  window.addEventListener('keydown',   ctx._onKey);
}

export function update(ctx, dt) {
  const t = ctx.elapsed;

  ctx._raycaster.setFromCamera(ctx._mouse, ctx.camera);
  const hits = ctx._raycaster.intersectObjects(ctx._cubes);
  const nowHovered = hits.length > 0 ? hits[0].object : null;

  if (ctx._hovered && ctx._hovered !== nowHovered && ctx._hovered.userData.fly <= 0) {
    ctx._hovered.material.color.setHex(COL_BASE);
    ctx._hovered.material.emissive.setHex(0x112244);
    ctx._hovered.material.emissiveIntensity = 1;
  }
  if (nowHovered && nowHovered.userData.fly <= 0) {
    nowHovered.material.color.setHex(COL_HOVER);
    nowHovered.material.emissive.setHex(0x554400);
    const pulse = 0.6 + 0.4 * Math.sin(t * 8);
    nowHovered.material.emissiveIntensity = pulse;
  }
  ctx._hovered = nowHovered;

  for (const cube of ctx._cubes) {
    if (cube.userData.fly > 0) {
      cube.userData.fly = Math.max(0, cube.userData.fly - dt * 0.6);
      const f = cube.userData.fly;
      cube.position.y = Math.sin(f * Math.PI) * 3.5;
      cube.material.color.setHex(COL_CLICK);
      cube.material.emissive.setHex(0x441100);
      cube.rotation.x += dt * 4;
      if (f <= 0) {
        cube.position.y = 0;
        cube.material.color.setHex(COL_BASE);
        cube.material.emissive.setHex(0x112244);
        cube.material.emissiveIntensity = 1;
      }
    }
  }
}

export function teardown(ctx) {
  window.removeEventListener('mousemove', ctx._onMouseMove);
  window.removeEventListener('click',     ctx._onClick);
  window.removeEventListener('keydown',   ctx._onKey);
  if (ctx._gridHelper) ctx.scene.remove(ctx._gridHelper);
}
