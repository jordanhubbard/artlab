// @ts-check
// Phasor superposition: sum complex amplitudes BEFORE taking squared magnitude.
import * as Three from 'three'
import { stage, shaderPanel, controlPanel } from '../../src/stdlib/sketch.ts'

/** Analytic two-source intensity, useful for comparing constructive/destructive interference.
 * @param {number} distanceA @param {number} distanceB @param {number} wavelength @param {number} phase
 */
export function intensity(distanceA, distanceB, wavelength, phase) {
  return (1 + Math.cos(2 * Math.PI * (distanceA - distanceB) / wavelength - phase)) / 2
}

const fragment = `
  varying vec2 vUv;
  uniform float time, wavelength, phase, separation;
  vec3 palette(float t) {
    return 0.5+0.5*cos(6.28318*(vec3(0.07,0.28,0.48)+t*0.65));
  }
  void main() {
    vec2 p=(vUv-0.5)*vec2(15.0,10.0);
    float da=length(p-vec2(-separation,0.0));
    float db=length(p-vec2(separation,0.0));
    float k=6.283185/wavelength;
    float a=k*da-time*1.8;
    float b=k*db-time*1.8+phase;
    vec2 phasor=vec2(cos(a)+cos(b),sin(a)+sin(b))*0.5;
    float power=dot(phasor,phasor);
    float wave=(sin(a)+sin(b))*0.25+0.5;
    float contour=pow(0.5+0.5*cos((da-db)*k-phase),12.0);
    vec3 ink=mix(vec3(0.008,0.02,0.065),palette(power*0.6+wave*0.22),pow(power,0.7));
    ink+=vec3(0.18,0.45,0.5)*contour*0.35;
    float sources=exp(-da*da*32.0)+exp(-db*db*32.0);
    ink+=vec3(1.6,0.8,0.25)*sources;
    // Metrology grid, vignette, and thin margins make the field legible.
    vec2 cell=abs(fract(p)-0.5);
    float grid=1.0-smoothstep(0.47,0.49,max(cell.x,cell.y));
    ink+=vec3(0.035,0.055,0.07)*(1.0-grid);
    ink*=0.55+0.45*pow(max(0.0,16.0*vUv.x*vUv.y*(1.0-vUv.x)*(1.0-vUv.y)),0.25);
    gl_FragColor=vec4(ink,1.0);
  }
`
/** @typedef {{ uniforms: { time: { value: number }, wavelength: { value: number }, phase: { value: number }, separation: { value: number } } }} State */
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function setup(ctx) {
  ctx.setHelp('Interference Atlas · complex amplitudes → intensity · change phase to move the nodal lines')
  stage(ctx, [0, 0, 10], 0.15)
  ctx.controls.enabled = false
  const uniforms = { time: { value: 0 }, wavelength: { value: 1.15 }, phase: { value: 0 }, separation: { value: 2 } }
  ctx.state = { uniforms }
  shaderPanel(ctx, fragment, uniforms, 15, 10)
  controlPanel(ctx, 'INTERFERENCE ATLAS / COHERENT SOURCES', {
    Wavelength: { min: 0.3, max: 2.5, step: 0.05, value: 1.15, change: v => { uniforms.wavelength.value = v } },
    Phase: { min: 0, max: 6.28, step: 0.02, value: 0, change: v => { uniforms.phase.value = v } },
    Separation: { min: 0.1, max: 4, step: 0.1, value: 2, change: v => { uniforms.separation.value = v } },
  })
}
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx @param {number} dt */
export function update(ctx, dt) { ctx.state.uniforms.time.value += Math.min(dt, 0.05) }
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function teardown(ctx) { return ctx.scope.dispose() }
