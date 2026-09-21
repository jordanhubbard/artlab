import * as Three from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { atmosphere, snowfall, hash, NOISE } from './NorthernAtmosphere.js'

/** A sculpted fjord, with planar reflections and a shader-driven northern sky. */
export class NordicLandscape {
  constructor() {
    this.object = new Three.Group()
    this.object.name = 'Northern light / sculpted fjord'
    const air = atmosphere()
    this.sky = air.sky
    this.aurora = air.aurora
    this.uniforms = air.uniforms
    this.mountains = [mountains(-30, 0), mountains(-49, 1), mountains(-69, 2)]
    this.lake = makeIce()
    this.cabin = cabin()
    this.cabin.position.set(-8, -2.25, -13)
    this.shore = new Three.Mesh(new Three.SphereGeometry(1, 64, 32), new Three.MeshStandardMaterial({color:0x9fbacc,roughness:.94}))
    this.shore.scale.set(5.5,.7,4)
    this.shore.position.set(-8,-3,-13)
    this.trees = forest()
    this.birches = birches()
    this.snow = snowfall()
    this.object.add(this.sky, ...this.mountains, this.lake, this.shore, this.cabin, this.trees, this.birches, this.snow, this.aurora)
  }

  update(_dt, position, activity) {
    const { id } = position.act
    this.object.visible = !['loose-pixel', 'copper-tunnel', 'color-storm'].includes(id)
    if (!this.object.visible) return
    const t = position.seconds
    this.uniforms.uTime.value = t
    this.uniforms.uDawn.value = id === 'first-light' ? .35 + position.actProgress * .65 : id === 'hearth-song' ? .12 : 0
    this.uniforms.uEnergy.value = id === 'aurora-code' ? .65 + activity.chord * .35 : .12
    this.aurora.visible = id !== 'hearth-song'
    this.cabin.visible = id !== 'birch-run'
    this.birches.visible = id === 'birch-run'
    this.lake.material.uniforms.uTime.value = t
    this.snow.material.uniforms.uTime.value = t
    this.cabin.userData.windows.emissiveIntensity = 1.4 + Math.sin(t * 3.1) * .09 + activity.chord * .12
  }

  dispose() { this.lake.dispose() }
}

function noise(x, z) {
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz
  const a=fx*fx*(3-2*fx), b=fz*fz*(3-2*fz)
  const h=(i,j)=>hash(i*17.17+j*93.7)
  return Three.MathUtils.lerp(Three.MathUtils.lerp(h(ix,iz),h(ix+1,iz),a),Three.MathUtils.lerp(h(ix,iz+1),h(ix+1,iz+1),a),b)
}

function elevation(x,z,layer) {
  let sum=0, scale=.075, weight=1
  for(let i=0;i<6;i++){sum+=weight*(1-Math.abs(noise(x*scale+layer*13,z*scale)*2-1));scale*=2.07;weight*=.48}
  const valley=1-.74*Math.exp(-Math.pow((x-4)/12,2))
  return sum*12*valley-3.4
}

function mountains(z, layer) {
  const geometry=new Three.PlaneGeometry(120,30,240,64)
  geometry.rotateX(-Math.PI/2)
  const p=geometry.attributes.position
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i), depth=p.getZ(i)+z
    const taper=Math.sin((p.getZ(i)+15)/30*Math.PI)
    p.setXYZ(i,x,elevation(x,depth,layer)*Math.pow(Math.max(0,taper),.5)-2*(1-taper),depth)
  }
  geometry.computeVertexNormals()
  const colors=new Float32Array(p.count*3), normal=geometry.attributes.normal
  const rock=new Three.Color(0x23364a), snow=new Three.Color(0xb2ccdf), color=new Three.Color()
  for(let i=0;i<p.count;i++) {
    const snowLine=Three.MathUtils.smoothstep(p.getY(i)+noise(p.getX(i)*1.2,p.getZ(i)*1.2)*2,0,5)
    const cover=snowLine*Three.MathUtils.smoothstep(normal.getY(i),.25,.85)
    color.copy(rock).lerp(snow,cover).multiplyScalar(1-layer*.12)
    color.toArray(colors,i*3)
  }
  geometry.setAttribute('color',new Three.BufferAttribute(colors,3))
  return new Three.Mesh(geometry,new Three.MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:.08}))
}

