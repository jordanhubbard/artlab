import * as Three from 'three'
import { ShaderSurface } from '../../src/stdlib/scene/ShaderSurface.js'

/** Full-resolution sphere tracing: signed-distance sculpture, shadows, AO and a reflection bounce. */
export class DemoGraphics extends ShaderSurface {
  constructor(renderer = { domElement: { width: 1280, height: 720 } }) {
    super(renderer, FRAGMENT, {
      uMode: { value: 0 }, uBeat: { value: 0 }, uProgress: { value: 0 },
      uEnergy: { value: new Three.Vector3() },
    })
    this.object.name = 'Ray-traced light sculpture'
    this.object.renderOrder = 20
    this.object.visible = false
  }

  update(dt, position, activity) {
    // ShaderSurface initializes resolution before the subclass is constructed.
    if (typeof position === 'number') return super.update(dt, position)
    const index = ['loose-pixel', 'copper-tunnel', 'color-storm'].indexOf(position.act.id)
    this.object.visible = index >= 0
    if (index < 0) return
    super.update(dt, position.seconds)
    this.uniforms.uMode.value = index
    this.uniforms.uBeat.value = position.absoluteBeat
    this.uniforms.uProgress.value = position.actProgress
    this.uniforms.uEnergy.value.set(activity.bass, activity.melody, activity.drums)
  }
}

