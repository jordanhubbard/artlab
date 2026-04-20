// shader-playground — raymarched SDF (sphere + torus + plane) via ShaderMaterial.
import * as Three from 'three'

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const FRAG = /* glsl */`
precision highp float;
uniform float uTime;
uniform vec2  uResolution;
varying vec2  vUv;

// ── SDF primitives ──────────────────────────────────────────────────────────
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdTorus(vec3 p, vec2 t)   { return length(vec2(length(p.xz)-t.x,p.y))-t.y; }
float sdPlane(vec3 p)            { return p.y + 1.2; }

float smin(float a, float b, float k) {
  float h = max(k - abs(a-b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float scene(vec3 p) {
  float s = sdSphere(p - vec3(sin(uTime*0.7)*0.8, cos(uTime*0.5)*0.3, 0.0), 0.7);
  float t = sdTorus(
    p - vec3(0.0, sin(uTime*0.4)*0.4 - 0.1, cos(uTime*0.6)*0.2),
    vec2(1.1 + sin(uTime*0.3)*0.15, 0.28)
  );
  float pl = sdPlane(p);
  return smin(smin(s, t, 0.4), pl, 0.3);
}

vec3 normal(vec3 p) {
  const float e = 0.001;
  return normalize(vec3(
    scene(p+vec3(e,0,0)) - scene(p-vec3(e,0,0)),
    scene(p+vec3(0,e,0)) - scene(p-vec3(0,e,0)),
    scene(p+vec3(0,0,e)) - scene(p-vec3(0,0,e))
  ));
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0) * 2.0;

  vec3 ro = vec3(sin(uTime*0.18)*3.5, 1.6 + sin(uTime*0.11)*0.4, cos(uTime*0.18)*3.5);
  vec3 target = vec3(0.0, 0.0, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0,1,0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(fwd + uv.x * right + uv.y * up);

  // Raymarching
  float t = 0.0;
  vec3 col = vec3(0.04, 0.04, 0.10);

  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = scene(p);
    if (d < 0.001) {
      vec3 n   = normal(p);
      vec3 lig = normalize(vec3(0.6, 1.0, 0.5));
      float diff = max(dot(n, lig), 0.0);
      float spec = pow(max(dot(reflect(-lig, n), -rd), 0.0), 32.0);

      // Color by SDF component
      float sp = sdSphere(p - vec3(sin(uTime*0.7)*0.8, cos(uTime*0.5)*0.3, 0.0), 0.7);
      float tp = sdTorus(p - vec3(0.0, sin(uTime*0.4)*0.4-0.1, cos(uTime*0.6)*0.2), vec2(1.1+sin(uTime*0.3)*0.15,0.28));
      vec3 albedo = (sp < tp)
        ? vec3(0.2, 0.6, 1.0)
        : (p.y < -1.1
          ? vec3(0.25, 0.22, 0.20)
          : vec3(1.0, 0.4, 0.1));

      col = albedo * (0.15 + 0.85 * diff) + vec3(spec * 0.7);
      col = mix(col, vec3(0.04,0.04,0.10), min(1.0, t * 0.18));
      break;
    }
    t += d;
    if (t > 20.0) break;
  }

  gl_FragColor = vec4(col, 1.0);
}
`

export function setup(ctx) {
  ctx.camera.position.set(0, 0, 1)
  ctx.setBloom(0.6)

  // Full-screen quad in camera space — use an orthographic-style approach
  // by placing a quad that fills NDC space and ignoring the projectionMatrix
  ctx._uniforms = {
    uTime:       { value: 0 },
    uResolution: { value: new Three.Vector2(1280, 720) },
  }

  const geo = new Three.PlaneGeometry(2, 2)
  const mat = new Three.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms:       ctx._uniforms,
    depthWrite:     false,
    depthTest:      false,
  })

  ctx._quad = new Three.Mesh(geo, mat)
  // Render in camera space (no transforms needed for full-screen pass)
  ctx.camera.add(ctx._quad)
  ctx._quad.position.set(0, 0, -1)
  ctx.scene.add(ctx.camera)

  // Resize handler
  ctx._onResize = () => {
    const w = ctx.renderer.domElement.width
    const h = ctx.renderer.domElement.height
    ctx._uniforms.uResolution.value.set(w, h)
  }
  window.addEventListener('resize', ctx._onResize)
}

export function update(ctx, dt) {
  ctx._uniforms.uTime.value = ctx.elapsed
}

export function teardown(ctx) {
  window.removeEventListener('resize', ctx._onResize)
  ctx.camera.remove(ctx._quad)
  ctx.scene.remove(ctx.camera)
}
