import {B,I,ITEMS,RECIPES} from './blocks.js';
export class Inventory {
  constructor(slots) {
    this.slots=Array.from({length:36},(_,i)=> {
      const s=slots?.[i];
      return s&&ITEMS[s.id]&&Number.isInteger(s.count)&&s.count>0 ? {id:s.id,count:Math.min(s.count,ITEMS[s.id].stack||64)} : null;
    });
    this.selected=0;
    this.revision=0;
  }
  starter() {
    this.slots.fill(null);
    [[I.WOOD_PICK,1],[B.DIRT,24],[B.PLANKS,20],[B.LOG,8],[B.LANTERN,4],[I.BERRIES,6],[B.GLASS,12],[I.STICK,4],[B.BENCH,1]].forEach((s,i)=>this.slots[i]={id:s[0],count:s[1]});
    this.revision++;
  }
  get held(){return this.slots[this.selected];}
  count(id){return this.slots.reduce((a,s)=>a+(s?.id===id?s.count:0),0);}
  capacity(id){const max=ITEMS[id]?.stack||64;return this.slots.reduce((a,s)=>a+(!s?max:s.id===id?max-s.count:0),0);}
  add(id,count=1) {
    if(!ITEMS[id]||!Number.isInteger(count)||count<1||this.capacity(id)<count) return false;
    const max=ITEMS[id].stack||64;
    for(const s of this.slots) if(s?.id===id&&s.count<max){const n=Math.min(count,max-s.count);s.count+=n;count-=n;if(!count)break;}
    while(count>0){const i=this.slots.indexOf(null);const n=Math.min(max,count);this.slots[i]={id,count:n};count-=n;}
    this.revision++;return true;
  }
  remove(id,count=1) {
    if(!Number.isInteger(count)||count<1||this.count(id)<count)return false;
    for(let i=0;i<this.slots.length&&count;i++){const s=this.slots[i];if(s?.id!==id)continue;const n=Math.min(count,s.count);s.count-=n;count-=n;if(s.count===0)this.slots[i]=null;}
    this.revision++;return true;
  }
  consumeSelected(){const s=this.held;if(!s)return false;if(--s.count===0)this.slots[this.selected]=null;this.revision++;return true;}
  move(from,to) {
    if(from===to||from<0||to<0||from>=36||to>=36)return;
    const a=this.slots[from],b=this.slots[to];
    if(a&&b&&a.id===b.id){const n=Math.min(a.count,(ITEMS[a.id].stack||64)-b.count);b.count+=n;a.count-=n;if(!a.count)this.slots[from]=null;}
    else [this.slots[from],this.slots[to]]=[b,a];
    this.revision++;
  }
  canCraft(recipe,nearBench=false){return (!recipe.bench||nearBench)&&recipe.needs.every(([id,n])=>this.count(id)>=n);}
  craft(recipeId,nearBench=false) {
    const recipe=RECIPES.find(r=>r.id===recipeId);
    if(!recipe||!this.canCraft(recipe,nearBench))return {ok:false,reason:recipe?.bench&&!nearBench?'Place a workbench nearby.':'Missing ingredients.'};
    const draft=new Inventory(this.slots);
    for(const [id,n] of recipe.needs)draft.remove(id,n);
    if(!draft.add(...recipe.out))return {ok:false,reason:'Make room in your backpack first.'};
    this.slots=draft.slots;this.revision++;
    return {ok:true,recipe};
  }
  serialize(){return this.slots.map(s=>s?{...s}:null);}
}
