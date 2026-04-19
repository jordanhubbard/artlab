import { describe, it, expect } from 'vitest'
import * as Three from 'three'
import * as P from '../Physics.js'

const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps
const v3near = (v, x, y, z, eps = 1e-6) =>
  approx(v.x, x, eps) && approx(v.y, y, eps) && approx(v.z, z, eps)

// ── 1. body() ─────────────────────────────────────────────────────────────────
describe('body()', () => {
  it('creates defaults', () => {
    const b = P.body()
    expect(b.mass).toBe(1); expect(b.charge).toBe(0); expect(b.restitution).toBe(1)
    expect(b.position.lengthSq()).toBe(0); expect(b.force.lengthSq()).toBe(0)
  })
  it('clones position so mutations are isolated', () => {
    const pos = new Three.Vector3(1,2,3); const b = P.body({ position: pos })
    pos.set(9,9,9); expect(b.position.x).toBe(1)
  })
  it('accepts mass, charge, restitution', () => {
    const b = P.body({ mass:5, charge:-2, restitution:0.7 })
    expect(b.mass).toBe(5); expect(b.restitution).toBe(0.7)
  })
})

// ── 2. Force accumulation ─────────────────────────────────────────────────────
describe('applyForce()', () => {
  it('accumulates multiple forces', () => {
    const b = P.body()
    P.applyForce(b, new Three.Vector3(1,0,0)); P.applyForce(b, new Three.Vector3(0,2,0))
    expect(v3near(b.force,1,2,0)).toBe(true)
  })
})
describe('applyImpulse()', () => {
  it('Δv = impulse / mass', () => {
    const b = P.body({ mass:2 }); P.applyImpulse(b, new Three.Vector3(4,0,0))
    expect(v3near(b.velocity,2,0,0)).toBe(true)
  })
})
describe('clearForces()', () => {
  it('zeroes the accumulator', () => {
    const b = P.body(); b.force.set(1,2,3); P.clearForces(b)
    expect(b.force.lengthSq()).toBe(0)
  })
})

// ── 3. Force functions ────────────────────────────────────────────────────────
describe('gravityForce()', () => {
  it('F = m·g downward', () => { expect(v3near(P.gravityForce(2,10),0,-20,0)).toBe(true) })
  it('uses SI default g', () => { expect(approx(P.gravityForce(1).y,-P.g_SI)).toBe(true) })
})

describe('gravitationForce()', () => {
  it('directed A→B', () => {
    const f = P.gravitationForce(new Three.Vector3(),1e10,new Three.Vector3(1,0,0),1e10)
    expect(f.x).toBeGreaterThan(0); expect(approx(f.y,0)).toBe(true)
  })
  it('inverse-square: double r → ¼ force', () => {
    const p = new Three.Vector3()
    const f1 = P.gravitationForce(p,1,new Three.Vector3(1,0,0),1,1)
    const f2 = P.gravitationForce(p,1,new Three.Vector3(2,0,0),1,1)
    expect(approx(f1.x/f2.x,4,1e-9)).toBe(true)
  })
  it('zero for coincident positions', () => {
    const p = new Three.Vector3(1,1,1)
    expect(P.gravitationForce(p,1e12,p.clone(),1e12).lengthSq()).toBe(0)
  })
})

describe('dragForce()', () => {
  it('opposes velocity', () => { expect(v3near(P.dragForce(new Three.Vector3(3,0,0),2),-6,0,0)).toBe(true) })
  it('does not mutate input', () => { const v=new Three.Vector3(2,0,0); P.dragForce(v,5); expect(v.x).toBe(2) })
})

describe('quadraticDragForce()', () => {
  it('magnitude ∝ v²', () => {
    const d2=P.quadraticDragForce(new Three.Vector3(2,0,0),1)
    const d4=P.quadraticDragForce(new Three.Vector3(4,0,0),1)
    expect(approx(d4.x/d2.x,4)).toBe(true); expect(d2.x).toBeLessThan(0)
  })
})

