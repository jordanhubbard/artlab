// Hello Cube — geometry, material, lighting, and animation in one concise package.
import * as Three from 'three';

let mesh;

export function setup(ctx) {
  ctx.camera.position.set(4, 3, 6);

  ctx.renderer.shadowMap.enabled = true;
  ctx.renderer.shadowMap.type = Three.PCFSoftShadowMap;

  ctx.setBloom(0.6);

  const ambient = new Three.AmbientLight(0x111122, 0.8);
  ctx.add(ambient);

  const sun = new Three.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 10, 7);
  sun.castShadow = true;
  ctx.add(sun);

  const rim = new Three.PointLight(0x4466ff, 2.0);
  rim.position.set(-4, 3, -3);
  ctx.add(rim);

  const cubeGeo = new Three.BoxGeometry(1.5, 1.5, 1.5);
  const cubeMat = new Three.MeshStandardMaterial({
    color: 0x3333cc,
    emissive: new Three.Color(0x111133),
    roughness: 0.4,
    metalness: 0.1,
  });
  mesh = new Three.Mesh(cubeGeo, cubeMat);
  mesh.castShadow = true;

  const edgesGeo = new Three.EdgesGeometry(cubeGeo);
  const edgesMat = new Three.LineBasicMaterial({ color: 0x6688ff });
  const edges = new Three.LineSegments(edgesGeo, edgesMat);
  mesh.add(edges);

  ctx.add(mesh);

  const groundGeo = new Three.PlaneGeometry(50, 50);
  const groundMat = new Three.MeshStandardMaterial({ color: 0x050510, roughness: 1.0 });
  const ground = new Three.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.2;
  ground.receiveShadow = true;
  ctx.add(ground);
}

export function update(ctx, dt) {
  mesh.rotation.x += 0.3 * dt;
  mesh.rotation.y += 0.5 * dt;
  mesh.position.y = Math.sin(ctx.elapsed * 0.7) * 0.3;
}

export function teardown(ctx) {
  ctx.remove(mesh);
}
