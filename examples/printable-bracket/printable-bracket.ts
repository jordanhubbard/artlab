// Printable bracket — parametric L-bracket built with manifold-3d (guaranteed
// manifold CSG), previewed in Three.js, exportable as STL for 3D printing.
// Convention: 1 artlab unit = 1 mm.
import * as Three from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import ManifoldModule from 'manifold-3d';

const PARAMS = {
  armLength:    40,   // mm
  armWidth:     20,   // mm
  armThickness:  4,   // mm
  holeRadius:    3,   // mm
  holeInset:    10,   // mm from the outer end of each arm
};

let wasm        = null;
let previewMesh = null;
let ui          = null;

async function initManifold() {
  if (wasm) return wasm;
  wasm = await ManifoldModule();
  wasm.setup();
  return wasm;
}

function buildBracket(p) {
  const { Manifold } = wasm;

  // Two plates joined at the corner to form an L.
  const armX = Manifold.cube([p.armLength, p.armWidth, p.armThickness], false);
  const armZ = Manifold.cube([p.armThickness, p.armWidth, p.armLength], false);

  // Mounting holes. Manifold.cylinder is Z-aligned by default.
  // For the horizontal plate (thickness along Z), no rotation needed.
  const holeH = Manifold.cylinder(p.armThickness + 2, p.holeRadius, p.holeRadius, 48, false)
    .translate([p.armLength - p.holeInset, p.armWidth / 2, -1]);

  // For the vertical plate (thickness along X), rotate cylinder 90° about Y.
  const holeV = Manifold.cylinder(p.armThickness + 2, p.holeRadius, p.holeRadius, 48, false)
    .rotate([0, 90, 0])
    .translate([-1, p.armWidth / 2, p.armLength - p.holeInset]);

  const body  = armX.add(armZ);
  const final = body.subtract(holeH).subtract(holeV);

  [armX, armZ, holeH, holeV, body].forEach(m => m.delete());
  return final;
}

function manifoldToGeometry(man) {
  const m = man.getMesh();
  const geo = new Three.BufferGeometry();
  // vertProperties is flat xyz (numProp defaults to 3).
  geo.setAttribute('position', new Three.BufferAttribute(m.vertProperties.slice(), 3));
  geo.setIndex(new Three.BufferAttribute(m.triVerts.slice(), 1));
  geo.computeVertexNormals();
  return geo;
}

function download(filename, data, mime) {
  const blob = new Blob([data], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportSTL(mesh) {
  const bin = new STLExporter().parse(mesh, { binary: true });
  download('bracket.stl', bin, 'application/octet-stream');
}

function exportOBJ(mesh) {
  const txt = new OBJExporter().parse(mesh);
  download('bracket.obj', txt, 'text/plain');
}

function makeUI(onSTL, onOBJ) {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:absolute', 'top:16px', 'right:16px', 'z-index:100',
    'display:flex', 'gap:8px',
    'font-family:monospace', 'font-size:13px',
  ].join(';');

  const mkBtn = (label, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'padding:8px 14px',
      'background:#1a1a2a', 'color:#aaccff',
      'border:1px solid #4466ff', 'border-radius:4px',
      'cursor:pointer', 'font-family:inherit', 'font-size:inherit',
    ].join(';');
    b.addEventListener('mouseenter', () => { b.style.background = '#2a2a4a'; });
    b.addEventListener('mouseleave', () => { b.style.background = '#1a1a2a'; });
    b.addEventListener('click', onClick);
    return b;
  };

  panel.appendChild(mkBtn('Export STL', onSTL));
  panel.appendChild(mkBtn('Export OBJ', onOBJ));
  document.body.appendChild(panel);
  return panel;
}

export async function setup(ctx) {
  ctx.setHelp('Export STL / OBJ buttons (top-right) save the mesh for 3D printing');
  ctx.camera.position.set(70, 55, 85);
  ctx.camera.lookAt(15, 10, 15);

  ctx.add(new Three.AmbientLight(0xffffff, 0.35));
  const key = new Three.DirectionalLight(0xffffff, 2.0);
  key.position.set(80, 120, 70);
  ctx.add(key);
  const fill = new Three.DirectionalLight(0x99aaff, 0.7);
  fill.position.set(-60, 40, -40);
  ctx.add(fill);

  // 200mm × 200mm grid, 10mm cells — scale reference.
  const grid = new Three.GridHelper(200, 20, 0x335577, 0x112233);
  grid.position.y = -0.05;
  ctx.add(grid);

  await initManifold();

  const bracket = buildBracket(PARAMS);
  const geo     = manifoldToGeometry(bracket);
  bracket.delete();

  const mat = new Three.MeshStandardMaterial({
    color: 0x5599ff, metalness: 0.25, roughness: 0.45,
  });
  previewMesh = new Three.Mesh(geo, mat);
  ctx.add(previewMesh);

  ui = makeUI(
    () => exportSTL(previewMesh),
    () => exportOBJ(previewMesh),
  );
}

export function update(ctx, dt) {
  if (previewMesh) previewMesh.rotation.y += 0.3 * dt;
}

export function teardown(ctx) {
  if (previewMesh) ctx.remove(previewMesh);
  if (ui) ui.remove();
  previewMesh = null;
  ui = null;
}
