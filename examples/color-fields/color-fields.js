// Color Fields — "Chromatic Weather".
//
// A single continuous sheet of pigment stretches to the horizon and dissolves
// into its own atmosphere. Layered low-frequency swells push the surface into
// slow weather fronts while a drifting light and shifting fog re-tint the whole
// field. The pointer stirs the pigment; a click sends a chromatic front rolling
// outward across the sheet.
//
// The surface is one mesh. Displacement, pigment mixing, lighting, and fog are
// all evaluated in the shader, so a frame costs only a handful of uniform
// writes no matter how dense the sheet is.

import * as Three from 'three'

// ── Composition ───────────────────────────────────────────────────────────────

const FIELD_SPAN     = 150    // world units across and away
const FIELD_SEGMENTS = 168    // one continuous sheet, ~56k triangles
const AMPLITUDE      = 3.2    // vertical reach of the weather swells
const NORMAL_EPSILON = 0.75   // finite-difference step for analytic normals

const CAMERA_POSITION = [0, 9, 34]
const VIEW_TARGET     = [0, 0.5, -16]

const FOG_NEAR = 24
const FOG_FAR  = 132

// The two ends of the atmospheric cycle the whole piece breathes between.
const FOG_DUSK   = new Three.Color(0x131b30)
const FOG_DAWN   = new Three.Color(0x2e2742)
const SKY_DUSK   = new Three.Color(0x4c6ea8)
const SKY_DAWN   = new Three.Color(0x8c6f9c)
const LIGHT_DUSK = new Three.Color(0xffd7a4)
const LIGHT_DAWN = new Three.Color(0xffb9c6)

const ATMOSPHERE_RATE = 0.075  // radians/second of the fog + light cycle
const LIGHT_ORBIT_RATE = 0.062
const LIGHT_LIFT_RATE  = 0.037
const WASH_RATE        = 0.071

// ── Disturbance ───────────────────────────────────────────────────────────────

const SWELL_GAIN  = 0.34   // added per pointer move, clamped to 1
const SWELL_DECAY = 0.85   // per second back to rest
const RIPPLE_LIFE = 3.4    // seconds for a launched front to fade out
const RIPPLE_SPEED = 11.0  // world units/second the front travels

// ── Pigment ───────────────────────────────────────────────────────────────────

// A painter's palette rather than a hue wheel: these read as mixed pigment
// instead of rainbow banding. Three converts them into the linear working
// space, and the same numbers are inlined into the fragment shader so the
// baked vertex colors and the drifting wash sample one identical ramp.
const PIGMENTS = [
  new Three.Color(0x101a3c), // indigo
  new Three.Color(0x0f5f6b), // viridian
  new Three.Color(0x2f7a3c), // sap green
  new Three.Color(0xe0761d), // cadmium orange
  new Three.Color(0xc32f4a), // rose madder
  new Three.Color(0x5a2a6b), // violet
]

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smoothstep01(v) {
  return v * v * (3 - 2 * v)
}

function wrap01(v) {
  return v - Math.floor(v)
}

/** Sample the pigment ramp into `target`. Mirrors `pigmentRamp()` in GLSL. */
function rampInto(target, t) {
  const s = wrap01(t) * PIGMENTS.length
  target.copy(PIGMENTS[0])
  for (let i = 1; i <= PIGMENTS.length; i++) {
    target.lerp(PIGMENTS[i % PIGMENTS.length], smoothstep01(clamp01(s - (i - 1))))
  }
  return target
}

// ── Deterministic value noise, used once to bake the pigment layout ──────────

