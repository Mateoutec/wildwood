export class Sound {
  constructor(volume=.35){this.volume=volume;this.ctx=null;}
  start(){try{this.ctx??=new AudioContext();if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}}
  tone(freq,duration=.1,type='sine',gain=.06,slide=1){
    if(!this.ctx||!this.volume)return;
    const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+duration);g.gain.setValueAtTime(gain*this.volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+duration);
  }
  noise(duration=.1,gain=.08,pitch=700){
    if(!this.ctx||!this.volume)return;const t=this.ctx.currentTime,len=Math.floor(this.ctx.sampleRate*duration),buffer=this.ctx.createBuffer(1,len,this.ctx.sampleRate),a=buffer.getChannelData(0);for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);
    const s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=buffer;f.type='lowpass';f.frequency.value=pitch;g.gain.value=gain*this.volume;s.connect(f).connect(g).connect(this.ctx.destination);s.start(t);
  }
  play(name){
    if(name==='break'){this.noise(.15,.25,1700);this.tone(110,.12,'triangle',.1,.45);}
    if(name==='place'){this.noise(.065,.16,850);this.tone(170,.07,'sine',.08,.7);}
    if(name==='step')this.noise(.055,.1,500);
    if(name==='hit'){this.noise(.15,.22,400);this.tone(170,.2,'sawtooth',.04,.4);}
    if(name==='craft'){this.tone(440,.14,'sine',.09);setTimeout(()=>this.tone(660,.24,'sine',.07),100);}
    if(name==='eat'){this.noise(.1,.14,1000);this.tone(360,.16,'sine',.05,1.3);}
    if(name==='select')this.tone(520,.04,'sine',.045,.8);
  }
}