describe('springForce()', () => {
  it('zero at rest length', () => {
    expect(P.springForce(new Three.Vector3(),new Three.Vector3(1,0,0),1,10).lengthSq()).toBeLessThan(1e-20)
  })
  it('pulls toward B when stretched', () => {
    expect(approx(P.springForce(new Three.Vector3(),new Three.Vector3(2,0,0),1,10).x,10)).toBe(true)
  })
  it('pushes away when compressed', () => {
    expect(P.springForce(new Three.Vector3(),new Three.Vector3(0.5,0,0),1,10).x).toBeLessThan(0)
  })
  it('damping reduces force on approach', () => {
    const pA=new Three.Vector3(), pB=new Three.Vector3(2,0,0)
    const f0=P.springForce(pA,pB,1,10,new Three.Vector3(),new Three.Vector3(),0)
    const f1=P.springForce(pA,pB,1,10,new Three.Vector3(1,0,0),new Three.Vector3(),5)
    expect(f1.x).toBeLessThan(f0.x)
  })
})

describe('lorentzForce()', () => {
  it('F=q·E when B=0', () => {
    expect(v3near(P.lorentzForce(2,new Three.Vector3(),new Three.Vector3(3,0,0),new Three.Vector3()),6,0,0)).toBe(true)
  })
  it('v×B deflects perpendicular', () => {
    // v=(1,0,0) B=(0,1,0) → v×B=(0,0,+1) → F=2*(0,0,+1)
    expect(approx(P.lorentzForce(2,new Three.Vector3(1,0,0),new Three.Vector3(),new Three.Vector3(0,1,0)).z,2)).toBe(true)
  })
})

describe('buoyancyForce()', () => {
  it('upward with correct magnitude', () => { expect(approx(P.buoyancyForce(1000,0.001,10).y,10)).toBe(true) })
})

// ── 4. Integration ────────────────────────────────────────────────────────────
describe('integrate()', () => {
  it('moves position by v·dt', () => {
    const b=P.body({velocity:new Three.Vector3(1,0,0)}); P.integrate(b,2)
    expect(v3near(b.position,2,0,0)).toBe(true)
  })
  it('accelerates by F/m·dt', () => {
    const b=P.body({mass:2}); b.force.set(4,0,0); P.integrate(b,1)
    expect(v3near(b.velocity,2,0,0)).toBe(true)
  })
  it('clears force accumulator', () => {
    const b=P.body(); b.force.set(5,5,5); P.integrate(b,1); expect(b.force.lengthSq()).toBe(0)
  })
  it('free-fall matches ½g t² within 1%', () => {
    const b=P.body({mass:1}); const g=10,dt=0.01
    for(let i=0;i<100;i++){P.applyForce(b,P.gravityForce(1,g));P.integrate(b,dt)}
    expect(approx(b.position.y,-0.5*g,0.1)).toBe(true)
  })
})

describe('integrateVerlet()', () => {
  it('advances position', () => {
    const b=P.body({velocity:new Three.Vector3(1,0,0)})
    P.integrateVerlet(b,new Three.Vector3(),1); expect(b.position.x).toBeGreaterThan(0)
  })
  it('returns current force for chaining', () => {
    const b=P.body(); b.force.set(2,0,0)
    expect(P.integrateVerlet(b,new Three.Vector3(),1).x).toBe(2)
  })
})

// ── 5. Orbital mechanics ──────────────────────────────────────────────────────
describe('orbitalSpeed()', () => {
  it('ISS-like ≈7700 m/s', () => {
    const v=P.orbitalSpeed(5.972e24,6.371e6+400e3)
    expect(v).toBeGreaterThan(7500); expect(v).toBeLessThan(8000)
  })
  it('∝ 1/√r: quadruple r → half speed', () => {
    expect(approx(P.orbitalSpeed(1e15,100,1)/P.orbitalSpeed(1e15,400,1),2,0.01)).toBe(true)
  })
})

