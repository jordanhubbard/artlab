import * as Three from 'three'

// Factory functions — each returns the Three.js light object
/** @param {Three.ColorRepresentation} [color] */
export function ambient(color: Three.ColorRepresentation = 0x404040, intensity = 1) {
  return new Three.AmbientLight(color, intensity)
}
/** @param {Three.ColorRepresentation} [color] */
export function point(color: Three.ColorRepresentation = 0xffffff, intensity = 1, distance = 0, decay = 2) {
  return new Three.PointLight(color, intensity, distance, decay)
}
/** @param {Three.ColorRepresentation} [color] */
export function directional(color: Three.ColorRepresentation = 0xffffff, intensity = 1) {
  const l = new Three.DirectionalLight(color, intensity)
  l.castShadow = true
  l.shadow.mapSize.setScalar(2048)
  return l
}
/** @param {Three.ColorRepresentation} [color] */
export function spot(color: Three.ColorRepresentation = 0xffffff, intensity = 1, distance = 0, angle = Math.PI/4, penumbra = 0.1) {
  const l = new Three.SpotLight(color, intensity, distance, angle, penumbra)
  l.castShadow = true
  return l
}
/** @param {Three.ColorRepresentation} [skyColor] @param {Three.ColorRepresentation} [groundColor] */
export function hemisphere(skyColor: Three.ColorRepresentation = 0x88aaff, groundColor: Three.ColorRepresentation = 0x332211, intensity = 1) {
  return new Three.HemisphereLight(skyColor, groundColor, intensity)
}

// Add a light to a scene with optional position
export function addLight<L extends Three.Light>(scene: Three.Object3D, light: L, position?: [number, number, number]) {
  if (position) light.position.set(...position)
  scene.add(light)
  return light
}
