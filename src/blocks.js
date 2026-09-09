export const B = Object.freeze({ AIR:0, GRASS:1, DIRT:2, STONE:3, SAND:4, LOG:5, LEAVES:6, PLANKS:7, COBBLE:8, COAL:9, IRON:10, CRYSTAL:11, BEDROCK:12, WATER:13, BENCH:14, LANTERN:15, GLASS:16, BRICK:17, WOOL:18, FLOWER:19 });
export const I = Object.freeze({ COAL:101, RAW_IRON:102, STICK:103, BERRIES:104, WOOD_PICK:105, STONE_PICK:106, IRON_PICK:107, SWORD:108, RATION:109, INGOT:110, GEM:111 });
export const BLOCKS = {
  0:{name:'Air',solid:false},
  1:{name:'Meadow grass',color:'#8ea85b',tile:1,top:0,bottom:2,hardness:.55,drop:B.DIRT},
  2:{name:'Earth',color:'#967050',tile:2,hardness:.5},
  3:{name:'Stone',color:'#92958b',tile:3,hardness:2.4,drop:B.COBBLE,requires:'pick',tier:1},
  4:{name:'River sand',color:'#e0ca8e',tile:4,hardness:.5},
  5:{name:'Oak log',color:'#95673f',tile:5,top:6,bottom:6,hardness:1.1},
  6:{name:'Oak leaves',color:'#719347',tile:7,hardness:.25,cutout:true},
  7:{name:'Oak planks',color:'#c99961',tile:8,hardness:.8},
  8:{name:'Cobblestone',color:'#888c81',tile:9,hardness:1.6,requires:'pick',tier:1},
  9:{name:'Coal ore',color:'#62665e',tile:10,hardness:2.6,drop:I.COAL,requires:'pick',tier:1},
  10:{name:'Iron ore',color:'#c69277',tile:11,hardness:3,drop:I.RAW_IRON,requires:'pick',tier:2},
  11:{name:'Moonstone ore',color:'#81d4c4',tile:12,hardness:3.5,drop:I.GEM,requires:'pick',tier:2},
  12:{name:'Bedrock',color:'#3b4143',tile:13,hardness:Infinity},
  13:{name:'Water',color:'#6da9ac',tile:14,solid:false,transparent:true,hardness:Infinity},
  14:{name:'Workbench',color:'#b5814c',tile:15,top:16,bottom:8,hardness:1},
  15:{name:'Amber lantern',color:'#ffcf7b',tile:17,hardness:.4,emission:true},
  16:{name:'Glass',color:'#b7d9ce',tile:18,hardness:.3,cutout:true},
  17:{name:'Stone bricks',color:'#acaca0',tile:19,hardness:1.8,requires:'pick',tier:1},
  18:{name:'Soft wool',color:'#ede2c8',tile:20,hardness:.4},
  19:{name:'Wildflowers',color:'#e9b369',tile:21,hardness:.15,solid:false,plant:true,drop:I.BERRIES},
};
export const ITEMS = {
  ...BLOCKS,
  101:{name:'Coal',color:'#3e4645',icon:'coal'},
  102:{name:'Raw iron',color:'#c99274',icon:'ore'},
  103:{name:'Sticks',color:'#ba8953',icon:'stick'},
  104:{name:'Wild berries',color:'#d77365',icon:'berries',food:5},
  105:{name:'Wooden pickaxe',color:'#c29260',icon:'pick',tool:'pick',tier:1,stack:1},
  106:{name:'Stone pickaxe',color:'#a6aea6',icon:'pick',tool:'pick',tier:2,stack:1},
  107:{name:'Iron pickaxe',color:'#dce2d8',icon:'pick',tool:'pick',tier:3,stack:1},
  108:{name:'Stone sword',color:'#b6bdb2',icon:'sword',damage:6,stack:1},
  109:{name:'Trail ration',color:'#b98556',icon:'food',food:9},
  110:{name:'Iron ingot',color:'#d0d6cc',icon:'ingot'},
  111:{name:'Moonstone',color:'#8fdfcf',icon:'gem'},
};
export const isSolid = id => !!id && BLOCKS[id]?.solid !== false;
export function miningRule(blockId,heldId,creative=false) {
  const block=BLOCKS[blockId],item=ITEMS[heldId];
  if(!block||!Number.isFinite(block.hardness))return {allowed:false,duration:Infinity,requiredTier:0};
  const correctTool=!!item?.tool&&item.tool===block.requires;
  const allowed=creative||!block.requires||(correctTool&&item.tier>=block.tier);
  const speed=correctTool?([1,1.4,2.6,4.3][item.tier]??1):1;
  return {allowed,duration:creative?.13:block.hardness/speed,requiredTier:block.requires?block.tier:0};
}
export const isOpaque = id => isSolid(id) && !BLOCKS[id]?.cutout;
export const tileFor = (id, face) => face === 2 ? BLOCKS[id].top ?? BLOCKS[id].tile : face === 3 ? BLOCKS[id].bottom ?? BLOCKS[id].tile : BLOCKS[id].tile;
export const RECIPES = [
  {id:'planks',name:'Oak planks',out:[B.PLANKS,4],needs:[[B.LOG,1]],hint:'A place to begin.',bench:false},
  {id:'sticks',name:'Sticks',out:[I.STICK,4],needs:[[B.PLANKS,2]],hint:'Handles for useful things.',bench:false},
  {id:'bench',name:'Workbench',out:[B.BENCH,1],needs:[[B.PLANKS,4]],hint:'Place nearby to unlock better recipes.',bench:false},
  {id:'wood-pick',name:'Wooden pickaxe',out:[I.WOOD_PICK,1],needs:[[B.PLANKS,3],[I.STICK,2]],hint:'Mine stone and coal.',bench:false},
  {id:'stone-pick',name:'Stone pickaxe',out:[I.STONE_PICK,1],needs:[[B.COBBLE,3],[I.STICK,2]],hint:'Mine iron and moonstone.',bench:true},
  {id:'sword',name:'Stone sword',out:[I.SWORD,1],needs:[[B.COBBLE,2],[I.STICK,1]],hint:'Keep the night at a distance.',bench:true},
  {id:'lantern',name:'Amber lantern',out:[B.LANTERN,4],needs:[[I.COAL,1],[B.LOG,1]],hint:'A little warmth for your home.',bench:false},
  {id:'glass',name:'Glass',out:[B.GLASS,4],needs:[[B.SAND,4],[I.COAL,1]],hint:'Fire-fused at the workbench.',bench:true},
  {id:'bricks',name:'Stone bricks',out:[B.BRICK,4],needs:[[B.COBBLE,4]],hint:'For a sturdy little shelter.',bench:true},
  {id:'smelt',name:'Iron ingot',out:[I.INGOT,2],needs:[[I.RAW_IRON,2],[I.COAL,1]],hint:'Smelt with the workbench forge.',bench:true},
  {id:'iron-pick',name:'Iron pickaxe',out:[I.IRON_PICK,1],needs:[[I.INGOT,3],[I.STICK,2]],hint:'Quicker mining, deeper adventures.',bench:true},
  {id:'moonlight',name:'Moonstone lanterns',out:[B.LANTERN,12],needs:[[I.GEM,1],[B.GLASS,2]],hint:'Turn a rare find into a warm glow.',bench:true},
];
export const CREATIVE_ITEMS = [B.GRASS,B.DIRT,B.STONE,B.SAND,B.LOG,B.LEAVES,B.PLANKS,B.COBBLE,B.COAL,B.IRON,B.CRYSTAL,B.BENCH,B.LANTERN,B.GLASS,B.BRICK,B.WOOL,B.FLOWER,I.WOOD_PICK,I.STONE_PICK,I.IRON_PICK,I.SWORD,I.BERRIES];
