(() => {
  'use strict';
  const chords = [[48,52,55],[45,48,52],[53,57,60],[43,47,50]];
  const melodies = [[72,null,76,79,null,76,74,null],[69,null,72,76,null,72,71,null],[69,null,72,77,null,76,72,null],[67,null,71,74,null,71,69,null]];
  const frequency = midi => 440 * 2 ** ((midi-69)/12);
  class IslandAudio {
    constructor({onChange,onError} = {}) {
      this.onChange=onChange; this.onError=onError; this.enabled=false; this.volume=.35; this.context=null;
      this.timer=null; this.suspendTimer=null; this.nodes=new Set(); this.birdTimes=new Map();
      this.step=0; this.nextStepTime=0; this.nextBirdSound=0;
      this.notesScheduled=0; this.chirpsPlayed=0; this.lastChirp=null;
      document.addEventListener('visibilitychange',()=>this.visibility());
      window.addEventListener('pagehide',()=>{this.stopTimer();this.context?.suspend().catch(()=>{});});
      window.addEventListener('pageshow',()=>{if(this.enabled)this.visibility();});
    }
    createContext() {
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)throw Error('此瀏覽器未提供網頁音訊功能。');
      const context=this.context=new AudioContext();
      this.master=context.createGain();this.master.gain.value=0;this.master.connect(context.destination);
      this.music=context.createGain();this.music.gain.value=.55;this.music.connect(this.master);
      this.birds=context.createGain();this.birds.gain.value=.45;this.birds.connect(this.master);
    }
    async setEnabled(enabled) {
      clearTimeout(this.suspendTimer);this.enabled=enabled;
      if(!enabled){
        this.stopTimer();this.birdTimes.clear();
        if(this.context){
          const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(0,t,.025);
          for(const node of this.nodes){try{node.stop(t+.09);}catch{}}
          this.suspendTimer=setTimeout(()=>{if(!this.enabled)this.context.suspend().catch(()=>{});},120);
        }
        this.onChange?.(false);return;
      }
      try{
        if(!this.context)this.createContext();
        await this.context.resume();
        if(!this.enabled)return;
        const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(this.volume*.75,t,.2);
        this.nextStepTime=t+.12;this.startTimer();this.onChange?.(true);
      }catch(error){this.enabled=false;this.stopTimer();this.onChange?.(false);this.onError?.(error.message);}
    }
    setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.context&&this.enabled)this.master.gain.setTargetAtTime(this.volume*.75,this.context.currentTime,.08);}
    stopTimer(){clearInterval(this.timer);this.timer=null;}
    startTimer(){this.stopTimer();this.schedule();this.timer=setInterval(()=>this.schedule(),120);}
    async visibility(){
      if(!this.context)return;
      if(document.hidden||!this.enabled){this.stopTimer();await this.context.suspend().catch(()=>{});return;}
      try{await this.context.resume();if(this.enabled&&!document.hidden){this.nextStepTime=this.context.currentTime+.12;this.startTimer();}}
      catch{this.enabled=false;this.stopTimer();this.onChange?.(false);}
    }
    tone(midi,start,duration,level,pad=false){
      const c=this.context,osc=c.createOscillator(),gain=c.createGain();
      osc.type='sine';osc.frequency.value=frequency(midi);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+(pad ? .8 : .025));
      gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      osc.connect(gain);gain.connect(this.music);this.track(osc,gain);osc.start(start);osc.stop(start+duration+.03);this.notesScheduled++;
    }
    track(osc,...connections){this.nodes.add(osc);osc.onended=()=>{this.nodes.delete(osc);osc.disconnect();connections.forEach(node=>node.disconnect());};}
    schedule(){
      if(!this.enabled||document.hidden||this.context.state!=='running')return;
      const now=this.context.currentTime;if(this.nextStepTime<now)this.nextStepTime=now+.08;
      while(this.nextStepTime<now+.35){
        const chord=Math.floor(this.step/8)%chords.length,beat=this.step%8,t=this.nextStepTime;
        if(!beat)chords[chord].forEach(note=>this.tone(note,t,6,.035,true));
        const note=melodies[chord][beat];if(note!==null){this.tone(note,t,1.6,.13);this.tone(note+12,t,1.1,.012);}
        this.step++;this.nextStepTime+=.8;
      }
    }
    updateBirds(birds,time,animate=true){
      if(!this.enabled||!animate||document.hidden||this.context?.state!=='running')return;
      for(const id of this.birdTimes.keys())if(!birds.some(bird=>bird.id===id))this.birdTimes.delete(id);
      for(const bird of birds){
        if(bird.state!=='perched'||time<bird.visibleAt)continue;
        if(!this.birdTimes.has(bird.id)){this.birdTimes.set(bird.id,time+1.5+Math.random()*3.5);continue;}
        if(time<this.birdTimes.get(bird.id)||this.context.currentTime<this.nextBirdSound)continue;
        this.chirp(bird);this.birdTimes.set(bird.id,time+6+Math.random()*10);this.nextBirdSound=this.context.currentTime+.9;
      }
    }
    chirp(bird){
      const c=this.context,base=1850+(bird.id%3)*240+Math.random()*250,count=2+Math.floor(Math.random()*2);
      const panner=c.createStereoPanner?.();if(panner){panner.pan.value=Math.max(-.65,Math.min(.65,(bird.x/1143-.5)*1.1));panner.connect(this.birds);}
      for(let i=0;i<count;i++){
        const t=c.currentTime+.03+i*.23,osc=c.createOscillator(),gain=c.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(base,t);osc.frequency.exponentialRampToValueAtTime(base*(1.35+Math.random()*.2),t+.045);osc.frequency.exponentialRampToValueAtTime(base*.9,t+.17);
        gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.09,t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+.19);
        osc.connect(gain);gain.connect(panner||this.birds);this.track(osc,gain);osc.start(t);osc.stop(t+.21);
        if(panner&&i===count-1)osc.addEventListener('ended',()=>panner.disconnect(),{once:true});
      }
      this.chirpsPlayed++;this.lastChirp={birdId:bird.id,state:bird.state,mode:bird.mode};
    }
    snapshot(){return{enabled:this.enabled,volume:this.volume,contextState:this.context?.state||'uninitialized',musicNotesScheduled:this.notesScheduled,chirpsPlayed:this.chirpsPlayed,lastChirp:this.lastChirp,activeVoices:this.nodes.size};}
  }
  window.IslandAudio=IslandAudio;
})();
