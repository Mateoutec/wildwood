export function seedNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
  let h=2166136261;
  for (const c of String(value)) h=Math.imul(h ^ c.charCodeAt(0),16777619);
  return h>>>0;
}
export function hash(x,y,z,seed=1) {
  let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041)^seed;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}
const smooth = t=>t*t*(3-2*t);
const lerp=(a,b,t)=>a+(b-a)*t;
export function noise2(x,z,seed) {
  const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);
  return lerp(lerp(hash(ix,0,iz,seed),hash(ix+1,0,iz,seed),u),lerp(hash(ix,0,iz+1,seed),hash(ix+1,0,iz+1,seed),u),v)*2-1;
}
export function noise3(x,y,z,seed) {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);
  return lerp(lerp(lerp(hash(ix,iy,iz,seed),hash(ix+1,iy,iz,seed),u),lerp(hash(ix,iy+1,iz,seed),hash(ix+1,iy+1,iz,seed),u),v),lerp(lerp(hash(ix,iy,iz+1,seed),hash(ix+1,iy,iz+1,seed),u),lerp(hash(ix,iy+1,iz+1,seed),hash(ix+1,iy+1,iz+1,seed),u),v),w)*2-1;
}
export function fbm(x,z,seed,octaves=4) {
  let result=0,a=.57;
  for(let i=0;i<octaves;i++){result+=noise2(x,z,seed+i*1013)*a;x*=2.03;z*=2.03;a*=.5;}
  return result;
}
