import * as Three from 'three'

// Factory functions — each returns the Three.js light object
export function ambient(color = 0x404040, intensity = 1) {
  return new Three.AmbientLight(color, intensity)
}
export function point(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
  return new Three.PointLight(color, intensity, distance, decay)
}
export function directional(color = 0xffffff, intensity = 1) {
  const l = new Three.DirectionalLight(color, intensity)
  l.castShadow = true
  l.shadow.mapSize.setScalar(2048)
  return l
}
export function spot(color = 0xffffff, intensity = 1, distance = 0, angle = Math.PI/4, penumbra = 0.1) {
  const l = new Three.SpotLight(color, intensity, distance, angle, penumbra)
  l.castShadow = true
  return l
}
export function hemisphere(skyColor = 0x88aaff, groundColor = 0x332211, intensity = 1) {
  return new Three.HemisphereLight(skyColor, groundColor, intensity)
}

// Add a light to a scene with optional position
export function addLight(scene, light, position) {
  if (position) light.position.set(...position)
  scene.add(light)
  return light
}