function makeIce() {
  const shader = {
    uniforms: { ...Reflector.ReflectorShader.uniforms, uTime: { value: 0 } },
    vertexShader: `uniform mat4 textureMatrix;varying vec4 vReflection;varying vec3 vWorld;void main(){vReflection=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;uniform float uTime;varying vec4 vReflection;varying vec3 vWorld;
      ${NOISE}
      void main(){
        vec2 uv=vReflection.xy/vReflection.w;
        vec2 p=vWorld.xz;
        uv+=vec2(sin(p.y*2.1+uTime*.32),sin(p.x*1.4+uTime*.25))*.0007;
        vec3 reflection=texture2D(tDiffuse,uv).rgb;
        float frost=fbm(p*.4);
        float vein=1.-smoothstep(.0,.035,abs(noise(p*.21+fbm(p*.04)*4.)-.5));
        vec3 view=normalize(cameraPosition-vWorld);
        float fresnel=.38+.5*pow(1.-max(view.y,0.),3.);
        vec3 col=mix(vec3(.012,.033,.052),reflection,fresnel);
        col+=vec3(.09,.2,.26)*vein*.23+vec3(.035,.07,.09)*frost;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }
  const ice=new Reflector(new Three.PlaneGeometry(220,220),{textureWidth:1024,textureHeight:1024,clipBias:.003,multisample:0,shader})
  ice.rotation.x=-Math.PI/2
  ice.position.set(0,-2.8,-30)
  return ice
}

function cabin() {
  const group=new Three.Group()
  const wood=new Three.MeshStandardMaterial({color:0x732c29,roughness:.9})
  const white=new Three.MeshStandardMaterial({color:0xc4d4de,roughness:.8})
  const dark=new Three.MeshStandardMaterial({color:0x27313a,roughness:.8})
  const windows=new Three.MeshStandardMaterial({color:0xeec18b,emissive:0xffa544,emissiveIntensity:1.4})
  group.userData.windows=windows
  const box=(size,pos,mat)=>{const m=new Three.Mesh(new Three.BoxGeometry(...size),mat);m.position.set(...pos);group.add(m);return m}
  box([3.5,2.3,2.7],[0,.9,0],wood)
  for(let i=0;i<16;i++) box([.07,2.25,.045],[-1.65+i*.22,.9,1.37],dark)
  for(const side of [-1,1]) {
    const roof=box([2.4,.16,3.3],[side*.94,2.51,0],white)
    roof.rotation.z=-side*.52
  }
  for(const x of [-.95,.95]) {
    box([.72,.83,.08],[x,1.13,1.4],white)
    box([.57,.68,.09],[x,1.13,1.46],windows)
    box([.035,.72,.1],[x,1.13,1.52],white)
    box([.62,.035,.1],[x,1.13,1.52],white)
  }
  box([.6,1.45,.08],[0,.5,1.4],dark)
  box([.35,1.2,.4],[.7,2.95,-.4],dark)
  const lamp=new Three.PointLight(0xffa351,14,9,2);lamp.position.set(0,1.1,2.5);group.add(lamp)
  return group
}

function forest() {
  const group=new Three.Group(), pose=new Three.Object3D()
  const count=70, tiers=10, branches=7
  const wood=new Three.InstancedMesh(new Three.CylinderGeometry(.025,.11,1,7),new Three.MeshStandardMaterial({color:0x283236,roughness:1}),count)
  const foliage=new Three.InstancedMesh(new Three.ConeGeometry(1,1,9),new Three.MeshStandardMaterial({color:0x183331,roughness:.95}),count*tiers*branches)
  const snow=new Three.InstancedMesh(new Three.ConeGeometry(1,1,9),new Three.MeshStandardMaterial({color:0x8aa6b5,roughness:.9}),count*tiers*branches)
  let index=0
  for(let i=0;i<count;i++) {
    const side=i%2 ? -1:1, x=side*(10+hash(i+3)*25), z=-9-hash(i+80)*31, h=3+hash(i+40)*5
    pose.position.set(x,h*.5-2.8,z);pose.rotation.set(0,0,0);pose.scale.set(1,h,1);pose.updateMatrix();wood.setMatrixAt(i,pose.matrix)
    for(let tier=0;tier<tiers;tier++) for(let b=0;b<branches;b++) {
      const f=tier/tiers, angle=b/branches*Math.PI*2+tier*.8, radius=(1-f)*h*.23
      pose.position.set(x+Math.cos(angle)*radius*.55,-2.4+h*f,z+Math.sin(angle)*radius*.55)
      pose.rotation.set(Math.sin(angle)*.42,angle,Math.cos(angle)*.42)
      pose.scale.set(radius*.6,h*.22,radius*.6);pose.updateMatrix();foliage.setMatrixAt(index,pose.matrix)
      pose.position.y+=h*.075;pose.scale.multiplyScalar(.77);pose.updateMatrix();snow.setMatrixAt(index,pose.matrix)
      index++
    }
  }
  group.add(wood,foliage,snow)
  return group
}

function birches() {
  const group=new Three.Group(), pose=new Three.Object3D(), count=72
  const material=new Three.MeshStandardMaterial({color:0xc4cdd0,roughness:.8})
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBark;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBark=position;')
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBark;').replace('#include <color_fragment>','#include <color_fragment>\nfloat scar=step(.88,sin(vBark.y*145.+sin(vBark.x*180.)*2.)); diffuseColor.rgb*=1.-scar*.78;')
  }
  const trunks=new Three.InstancedMesh(new Three.CylinderGeometry(.055,.12,1,12),material,count)
  const branches=new Three.InstancedMesh(new Three.CylinderGeometry(.003,.035,1,7),material,count*8)
  for(let i=0;i<count;i++) {
    const x=(i%2 ? -1:1)*(3+hash(i)*17),z=4-hash(i+80)*45,h=5+hash(i+60)*5
    pose.position.set(x,h*.5-2.8,z);pose.rotation.set(0,0,(hash(i+20)-.5)*.15);pose.scale.set(1,h,1);pose.updateMatrix();trunks.setMatrixAt(i,pose.matrix)
    for(let j=0;j<8;j++) {
      const angle=j*2.4, length=1+hash(i+j)*2
      pose.position.set(x+Math.cos(angle)*length*.35,-2.8+h*(.5+j*.055),z+Math.sin(angle)*length*.35)
      pose.rotation.set(Math.sin(angle)*.95,0,Math.cos(angle)*.95);pose.scale.set(1,length,1);pose.updateMatrix();branches.setMatrixAt(i*8+j,pose.matrix)
    }
  }
  group.add(trunks,branches)
  return group
}
