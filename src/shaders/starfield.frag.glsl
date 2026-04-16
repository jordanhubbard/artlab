varying vec3 vColor;
varying float vTwinkle;

uniform float uAudioTreble;

void main() {
  // Circular soft star disk
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;

  // Soft radial falloff — bright center, soft edge
  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
  alpha *= alpha;  // sharper center

  // Audio-reactive twinkle brightens the star
  float twinkleBright = 1.0 + vTwinkle * uAudioTreble * 0.5;

  gl_FragColor = vec4(vColor * twinkleBright, alpha);
}
