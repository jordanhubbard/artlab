uniform float uTime;
uniform float uAudioBass;
uniform sampler2D uNoiseMap;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

// 2D rotation
vec2 rot2D(vec2 v, float a) {
  float s = sin(a), c = cos(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

void main() {
  vec3 normal = normalize(vNormal);
  // Fresnel: bright at edges
  float fresnel = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), 2.5);

  // Animated turbulence from noise texture
  vec2 uv1 = rot2D(vUv - 0.5, uTime * 0.05) + 0.5;
  vec2 uv2 = rot2D(vUv - 0.5, -uTime * 0.03) * 1.3 + 0.5;
  float n1 = texture2D(uNoiseMap, uv1 * 0.8).r;
  float n2 = texture2D(uNoiseMap, uv2 * 1.2 + 0.3).g;
  float noise = (n1 + n2) * 0.5;

  // Corona color: white core → yellow → orange → transparent
  vec3 coreColor  = vec3(1.0, 1.0, 0.92);
  vec3 midColor   = vec3(1.0, 0.75, 0.2);
  vec3 outerColor = vec3(1.0, 0.3, 0.05);

  float t = fresnel * (0.6 + noise * 0.4);
  vec3 color = mix(outerColor, midColor, smoothstep(0.0, 0.4, t));
  color      = mix(color,      coreColor, smoothstep(0.4, 0.9, t));

  // Tendrils along the corona
  float tendrils = pow(noise, 2.5) * fresnel;
  color += vec3(1.0, 0.9, 0.5) * tendrils * 1.5;

  // Audio-reactive pulsing
  float pulse = 1.0 + uAudioBass * 0.25;
  color *= pulse;

  float alpha = fresnel * (0.7 + noise * 0.3) * 0.9;
  gl_FragColor = vec4(color, alpha);
}
