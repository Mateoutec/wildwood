import * as THREE from 'three';
import {SIZE,HEIGHT,chunkKey} from './terrain.js';
import {PAD,padIndex,buildMesh} from './mesher.js';
export class WorldRenderer {
  constructor(scene,world,textures) {
    this.scene=scene;this.world=world;this.meshes=new Map();this.pending=new Map();this.disposed=false;
    this.material=new THREE.MeshLambertMaterial({map:textures.texture,vertexColors:true,alphaTest:.5,emissiveMap:textures.emissive,emissive:0xffd493,emissiveIntensity:.72});
    this.waterMaterial=new THREE.MeshLambertMaterial({map:textures.texture,color:0xbbe2df,vertexColors:true,transparent:true,opacity:.68,depthWrite:false,side:THREE.DoubleSide});
    this.worker=new Worker(new URL('./mesh.worker.js',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>this.receive(data);
    this.worker.onerror=e=>{console.warn('Mesh worker unavailable; using main-thread meshing.',e.message);this.worker.terminate();this.worker=null;for(const key of this.pending.keys())world.dirty.add(key);this.pending.clear();};
    world.onUnload=key=>this.remove(key);
  }
  remove(key){const group=this.meshes.get(key);if(group){group.children.forEach(m=>m.geometry.dispose());this.scene.remove(group);this.meshes.delete(key);}}
  receive({key,revision,solid,water}) {
    if(this.disposed)return;this.pending.delete(key);
    const c=this.world.chunks.get(key);if(!c)return;
    if(c.revision!==revision){this.world.dirty.add(key);return;}
    this.remove(key);const group=new THREE.Group();group.position.set(c.cx*SIZE,0,c.cz*SIZE);
    for(const [data,material] of [[solid,this.material],[water,this.waterMaterial]]) {
      if(!data.indices.length)continue;
      const geo=new THREE.BufferGeometry();
      for(const [attr,source,size] of [['position','positions',3],['normal','normals',3],['uv','uvs',2],['color','colors',3]])geo.setAttribute(attr,new THREE.BufferAttribute(data[source],size));
      geo.setIndex(new THREE.BufferAttribute(data.indices,1));geo.computeBoundingSphere();
      const mesh=new THREE.Mesh(geo,material);mesh.castShadow=material===this.material;mesh.receiveShadow=true;mesh.frustumCulled=true;group.add(mesh);
    }
    this.meshes.set(key,group);this.scene.add(group);
  }
  update() {
    const world=this.world;
    for(const [key,group] of this.meshes){const c=world.chunks.get(key);group.visible=!!c&&Math.max(Math.abs(c.cx-world.cx),Math.abs(c.cz-world.cz))<=world.radius;}
    if(this.pending.size>=2)return;
    const list=[...world.dirty].map(k=>world.chunks.get(k)).filter(c=>c&&!this.pending.has(c.key)&&Math.max(Math.abs(c.cx-world.cx),Math.abs(c.cz-world.cz))<=world.radius).sort((a,b)=>(a.cx-world.cx)**2+(a.cz-world.cz)**2-((b.cx-world.cx)**2+(b.cz-world.cz)**2));
    let count=0;
    for(const c of list) {
      if(this.pending.size>=2||count>=1)break;
      // Wait for the one-chunk halo so border faces and AO are correct immediately.
      let ready=true;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(!world.chunks.has(chunkKey(c.cx+dx,c.cz+dz)))ready=false;
      if(!ready)continue;
      const pad=new Uint8Array(PAD*PAD*(HEIGHT+2));
      for(let y=-1;y<=HEIGHT;y++)for(let z=-1;z<=SIZE;z++)for(let x=-1;x<=SIZE;x++)pad[padIndex(x,y,z)]=world.getBlock(c.cx*SIZE+x,y,c.cz*SIZE+z,false);
      world.dirty.delete(c.key);this.pending.set(c.key,c.revision);count++;
      if(this.worker)this.worker.postMessage({key:c.key,revision:c.revision,pad},[pad.buffer]);
      else this.receive({key:c.key,revision:c.revision,...buildMesh(pad)});
    }
  }
  dispose(){this.disposed=true;this.worker?.terminate();for(const key of this.meshes.keys())this.remove(key);this.material.dispose();this.waterMaterial.dispose();}
}