function hash2(ix, iy) {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function noise2(x, y) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const ux = smoothstep01(x - ix)
  const uy = smoothstep01(y - iy)
  const a = hash2(ix,     iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix,     iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy
}

function pigmentNoise(x, y) {
  return noise2(x, y) * 0.55 +
         noise2(x * 2.13, y * 2.07) * 0.28 +
         noise2(x * 4.31, y * 4.17) * 0.17
}

// ── Shaders ───────────────────────────────────────────────────────────────────

function glslColor(color) {
  return `vec3(${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)})`
}

const VERTEX_SHADER = /* glsl */`
  uniform float uTime;
  uniform float uAmplitude;
  uniform vec2  uPointer;
  uniform vec2  uRippleOrigin;
  uniform float uRipple;
  uniform float uRippleAge;
  uniform float uSwell;

  attribute vec3 color;

  varying vec3  vPigment;
  varying vec3  vFieldNormal;
  varying vec2  vField;
  varying float vRelief;

  #include <fog_pars_vertex>

  // Four overlapping low-frequency swells. Every wavelength is an order of
  // magnitude longer than a cell, so the sheet never reveals its tessellation.
  float weather(vec2 p, float t) {
    float a = sin(p.x * 0.19 + t * 0.23) * cos(p.y * 0.15 - t * 0.17);
    float b = sin((p.x * 0.61 + p.y * 0.79) * 0.14 - t * 0.31);
    float c = sin((p.x * -0.83 + p.y * 0.55) * 0.27 + t * 0.13);
    float d = sin(length(p) * 0.11 - t * 0.21);
    return a * 0.52 + b * 0.34 + c * 0.19 + d * 0.24;
  }

  float disturbance(vec2 p) {
    float gap  = length(p - uRippleOrigin) - uRippleAge * ${RIPPLE_SPEED.toFixed(1)};
    float ring = sin(gap * 0.55) * exp(-gap * gap * 0.006);

    vec2  toPointer = p - uPointer;
    float bulge = exp(-dot(toPointer, toPointer) * 0.004);

    return ring * uRipple * 1.6 + bulge * uSwell * 1.15;
  }

  float fieldHeight(vec2 p, float t) {
    return weather(p, t) + disturbance(p);
  }

  void main() {
    vec2 p = position.xz;

    float h  = fieldHeight(p, uTime);
    float hx = fieldHeight(p + vec2(${NORMAL_EPSILON.toFixed(3)}, 0.0), uTime);
    float hz = fieldHeight(p + vec2(0.0, ${NORMAL_EPSILON.toFixed(3)}), uTime);

    vFieldNormal = normalize(vec3(
      (h - hx) * uAmplitude / ${NORMAL_EPSILON.toFixed(3)},
      1.0,
      (h - hz) * uAmplitude / ${NORMAL_EPSILON.toFixed(3)}
    ));
    vPigment = color;
    vField   = p;
    vRelief  = h;

    vec4 mvPosition = modelViewMatrix * vec4(position.x, h * uAmplitude, position.z, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`

const FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform vec2  uPointer;
  uniform float uSwell;
  uniform float uWash;
  uniform vec3  uLightDir;
  uniform vec3  uLightColor;
  uniform vec3  uSkyColor;

  varying vec3  vPigment;
  varying vec3  vFieldNormal;
  varying vec2  vField;
  varying float vRelief;

  #include <fog_pars_fragment>

  vec3 pigmentRamp(float t) {
    float s = fract(t) * ${PIGMENTS.length}.0;
    vec3 c = ${glslColor(PIGMENTS[0])};
${PIGMENTS.map((_, i) => {
  const next = PIGMENTS[(i + 1) % PIGMENTS.length]
  return `    c = mix(c, ${glslColor(next)}, smoothstep(0.0, 1.0, clamp(s - ${i}.0, 0.0, 1.0)));`
}).join('\n')}
    return c;
  }

  void main() {
    vec3 n = normalize(vFieldNormal);
    vec3 l = normalize(uLightDir);

    float lambert = max(dot(n, l), 0.0);
    float sky     = 0.45 + 0.55 * clamp(n.y, 0.0, 1.0);

    // The baked pigment stays legible while a drifting wash migrates a second
    // sample of the same ramp across the relief — pigment moving through water.
    float drift = vField.x * 0.0072 + vField.y * 0.0104 + uTime * 0.021 + vRelief * 0.13;
    vec3 pigment = mix(vPigment, pigmentRamp(drift), uWash);

    // Wherever the pointer stirs, the pigment shifts toward its neighbour hue.
    vec2  toPointer = vField - uPointer;
    float stirred = exp(-dot(toPointer, toPointer) * 0.0035) * uSwell;
    pigment = mix(pigment, pigmentRamp(drift + 0.34), clamp(stirred, 0.0, 0.8));

    vec3 col = pigment * (uSkyColor * 0.55 * sky + uLightColor * lambert * 1.35);
    col += uLightColor * pow(lambert, 14.0) * 0.55;

    // Troughs sink into the atmosphere so the sheet reads as depth, not relief.
    col = mix(col, uSkyColor * 0.30, clamp(0.34 - vRelief * 0.26, 0.0, 0.34));

    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

// ── Construction ──────────────────────────────────────────────────────────────

function buildFieldGeometry() {
  const geometry = new Three.PlaneGeometry(FIELD_SPAN, FIELD_SPAN, FIELD_SEGMENTS, FIELD_SEGMENTS)
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const pigment = new Three.Color()

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const t = pigmentNoise(x * 0.014, z * 0.017) * 1.35 + x * 0.0033 - z * 0.0027
    rampInto(pigment, t)
    colors[i * 3]     = pigment.r
    colors[i * 3 + 1] = pigment.g
    colors[i * 3 + 2] = pigment.b
  }

  geometry.setAttribute('color', new Three.BufferAttribute(colors, 3))
  return geometry
}

function buildFieldMaterial() {
  const uniforms = Object.assign(Three.UniformsUtils.clone(Three.UniformsLib.fog), {
    uTime:         { value: 0 },
    uAmplitude:    { value: AMPLITUDE },
    uPointer:      { value: new Three.Vector2(0, 0) },
    uRippleOrigin: { value: new Three.Vector2(0, 0) },
    uRipple:       { value: 0 },
    uRippleAge:    { value: 0 },
    uSwell:        { value: 0 },
    uWash:         { value: 0.44 },
    uLightDir:     { value: new Three.Vector3(0, 0.46, 0.78).normalize() },
    uLightColor:   { value: LIGHT_DUSK.clone() },
    uSkyColor:     { value: SKY_DUSK.clone() },
  })

  return new Three.ShaderMaterial({
    uniforms,
    vertexShader:   VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    fog:  true,
    side: Three.FrontSide,
  })
}

/**
 * Drive the fog, sky, light colour, and light direction from elapsed time.
 * Shared by setup() and update() so the very first frame is already lit and
 * fogged rather than waiting for the animation loop to catch up.
 */
function applyAtmosphere(ctx, elapsed) {
  const u = ctx._uniforms
  const phase = 0.5 + 0.5 * Math.sin(elapsed * ATMOSPHERE_RATE)

  u.uSkyColor.value.lerpColors(SKY_DUSK, SKY_DAWN, phase)
  u.uLightColor.value.lerpColors(LIGHT_DUSK, LIGHT_DAWN, phase)

  const orbit = elapsed * LIGHT_ORBIT_RATE
  u.uLightDir.value.set(
    Math.sin(orbit) * 0.78,
    0.46 + 0.16 * Math.sin(elapsed * LIGHT_LIFT_RATE),
    Math.cos(orbit) * 0.78,
  ).normalize()

  ctx._sky.lerpColors(FOG_DUSK, FOG_DAWN, phase)
  if (ctx.scene?.fog?.color) ctx.scene.fog.color.copy(ctx._sky)
}

// ── Pointer ───────────────────────────────────────────────────────────────────

/**
 * Project a pointer event onto the resting plane of the field and store it in
 * the uPointer uniform. Returns false when the pointer misses the field (above
 * the horizon) or the canvas has no layout yet.
 */
function projectPointer(ctx, event) {
  const element = ctx.renderer?.domElement
  if (!element) return false

  const rect = element.getBoundingClientRect()
  if (!(rect.width > 0) || !(rect.height > 0)) return false

  ctx._ndc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  )

  ctx.camera.updateMatrixWorld?.()
  ctx._raycaster.setFromCamera(ctx._ndc, ctx.camera)
  if (!ctx._raycaster.ray.intersectPlane(ctx._restPlane, ctx._hit)) return false

  ctx._uniforms.uPointer.value.set(ctx._hit.x, ctx._hit.z)
  return true
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function setup(ctx) {
  ctx.setHelp('Move the pointer to stir the pigment • click to send a chromatic front • drag to orbit')

  const material = buildFieldMaterial()

  ctx._uniforms  = material.uniforms
  ctx._raycaster = new Three.Raycaster()
  ctx._restPlane = new Three.Plane(new Three.Vector3(0, 1, 0), 0)
  ctx._ndc       = new Three.Vector2()
  ctx._hit       = new Three.Vector3()
  ctx._sky       = new Three.Color()
  ctx._swell     = 0
  ctx._rippleStart = null

  // Remember the host atmosphere so teardown can hand the scene back unchanged.
  ctx._previousFog        = ctx.scene?.fog ?? null
  ctx._previousBackground = ctx.scene?.background ?? null

  applyAtmosphere(ctx, 0)

  if (ctx.scene) {
    ctx.scene.fog = new Three.Fog(ctx._sky.getHex(), FOG_NEAR, FOG_FAR)
    ctx.scene.fog.color.copy(ctx._sky)
    ctx.scene.background = ctx._sky
  }

  ctx._field = new Three.Mesh(buildFieldGeometry(), material)
  ctx._field.frustumCulled = false
  ctx.add(ctx._field)

  ctx.camera.position.set(...CAMERA_POSITION)
  ctx.camera.lookAt(...VIEW_TARGET)
  ctx.camera.updateMatrixWorld?.()
  if (ctx.controls?.target) {
    ctx.controls.target.set(...VIEW_TARGET)
    ctx.controls.update?.()
  }
  ctx.setBloom?.(0.35)

  ctx._listeners = [
    ['pointermove', (event) => {
      if (!projectPointer(ctx, event)) return
      ctx._swell = Math.min(1, ctx._swell + SWELL_GAIN)
    }],
    ['pointerdown', (event) => {
      projectPointer(ctx, event)
      ctx._uniforms.uRippleOrigin.value.copy(ctx._uniforms.uPointer.value)
      ctx._rippleStart = ctx.elapsed
      ctx._swell = 1
    }],
    ['pointerleave', () => {
      ctx._swell = Math.min(ctx._swell, 0.15)
    }],
  ]
  ctx._pointerTarget = ctx.renderer?.domElement ?? null
  for (const [type, handler] of ctx._listeners) {
    ctx._pointerTarget?.addEventListener(type, handler)
  }
}

export function update(ctx, dt) {
  const u = ctx._uniforms
  if (!u) return

  const elapsed = ctx.elapsed
  const step = Number.isFinite(dt) ? Math.max(0, dt) : 0

  u.uTime.value = elapsed
  u.uWash.value = 0.44 + 0.20 * Math.sin(elapsed * WASH_RATE)

  ctx._swell = Math.max(0, ctx._swell - step * SWELL_DECAY)
  u.uSwell.value = ctx._swell

  if (ctx._rippleStart === null) {
    u.uRipple.value = 0
    u.uRippleAge.value = 0
  } else {
    const age = Math.max(0, elapsed - ctx._rippleStart)
    const remaining = 1 - age / RIPPLE_LIFE
    u.uRippleAge.value = age
    if (remaining > 0) {
      u.uRipple.value = remaining * remaining
    } else {
      u.uRipple.value = 0
      u.uRippleAge.value = 0
      ctx._rippleStart = null
    }
  }

  applyAtmosphere(ctx, elapsed)
}

export function teardown(ctx) {
  if (ctx._listeners && ctx._pointerTarget) {
    for (const [type, handler] of ctx._listeners) {
      ctx._pointerTarget.removeEventListener(type, handler)
    }
  }
  ctx._listeners = null
  ctx._pointerTarget = null

  if (ctx._field) {
    ctx.remove(ctx._field)
    ctx._field.geometry.dispose()
    ctx._field.material.dispose()
    ctx._field = null
  }

  if (ctx.scene) {
    ctx.scene.fog = ctx._previousFog ?? null
    ctx.scene.background = ctx._previousBackground ?? null
  }

  ctx._uniforms = null
  ctx._raycaster = null
  ctx._restPlane = null
  ctx._sky = null
  ctx._rippleStart = null
  ctx._swell = 0
  ctx.setBloom?.(0)
}
