varying vec2  vUv;
varying vec3  vNormal;
varying vec3  vWorldNormal;
varying vec3  vWorldPos;

void main() {
  vUv = uv;
  vNormal      = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldNormal  = normalize(mat3(modelMatrix) * normal);
  vWorldPos     = worldPos.xyz;
  gl_Position   = projectionMatrix * viewMatrix * worldPos;
}
