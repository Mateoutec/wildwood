import {buildMesh} from './mesher.js';
self.onmessage=({data:{key,revision,pad}})=>{
  const result=buildMesh(pad);
  const transfer=Object.values(result).flatMap(part=>Object.values(part).map(array=>array.buffer));
  self.postMessage({key,revision,...result},transfer);
};