describe('orbitalPeriod()', () => {
  it('Earth ≈ 365 days', () => {
    const d=P.orbitalPeriod(1.496e11,1.989e30)/86400
    expect(d).toBeGreaterThan(364); expect(d).toBeLessThan(367)
  })
  it('Kepler T²∝a³', () => {
    const T1=P.orbitalPeriod(1,1e12,1),T2=P.orbitalPeriod(2,1e12,1)
    expect(approx(T2/T1,Math.pow(2,1.5),0.001)).toBe(true)
  })
})

describe('escapeSpeed()', () => {
  it('= √2 × orbitalSpeed', () => {
    expect(approx(P.escapeSpeed(1e24,1e7,1)/P.orbitalSpeed(1e24,1e7,1),Math.SQRT2)).toBe(true)
  })
})

describe('meanAnomaly()', () => {
  it('0 at t=0', () => { expect(P.meanAnomaly(0,100)).toBe(0) })
  it('π at t=T/2', () => { expect(approx(P.meanAnomaly(50,100),Math.PI)).toBe(true) })
})

describe('solveKepler()', () => {
  it('E=M for e=0', () => { expect(approx(P.solveKepler(1.2,0),1.2)).toBe(true) })
  it('satisfies M=E-e·sin(E)', () => {
    const M=0.8,e=0.5,E=P.solveKepler(M,e)
    expect(approx(M,E-e*Math.sin(E))).toBe(true)
  })
})

describe('keplerPosition()', () => {
  it('periapsis: x=a(1-e), z=0', () => {
    const {x,z}=P.keplerPosition(10,0.3,0)
    expect(approx(x,7,1e-5)).toBe(true); expect(approx(z,0,1e-5)).toBe(true)
  })
  it('apoapsis: x≈-a(1+e), z≈0', () => {
    const {x,z}=P.keplerPosition(10,0.3,Math.PI)
    expect(approx(x,-13,1e-4)).toBe(true); expect(approx(z,0,1e-4)).toBe(true)
  })
  it('circle: constant radius', () => {
    for(const f of[0,0.25,0.5,0.75]){
      const {x,z}=P.keplerPosition(5,0,f*2*Math.PI)
      expect(approx(Math.hypot(x,z),5,1e-4)).toBe(true)
    }
  })
})

describe('visViva()', () => {
  it('r=a → orbitalSpeed', () => {
    expect(approx(P.visViva(1e10,100,100,1),P.orbitalSpeed(1e10,100,1))).toBe(true)
  })
  it('periapsis speed > circular', () => {
    const G=1,M=1e10,a=100,e=0.5,r=a*(1-e)
    expect(P.visViva(M,r,a,G)).toBeGreaterThan(P.orbitalSpeed(M,r,G))
  })
})

// ── 6. Collision ──────────────────────────────────────────────────────────────
describe('sphereOverlap()', () => {
  it('0 when separated', () => {
    expect(P.sphereOverlap(new Three.Vector3(),1,new Three.Vector3(3,0,0),1)).toBe(0)
  })
  it('positive depth when overlapping', () => {
    expect(P.sphereOverlap(new Three.Vector3(),1,new Three.Vector3(1,0,0),1)).toBe(1)
  })
})

describe('resolveCollision()', () => {
  it('elastic equal-mass: velocities swap', () => {
    const a=P.body({position:new Three.Vector3(-1,0,0),velocity:new Three.Vector3(2,0,0)})
    const b=P.body({position:new Three.Vector3(1,0,0),velocity:new Three.Vector3(0,0,0)})
    P.resolveCollision(a,b,1)
    expect(approx(a.velocity.x,0,1e-9)).toBe(true); expect(approx(b.velocity.x,2,1e-9)).toBe(true)
  })
  it('conserves momentum', () => {
    const a=P.body({position:new Three.Vector3(-1,0,0),mass:2,velocity:new Three.Vector3(3,0,0)})
    const b=P.body({position:new Three.Vector3(1,0,0),mass:3,velocity:new Three.Vector3(-1,0,0)})
    const p0=a.mass*a.velocity.x+b.mass*b.velocity.x
    P.resolveCollision(a,b,0.8)
    expect(approx(p0,a.mass*a.velocity.x+b.mass*b.velocity.x,1e-9)).toBe(true)
  })
  it('no impulse when separating', () => {
    const a=P.body({position:new Three.Vector3(-1,0,0),velocity:new Three.Vector3(-1,0,0)})
    const b=P.body({position:new Three.Vector3(1,0,0),velocity:new Three.Vector3(1,0,0)})
    const vx=a.velocity.x; P.resolveCollision(a,b,1); expect(a.velocity.x).toBe(vx)
  })
})

