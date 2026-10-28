// @ts-check
// Emission-absorption volume integration, NOT distance-to-surface raymarching.
import { stage, shaderPanel, controlPanel } from '../../src/stdlib/sketch.js'

/** Beer-Lambert opacity for one integration interval.
 * @param {number} density @param {number} distance
 */
export function opacity(density, distance) { return 1 - Math.exp(-density * distance) }

const fragment = `
  varying vec2 vUv;
  uniform float time, density, cut, yaw;
  float field(vec3 p) {
    float r=length(p.xz);
    float angle=atan(p.z,p.x);
    float shell=exp(-pow((length(p)-0.72)*22.0,2.0));
    float filament=exp(-pow((r-0.48-0.09*sin(p.y*12.0+angle*3.0+time*0.3))*24.0,2.0));
    float bands=0.35+0.65*pow(0.5+0.5*sin(angle*9.0+p.y*17.0-time*0.5),3.0);
    return (shell*0.45+filament*bands)*(1.0-smoothstep(0.75,1.0,length(p)));
  }
  void main() {
    vec2 uv=(vUv-0.5)*vec2(1.5,1.0);
    vec3 ro=vec3(sin(yaw)*2.8,0.7,cos(yaw)*2.8);
    vec3 f=normalize(-ro), right=normalize(cross(f,vec3(0,1,0)));
    vec3 up=cross(right,f);
    vec3 rd=normalize(f+uv.x*right+uv.y*up);
    vec3 inv=1.0/rd;
    vec3 a=(-vec3(1.0)-ro)*inv, b=(vec3(1.0)-ro)*inv;
    vec3 nearT=min(a,b), farT=max(a,b);
    float start=max(max(nearT.x,nearT.y),nearT.z);
    float end=min(min(farT.x,farT.y),farT.z);
    vec3 color=vec3(0.0); float transmittance=1.0;
    if(end>max(start,0.0)) {
      start=max(start,0.0);
      float stepSize=(end-start)/96.0;
      for(int i=0;i<96;i++) {
        vec3 p=ro+rd*(start+(float(i)+0.5)*stepSize);
        if(p.x>cut) continue;
        float d=field(p);
        float alpha=1.0-exp(-d*density*stepSize);
        vec3 emission=mix(vec3(0.06,0.35,0.95),vec3(1.0,0.35,0.08),clamp(d,0.0,1.0));
        color+=transmittance*alpha*emission*1.8;
        transmittance*=1.0-alpha;
        if(transmittance<0.01) break;
      }
    }
    vec3 bg=mix(vec3(0.008,0.014,0.04),vec3(0.025,0.05,0.08),vUv.y);
    color+=transmittance*bg;
    // Reticle stays outside the object: the viewer is an instrument, not a skybox.
    float border=step(0.49,abs(vUv.x-0.5))+step(0.49,abs(vUv.y-0.5));
    color+=border*vec3(0.10,0.25,0.32);
    gl_FragColor=vec4(color,1.0);
  }
`
/** @typedef {{ uniforms: { time: { value: number }, density: { value: number }, cut: { value: number }, yaw: { value: number } } }} State */
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function setup(ctx) {
  ctx.setHelp('Volume Observatory · 96 depth samples per pixel · slice the scalar field · compare absorption')
  stage(ctx, [0, 0, 10], 0)
  ctx.controls.enabled = false
  const uniforms = { time: { value: 0 }, density: { value: 8 }, cut: { value: 0.35 }, yaw: { value: 0.65 } }
  ctx.state = { uniforms }
  shaderPanel(ctx, fragment, uniforms, 15, 10)
  controlPanel(ctx, 'VOLUME OBSERVATORY / EMISSION + ABSORPTION', {
    Density: { min: 1, max: 25, step: 0.5, value: 8, change: v => { uniforms.density.value = v } },
    'Slice X': { min: -1, max: 1, step: 0.01, value: 0.35, change: v => { uniforms.cut.value = v } },
    View: { min: 0, max: 6.28, step: 0.01, value: 0.65, change: v => { uniforms.yaw.value = v } },
  })
}
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx @param {number} dt */
export function update(ctx, dt) { ctx.state.uniforms.time.value += Math.min(dt, 0.05) }
/** @param {import('../../src/runtime/contracts').SketchContext<State>} ctx */
export function teardown(ctx) { return ctx.scope.dispose() }
