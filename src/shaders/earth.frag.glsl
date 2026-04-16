uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uCloudsMap;
uniform sampler2D uSpecularMap;
uniform vec3  uSunDirection;   // normalized, world space
uniform float uCloudTime;      // slowly increasing for cloud rotation
uniform float uAudioBass;      // 0..1

varying vec2  vUv;
varying vec3  vNormal;
varying vec3  vWorldNormal;
varying vec3  vWorldPos;
varying vec3  vViewDir;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 sunDir = normalize(uSunDirection);

  float NdotL  = dot(normal, sunDir);
  float dayMix = smoothstep(-0.25, 0.3, NdotL);

  // Day texture
  vec4 dayColor = texture2D(uDayMap, vUv);
  // Night texture (city lights)
  vec4 nightColor = texture2D(uNightMap, vUv);

  // Clouds: scroll UV slowly
  vec2 cloudUv = vUv + vec2(uCloudTime * 0.00008, 0.0);
  float cloud   = texture2D(uCloudsMap, cloudUv).r;

  // Specular ocean reflection
  vec4 spec = texture2D(uSpecularMap, vUv);
  vec3 halfVec = normalize(sunDir + normalize(vViewDir));
  float specular = pow(max(0.0, dot(normal, halfVec)), 60.0) * spec.r * dayMix;

  // Blend day/night
  vec4 color = mix(nightColor * 0.9, dayColor, dayMix);

  // Add clouds over day side (white clouds cast shadow too)
  float cloudBright = mix(0.0, 1.0, dayMix);
  color.rgb = mix(color.rgb, vec3(0.95, 0.97, 1.0), cloud * cloudBright * 0.75);

  // Night side: city lights glow through thin cloud cover
  color.rgb += nightColor.rgb * (1.0 - dayMix) * (1.0 - cloud * 0.5) * 1.2;

  // Specular highlight
  color.rgb += vec3(1.0, 0.98, 0.9) * specular * 0.8;

  // Audio-reactive: very subtle pulse on the lit side
  color.rgb *= 1.0 + uAudioBass * dayMix * 0.04;

  gl_FragColor = vec4(color.rgb, 1.0);
}
