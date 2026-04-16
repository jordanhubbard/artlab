attribute float aSize;
attribute float aTwinkleSeed;

varying vec3 vColor;
varying float vTwinkle;

uniform float uTime;
uniform float uAudioTreble;

void main() {
  vColor = color;

  // Per-star twinkle using a unique seed per star
  float twinkleFreq = 0.8 + aTwinkleSeed * 3.0;
  float twinklePhase = aTwinkleSeed * 6.2831853;
  vTwinkle = sin(uTime * twinkleFreq + twinklePhase) * 0.5 + 0.5;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float distFade = clamp(1.0 - (-mvPosition.z - 100.0) / 80000.0, 0.2, 1.0);
  gl_PointSize = aSize * distFade * (1.0 + uAudioTreble * vTwinkle * 0.6) * (400.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
