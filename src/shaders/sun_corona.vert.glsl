varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
  vUv      = uv;
  vNormal  = normalize(normalMatrix * normal);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
