uniform sampler2D uJupiterMap;
uniform vec3      uSunDirection;
uniform float     uTime;
uniform float     uAudioMid;     // 0..1

varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
  vec3 normal = normalize(vWorldNormal);
  float NdotL = dot(normal, normalize(uSunDirection));

  // Latitude-based cloud band shear (each latitudinal band drifts at different speed)
  float latitude  = vUv.y;
  float bandPhase = sin(latitude * 3.14159 * 8.0);
  float bandSpeed = bandPhase * 0.0015;
  float distortedU = vUv.x + uTime * bandSpeed;

  // Great Red Spot: oval vortex at ~28°S latitude (vUv.y ≈ 0.36)
  vec2 grsCenter  = vec2(0.33 + uTime * 0.000025, 0.36);  // very slow GRS drift
  vec2 grsDelta   = vUv - grsCenter;
  // Stretch into oval (2:1 aspect)
  grsDelta.x     *= 0.5;
  float grsDist   = length(grsDelta);
  float grsAngle  = atan(grsDelta.y, grsDelta.x);
  float grsSwirl  = smoothstep(0.065, 0.0, grsDist);
  vec2 swirlUV    = vec2(cos(grsAngle + grsDist * 25.0 - uTime * 0.04),
                         sin(grsAngle + grsDist * 25.0 - uTime * 0.04));
  vec2 swirlOffset = swirlUV * grsSwirl * 0.018;

  vec4 color = texture2D(uJupiterMap, vec2(fract(distortedU), vUv.y) + swirlOffset);

  // GRS orange-red enhancement
  color.rgb = mix(color.rgb, vec3(0.75, 0.25, 0.1), grsSwirl * 0.35);

  // Lighting
  float light = max(0.0, NdotL) * 0.85 + 0.15;
  color.rgb *= light;

  // Audio-reactive brightness on the cloud bands
  color.rgb *= 1.0 + uAudioMid * 0.12;

  gl_FragColor = color;
}