describe('separateSpheres()', () => {
  it('eliminates overlap', () => {
    const a=P.body({position:new Three.Vector3(0,0,0),mass:1})
    const b=P.body({position:new Three.Vector3(1,0,0),mass:1})
    P.separateSpheres(a,1,b,1)
    expect(P.sphereOverlap(a.position,1,b.position,1)).toBeLessThan(1e-9)
  })
  it('heavier body moves less', () => {
    const a=P.body({position:new Three.Vector3(0,0,0),mass:1})
    const b=P.body({position:new Three.Vector3(1,0,0),mass:100})
    P.separateSpheres(a,1,b,1)
    expect(Math.abs(a.position.x)).toBeGreaterThan(Math.abs(b.position.x-1))
  })
})

// ── 7. Energy & momentum ──────────────────────────────────────────────────────
describe('kineticEnergy()', () => {
  it('½mv²', () => {
    expect(approx(P.kineticEnergy(P.body({velocity:new Three.Vector3(3,4,0),mass:2})),25)).toBe(true)
  })
})
describe('gravitationalPotentialEnergy()', () => {
  it('is negative', () => { expect(P.gravitationalPotentialEnergy(1e10,1,1e6)).toBeLessThan(0) })
})
describe('springPotentialEnergy()', () => {
  it('½kx²', () => { expect(approx(P.springPotentialEnergy(10,2),20)).toBe(true) })
})
describe('momentum()', () => {
  it('p=mv', () => {
    expect(v3near(P.momentum(P.body({velocity:new Three.Vector3(2,0,0),mass:3})),6,0,0)).toBe(true)
  })
})
describe('angularMomentum()', () => {
  it('r×mv perpendicular to both', () => {
    const b=P.body({velocity:new Three.Vector3(0,1,0),mass:1})
    const L=P.angularMomentum(new Three.Vector3(1,0,0),b)
    expect(approx(L.z,1)).toBe(true); expect(approx(L.x,0)).toBe(true)
  })
})

// ── 8. Fields ─────────────────────────────────────────────────────────────────
describe('uniformField()', () => {
  it('has requested magnitude', () => {
    expect(approx(P.uniformField(new Three.Vector3(1,0,0),5).length(),5)).toBe(true)
  })
  it('normalises direction', () => {
    expect(approx(P.uniformField(new Three.Vector3(3,4,0),10).length(),10,1e-5)).toBe(true)
  })
})
describe('radialField()', () => {
  it('positive → attracts', () => {
    expect(P.radialField(new Three.Vector3(),new Three.Vector3(5,0,0),1).x).toBeLessThan(0)
  })
  it('negative → repels', () => {
    expect(P.radialField(new Three.Vector3(),new Three.Vector3(5,0,0),-1).x).toBeGreaterThan(0)
  })
  it('zero at coincident point', () => {
    const p=new Three.Vector3(1,1,1)
    expect(P.radialField(p,p.clone(),100).lengthSq()).toBe(0)
  })
})
describe('vortexField()', () => {
  it('tangential — no radial/axial component', () => {
    const f=P.vortexField(new Three.Vector3(),new Three.Vector3(0,1,0),new Three.Vector3(1,0,0),1)
    expect(approx(f.y,0,1e-9)).toBe(true); expect(approx(f.x,0,1e-9)).toBe(true)
  })
})