const FRAGMENT = /* glsl */`
  precision highp float;
  uniform float uTime,uMode,uBeat,uProgress;
  uniform vec2 uResolution;
  uniform vec3 uEnergy;
  const float PI=3.14159265359;
  mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
  vec3 palette(float t){return .48+.42*cos(6.28318*(t+vec3(.02,.33,.59)));}

  // Analytic distance estimates, conservatively stepped where domain warping is used.
  vec2 field(vec3 p){
    if(uMode>.5 && uMode<1.5){
      float section=floor((p.z+1.1)/2.2);
      float helix=atan(p.y,p.x)-p.z*.06;
      float ribs=length(vec2(length(p.xy)-3.45,sin(helix*6.)*.65))-.055;
      p.xy=rot(section*.13+sin(section*.3+uTime*.17)*.15)*p.xy;
      float a=atan(p.y,p.x), r=length(p.xy);
      float hex=cos(mod(a+PI/6.,PI/3.)-PI/6.)*r;
      float z=mod(p.z+1.1,2.2)-1.1;
      float frame=length(vec2(hex-3.2,z))-.105;
      return vec2(min(frame,ribs)*.75,section*.075);
    }
    p.xz=rot(uTime*.18)*p.xz;
    p.yz=rot(.32*sin(uTime*.22))*p.yz;
    float a=atan(p.y,p.x), r=length(p.xy);
    if(uMode<.5){
      float d=100.,material=0.;
      for(int i=0;i<3;i++){
        float phase=float(i)*2.0944;
        float radius=2.0+.48*cos(3.*a+phase+uTime*.25);
        float z=.85*sin(3.*a+phase+uTime*.25);
        float strand=length(vec2(r-radius,p.z-z))-(.16+.03*sin(uBeat*.5));
        if(strand<d){d=strand;material=float(i)*.27+a*.025;}
      }
      return vec2(d*.48,material);
    }
    // Twelve folded petals unfold into an iridescent mechanical snow crystal.
    float sector=2.*PI/12.;
    float cell=floor((a+sector*.5)/sector);
    float local=mod(a+sector*.5,sector)-sector*.5;
    vec3 q=vec3(r-(1.9+.28*sin(uTime*.8)),local*r,p.z);
    q.xz=rot(.65*sin(uTime*.5+cell*.52)+q.x*.6)*q.xz;
    float petal=(length(q/vec3(1.5,.18,.48))-1.)*.16;
    float rim=length(vec2(r-1.,p.z))-.085;
    return vec2(min(petal,rim)*.65,cell/12.+q.x*.08+uTime*.015);
  }

  vec3 environment(vec3 d){
    float a=atan(d.z,d.x), y=d.y;
    vec3 col=mix(vec3(.008,.014,.04),vec3(.04,.085,.13),smoothstep(-.4,.8,y));
    float ribbons=sin(a*3.+y*4.+uTime*.1);
    float band=pow(max(0.,1.-abs(y-.22*sin(a*2.+uTime*.08))*.9),18.);
    col+=palette(a*.15+uTime*.012)*band*.65;
    col+=vec3(.65,.85,1.)*pow(max(0.,dot(d,normalize(vec3(-.6,1.,.4)))),70.)*3.;
    col+=vec3(1.,.5,.18)*pow(max(0.,dot(d,normalize(vec3(.8,.2,-.5)))),90.)*2.;
    col+=vec3(.05,.12,.22)*pow(max(0.,ribbons),16.);
    return col;
  }

  vec3 normalAt(vec3 p){
    vec2 e=vec2(.002,0.);
    return normalize(vec3(field(p+e.xyy).x-field(p-e.xyy).x,field(p+e.yxy).x-field(p-e.yxy).x,field(p+e.yyx).x-field(p-e.yyx).x));
  }
  float occlusion(vec3 p,vec3 n){
    float a=0.,w=1.;
    for(int i=1;i<=4;i++){float h=float(i)*.11;a+=(h-field(p+n*h).x)*w;w*=.55;}
    return clamp(1.-a*1.4,.25,1.);
  }
  float shadow(vec3 p,vec3 l){
    float t=.03,s=1.;
    for(int i=0;i<18;i++){float h=field(p+l*t).x;s=min(s,10.*h/t);t+=clamp(h,.04,.5);if(t>6.)break;}
    return clamp(s,.15,1.);
  }
  vec3 reflected(vec3 p,vec3 d){
    float t=.025;
    for(int i=0;i<48;i++){
      vec2 h=field(p+d*t);
      if(h.x<.003){vec3 n=normalAt(p+d*t);return mix(palette(h.y),environment(reflect(d,n)),.65)*(.3+.7*max(n.y,0.));}
      t+=max(h.x,.005);if(t>12.)break;
    }
    return environment(d);
  }
  void main(){
    vec2 uv=(gl_FragCoord.xy-.5*uResolution)/uResolution.y;
    vec3 ro=vec3(0.,.4,11.8-1.1*sin(uProgress*PI)), target=vec3(0.);
    if(uMode>.5 && uMode<1.5){ro=vec3(sin(uTime*.31)*.45,cos(uTime*.27)*.4,uTime*2.5);target=ro+vec3(sin(uTime*.2)*.3,0.,5.);}
    else {ro.x=sin(uTime*.15)*1.8;ro.y=.6+sin(uTime*.19)*.6;}
    vec3 forward=normalize(target-ro), right=normalize(cross(forward,vec3(0,1,0))), up=cross(right,forward);
    vec3 rd=normalize(forward*1.65+uv.x*right+uv.y*up);
    vec3 col=environment(rd)*.3;
    float t=.1,glow=0.;vec2 hit=vec2(0.);bool found=false;
    for(int i=0;i<144;i++){
      hit=field(ro+rd*t);
      glow+=exp(-abs(hit.x)*28.)*.006;
      if(hit.x<max(.001,t*.00016)){found=true;break;}
      t+=max(hit.x,.001);if(t>36.)break;
    }
    if(found){
      vec3 p=ro+rd*t,n=normalAt(p),l=normalize(vec3(-.6,1.,.8));
      vec3 albedo=palette(hit.y+uTime*.009);
      float ao=occlusion(p,n), diff=max(dot(n,l),0.), fresnel=pow(1.-max(dot(-rd,n),0.),5.);
      vec3 reflection=reflected(p+n*.016,reflect(rd,n));
      col=albedo*(.10+diff*.45*shadow(p+n*.02,l))*ao;
      col+=reflection*mix(albedo*.75+vec3(.12),vec3(.94),fresnel)*ao;
      float spec=pow(max(dot(n,normalize(l-rd)),0.),90.);
      col+=vec3(.75,.87,1.)*spec*1.3;
      // A restrained copper-colored travelling light, synchronized to the score.
      float pulse=pow(.5+.5*sin(p.z*5.+uBeat*1.57),24.);
      col+=albedo*pulse*(.08+uEnergy.y*.15);
      col=mix(col,environment(rd)*.22,1.-exp(-t*t*.0006));
    }
    col+=palette(uTime*.018+uv.y*.2)*min(glow,.35)*(.12+uEnergy.x*.12);
    col*=1.-.28*smoothstep(.25,1.3,length(uv));
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
