uniform sampler2D uRingTexture;  // grayscale ring density map
uniform vec3      uSunDir;        // normalized direction to sun
uniform vec3      uSaturnPos;     // Saturn center world pos
uniform float     uInnerRadius;
uniform float     uOuterRadius;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  // vUv.x: radial (0=inner, 1=outer), from Three.js RingGeometry
  float radial = vUv.x;

  // Sample ring density map
  float density = texture2D(uRingTexture, vec2(radial, 0.5)).r;

  // Cassini Division: dark gap between B and A rings (~u=0.57)
  float cassini = smoothstep(0.54, 0.57, radial) * (1.0 - smoothstep(0.57, 0.60, radial));
  density *= 1.0 - cassini * 0.95;

  // Encke gap (narrow, outer A ring)
  float encke = smoothstep(0.82, 0.84, radial) * (1.0 - smoothstep(0.84, 0.86, radial));
  density *= 1.0 - encke * 0.7;

  // B ring (brightest)
  float bRing = smoothstep(0.25, 0.35, radial) * (1.0 - smoothstep(0.55, 0.58, radial));
  density = mix(density, density * 1.3, bRing);

  // Ring color: icy water + silicate dust
  // Inner rings: darker brownish, outer: brighter icy white
  vec3 innerColor = vec3(0.55, 0.45, 0.32);
  vec3 outerColor = vec3(0.90, 0.85, 0.75);
  vec3 ringColor  = mix(innerColor, outerColor, radial);

  // Lighting
  vec3 normal = normalize(vWorldNormal);
  float NdotS = abs(dot(normal, normalize(uSunDir)));
  float lit   = 0.15 + 0.85 * NdotS;

  // Self-shadowing: inner edge slightly shadowed by Saturn body
  float innerShadow = smoothstep(0.0, 0.12, radial);

  float alpha = density * innerShadow * 0.95;
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(ringColor * lit, alpha);
}
