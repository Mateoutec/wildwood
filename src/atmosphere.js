import * as THREE from 'three';
import {SIZE} from './terrain.js';
import {hash} from './noise.js';
export class Atmosphere {
  constructor(scene,renderer) {
    this.scene=scene;this.renderer=renderer;
    this.hemi=new THREE.HemisphereLight(0xe9f1da,0x62654a,1.5);scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffe6b1,2);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-36,right:36,top:36,bottom:-36,near:1,far:190});this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00008;scene.add(this.sun,this.sun.target);
    this.skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#80b8c5')},bottom:{value:new THREE.Color('#e7e6c8')},sunDir:{value:new THREE.Vector3(1,1,1).normalize()},day:{value:1}},vertexShader:'varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vDir; uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float day; void main(){vec3 d=normalize(vDir);float t=pow(max(d.y,0.0),0.65);vec3 col=mix(bottom,top,t);float glow=pow(max(dot(d,sunDir),0.0),38.0)*day;col+=vec3(0.35,0.23,0.08)*glow;gl_FragColor=vec4(col,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(380,24,16),this.skyMaterial);this.sky.frustumCulled=false;this.sky.renderOrder=-20;scene.add(this.sky);
    this.sunDisc=new THREE.Mesh(new THREE.BoxGeometry(9,9,1),new THREE.MeshBasicMaterial({color:0xffebba,fog:false}));
    this.moonDisc=new THREE.Mesh(new THREE.BoxGeometry(6,6,1),new THREE.MeshBasicMaterial({color:0xd1e5df,fog:false}));scene.add(this.sunDisc,this.moonDisc);
    const stars=[];for(let i=0;i<450;i++){const a=hash(i,1,0)*Math.PI*2,y=hash(i,2,0)*.97+.02,r=Math.sqrt(1-y*y);stars.push(Math.cos(a)*r*290,y*290,Math.sin(a)*r*290);}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));this.stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xf2f1dc,size:.8,transparent:true,opacity:0,depthWrite:false,fog:false}));scene.add(this.stars);
    this.clouds=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xfff4d6,transparent:true,opacity:.9}),72);this.clouds.frustumCulled=false;scene.add(this.clouds);this.dummy=new THREE.Object3D();
    this.fog=new THREE.Fog(0xd4dfca,30,68);scene.fog=this.fog;
    this.lights=Array.from({length:8},()=>{const l=new THREE.PointLight(0xffbd67,0,12,1.5);scene.add(l);return l;});
    this.daylight=1;this.night=false;
  }
  update(time,position,radius,underwater=false) {
    const phase=(time%720)/720,angle=(phase-.25)*Math.PI*2,elevation=Math.sin(angle),day=THREE.MathUtils.smoothstep(elevation,-.2,.35),sunset=(1-Math.min(1,Math.abs(elevation)*3))*day;
    this.daylight=day;this.night=elevation<-.12;
    const dir=new THREE.Vector3(Math.cos(angle)*.8,elevation,Math.cos(angle)*.45).normalize();
    this.sky.position.copy(position);this.stars.position.copy(position);this.skyMaterial.uniforms.day.value=day;this.skyMaterial.uniforms.sunDir.value.copy(dir);
    const top=new THREE.Color('#101d35').lerp(new THREE.Color('#83b6c1'),day),bottom=new THREE.Color('#25374c').lerp(new THREE.Color('#dce2c8'),day).lerp(new THREE.Color('#e7bb94'),sunset*.6);
    this.skyMaterial.uniforms.top.value.copy(top);this.skyMaterial.uniforms.bottom.value.copy(bottom);
    this.fog.color.copy(underwater?new THREE.Color('#467e85'):bottom);this.fog.near=underwater?1:radius*SIZE*.42;this.fog.far=underwater?16:radius*SIZE*.95;
    this.hemi.intensity=.4+day*1.15;this.hemi.color.set('#bbd3e6').lerp(new THREE.Color('#f0f0ce'),day);this.hemi.groundColor.set('#434657').lerp(new THREE.Color('#797451'),day);
    const lightDir=elevation>0?dir:dir.clone().negate();this.sun.position.copy(position).addScaledVector(lightDir,85);this.sun.target.position.copy(position);this.sun.intensity=.23+day*1.9;this.sun.color.set('#9ebce2').lerp(new THREE.Color('#ffe9bf'),day).lerp(new THREE.Color('#ffcf99'),sunset*.6);
    this.sunDisc.position.copy(position).addScaledVector(dir,240);this.sunDisc.lookAt(position);this.moonDisc.position.copy(position).addScaledVector(dir,-240);this.moonDisc.lookAt(position);this.stars.material.opacity=1-day;
    for(let i=0;i<72;i++) {
      const group=Math.floor(i/3),part=i%3,px=hash(group,1,73)*260+time*.3,pz=hash(group,2,73)*260;
      const x=((px-position.x+390)%260+260)%260-130+position.x,z=((pz-position.z+390)%260+260)%260-130+position.z;
      this.dummy.position.set(x+part*5,51+hash(group,3,73)*8+part*.7,z+part*1.5);this.dummy.scale.set(7+hash(i,4,73)*10,1.3+hash(i,5,73)*1.6,4+hash(i,6,73)*7);this.dummy.updateMatrix();this.clouds.setMatrixAt(i,this.dummy.matrix);
    }this.clouds.instanceMatrix.needsUpdate=true;
  }
  updateLanterns(world,position) {
    const near=[];
    for(const [key,edits] of world.edits){const [cx,cz]=key.split(',').map(Number);if(Math.hypot(cx*16-position.x,cz*16-position.z)>35)continue;for(const [i,id] of edits)if(id===15){const x=cx*16+i%16+.5,y=Math.floor(i/256)+.5,z=cz*16+Math.floor(i/16)%16+.5,d=Math.hypot(x-position.x,y-position.y,z-position.z);if(d<24)near.push({x,y,z,d});}}
    near.sort((a,b)=>a.d-b.d);this.lights.forEach((l,i)=>{const p=near[i];l.intensity=p?8:0;if(p)l.position.set(p.x,p.y+.2,p.z);});
  }
}
export class Particles {
  constructor(scene){this.mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshLambertMaterial(),160);this.mesh.frustumCulled=false;this.mesh.count=0;scene.add(this.mesh);this.particles=[];this.dummy=new THREE.Object3D();}
  burst(x,y,z,color,count=12){for(let i=0;i<count;i++){if(this.particles.length>=160)this.particles.shift();this.particles.push({x:x+.2+Math.random()*.6,y:y+.2+Math.random()*.6,z:z+.2+Math.random()*.6,vx:(Math.random()-.5)*3,vy:Math.random()*3+1,vz:(Math.random()-.5)*3,life:.5+Math.random()*.4,color:new THREE.Color(color)});}}
  update(dt){this.particles=this.particles.filter(p=>(p.life-=dt)>0);this.mesh.count=this.particles.length;this.particles.forEach((p,i)=>{p.vy-=12*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.life*3,p.life*2,0);this.dummy.scale.setScalar(Math.min(1,p.life*3));this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.mesh.setColorAt(i,p.color);});this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;}
}
