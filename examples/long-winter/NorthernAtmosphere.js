import * as Three from 'three'

export const NOISE = /* glsl */`
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p+7.1;a*=0.5;}
    return v;
  }
`

/** Procedural sky and folded, vertically striated auroral curtains. */
export function atmosphere() {
  const uniforms = { uTime: { value: 0 }, uDawn: { value: 0 }, uEnergy: { value: 0 } }
  const sky = new Three.Mesh(new Three.SphereGeometry(160, 48, 24), new Three.ShaderMaterial({
    side: Three.BackSide, depthWrite: false, uniforms,
    vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: /* glsl */`
      uniform float uTime, uDawn; varying vec3 vDirection;
      ${NOISE}
      void main(){
        vec3 d=normalize(vDirection);
        vec2 p=vec2(atan(d.z,d.x),asin(d.y));
        float horizon=exp(-abs(d.y)*6.0);
        vec3 night=mix(vec3(.006,.012,.037),vec3(.035,.105,.17),horizon);
        vec3 dawn=mix(vec3(.045,.055,.14),vec3(.8,.24,.12),horizon);
        vec3 col=mix(night,dawn,uDawn);
        float cloud=fbm(p*vec2(9.0,16.0)+vec2(uTime*.007,0.0));
        col+=smoothstep(.45,.82,cloud)*vec3(.06,.095,.16)*horizon;
        vec2 stars=p*vec2(320.,240.); vec2 cell=floor(stars);
        vec2 offset=vec2(hash21(cell),hash21(cell+13.));
        float star=exp(-length(fract(stars)-offset)*32.0)*step(.976,hash21(cell+31.));
        col+=star*(.6+.4*sin(uTime*.4+hash21(cell)*20.))*(1.-uDawn)*smoothstep(-.03,.2,d.y);
        float moon=length(d-normalize(vec3(.36,.32,-1.)));
        col+=vec3(.58,.73,.86)*(.07*exp(-moon*12.)+.55*(1.-smoothstep(.016,.018,moon)))*(1.-uDawn);
        col+=vec3(1.,.45,.15)*exp(-length(d-normalize(vec3(-.25,.02,-1.)))*8.)*uDawn*.55;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }))
  const aurora = new Three.Group()
  for (let i = 0; i < 5; i++) {
    const material = new Three.ShaderMaterial({
      uniforms: { ...uniforms, uLayer: { value: i } },
      transparent: true, depthWrite: false, side: Three.DoubleSide, blending: Three.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uTime,uLayer; varying vec2 vUv;
        void main(){
          vUv=uv; float x=(uv.x-.5)*100.;
          float fold=sin(x*.095+uTime*.16+uLayer*.6)*4.+sin(x*.27-uTime*.22)*1.3;
          vec3 p=vec3(x,6.+uv.y*19.+sin(x*.085+uLayer)*3.,-48.+uLayer*4.+fold);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime,uLayer,uEnergy,uDawn; varying vec2 vUv;
        ${NOISE}
        void main(){
          float x=vUv.x;
          float flow=fbm(vec2(x*15.+uLayer,uTime*.065));
          float filaments=pow(.5+.5*sin(x*1350.+flow*40.+uTime*.6),3.);
          float fold=.25+.75*pow(.5+.5*sin(x*42.+flow*9.-uTime*.2),2.);
          float edge=.06+.065*sin(x*24.+flow*4.+uTime*.22);
          float height=max(0.,vUv.y-edge);
          float curtain=smoothstep(edge-.025,edge+.03,vUv.y)*exp(-height*5.5);
          float alpha=curtain*fold*(.32+.68*filaments)*smoothstep(0.,.12,x)*smoothstep(0.,.12,1.-x);
          vec3 col=mix(vec3(.055,.72,.39),vec3(.32,.065,.65),smoothstep(.06,.6,height));
          col+=vec3(.12,.28,.2)*exp(-height*30.);
          gl_FragColor=vec4(col,alpha*(.65+uEnergy*.5)*(1.-uDawn*.8));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    const curtain = new Three.Mesh(new Three.PlaneGeometry(1, 1, 240, 24), material)
    curtain.frustumCulled = false
    aurora.add(curtain)
  }
  return { sky, aurora, uniforms }
}

export function snowfall(count = 2200) {
  const positions = new Float32Array(count * 3)
  for (let i=0;i<count;i++) {
    positions[i*3]=(hash(i)-.5)*60
    positions[i*3+1]=hash(i+count)*22
    positions[i*3+2]=-hash(i+count*2)*60
  }
  const geometry=new Three.BufferGeometry()
  geometry.setAttribute('position',new Three.BufferAttribute(positions,3))
  const snow=new Three.Points(geometry,new Three.ShaderMaterial({
    uniforms:{uTime:{value:0},uSize:{value:240}},transparent:true,depthWrite:false,
    vertexShader:`uniform float uTime,uSize;varying float vFade;void main(){vec3 p=position;p.y=mod(p.y-uTime*(.35+fract(position.x)*.3),22.)-3.;p.x+=sin(uTime*.25+position.z)*.8;vec4 mv=modelViewMatrix*vec4(p,1.);vFade=clamp(-mv.z/5.,0.,1.);gl_PointSize=clamp(uSize*.09/max(1.,-mv.z),1.,5.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vFade;void main(){float a=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.65,.8,.9,a*.48*vFade);}`,
  }))
  snow.frustumCulled=false
  return snow
}

export function hash(value) {
  const x=Math.sin(value*127.1)*43758.5453
  return x-Math.floor(x)
}
