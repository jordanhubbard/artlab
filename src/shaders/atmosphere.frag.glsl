// Rayleigh/Mie atmospheric scattering fragment shader
// Physically inspired (not full Bruneton - simplified for real-time use)

uniform vec3  uSunPosition;
uniform vec3  uAtmosphereColor;   // per-planet tint
uniform float uAtmosphereStrength; // 1.0 for Earth
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;

void main() {
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewDir);
  vec3 sunDir  = normalize(uSunPosition - vWorldPos);

  // Fresnel-like limb effect: brightest at horizon/edge
  float NdotV = max(0.0, dot(normal, viewDir));
  float limb  = pow(1.0 - NdotV, 3.5);

  // Sun illumination: daylit side of atmosphere glows brighter
  float NdotS   = dot(normal, sunDir);
  float daylight = smoothstep(-0.4, 0.5, NdotS);

  // Rayleigh scattering: blue/cyan during day
  vec3 rayleigh = uAtmosphereColor;

  // Sunset/sunrise effect: orange-red when sun is near horizon
  float sunsetFactor = 1.0 - abs(NdotS);
  sunsetFactor = pow(max(0.0, sunsetFactor), 5.0);
  vec3 sunsetColor = vec3(1.0, 0.35, 0.1);
  rayleigh = mix(rayleigh, sunsetColor, sunsetFactor * daylight * 0.8);

  // Nightside: very faint blue residual glow (earthshine / city lights scatter)
  vec3 nightGlow = uAtmosphereColor * 0.08;

  vec3 color = mix(nightGlow, rayleigh * (0.5 + 0.5 * daylight), daylight);
  color += rayleigh * sunsetFactor * 0.4;

  float alpha = limb * uAtmosphereStrength * uOpacity;
  // Extra alpha on dayside limb
  alpha *= (0.3 + 0.7 * max(0.0, NdotS + 0.4));
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha);
}
