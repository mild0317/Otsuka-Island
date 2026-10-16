(() => {
  'use strict';
  const chords = [[48,52,55],[45,48,52],[53,57,60],[43,47,50]];
  const melodies = [[72,null,76,79,null,76,74,null],[69,null,72,76,null,72,71,null],[69,null,72,77,null,76,72,null],[67,null,71,74,null,71,69,null]];
  const frequency = midi => 440 * 2 ** ((midi-69)/12);
  class IslandAudio {
    constructor({onChange,onError} = {}) {
      this.onChange=onChange; this.onError=onError; this.enabled=true; this.volume=.35; this.context=null;this.playbackRequest=0;
      this.timer=null; this.suspendTimer=null; this.nodes=new Set(); this.birdTimes=new Map();
      this.step=0; this.nextStepTime=0; this.nextBirdSound=0;
      this.notesScheduled=0; this.chirpsPlayed=0; this.lastChirp=null;
      this.roomKey=null;this.roomNodes=new Set();this.nextRoomSound=Infinity;this.roomEffectsPlayed=0;this.lastRoomEffect=null;this.roomEventCounts={};
      this.catNodes=new Set();this.catVoicesPlayed=0;this.lastCatVoice=null;
      // Autoplay may wait for a trusted gesture. An explicit mute always wins.
      const unlock=event=>{if(event.isTrusted&&this.enabled&&this.context?.state!=='running'&&!event.target.closest?.('#sound-toggle,.room-sound'))this.tryStart();};
      for(const type of ['pointerdown','touchend','keydown'])document.addEventListener(type,unlock,{capture:true,passive:true});
      document.addEventListener('visibilitychange',()=>this.visibility());
      window.addEventListener('pagehide',()=>{this.playbackRequest++;this.stopCatVoice();this.stopRoomEffects();this.stopTimer();this.context?.suspend().catch(()=>{});});
      window.addEventListener('pageshow',()=>{if(this.enabled)this.visibility();});
    }
    createContext() {
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)throw Error('此瀏覽器未提供網頁音訊功能。');
      const context=this.context=new AudioContext();
      this.master=context.createGain();this.master.gain.value=0;this.master.connect(context.destination);
      this.music=context.createGain();this.music.gain.value=.55;this.music.connect(this.master);
      this.birds=context.createGain();this.birds.gain.value=.45;this.birds.connect(this.master);
      this.effects=context.createGain();this.effects.gain.value=.38;this.effects.connect(this.master);
      this.cats=context.createGain();this.cats.gain.value=.32;this.cats.connect(this.master);
      this.noise=context.createBuffer(1,Math.ceil(context.sampleRate*.4),context.sampleRate);
      const samples=this.noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    }
    async setEnabled(enabled) {
      clearTimeout(this.suspendTimer);this.enabled=enabled;this.onChange?.(enabled);
      if(!enabled){
        this.playbackRequest++;
        this.stopTimer();this.birdTimes.clear();this.stopRoomEffects();
        this.stopCatVoice();
        if(this.context){
          const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(0,t,.025);
          for(const node of this.nodes){try{node.stop(t+.09);}catch{}}
          this.suspendTimer=setTimeout(()=>{if(!this.enabled)this.context.suspend().catch(()=>{});},120);
        }
        return;
      }
      return this.tryStart();
    }
    async tryStart(){
      if(!this.enabled||document.hidden)return;
      const request=++this.playbackRequest;
      try{
        if(!this.context)this.createContext();
        await this.context.resume();
        if(!this.enabled||document.hidden){this.context.suspend().catch(()=>{});return;}
        if(request!==this.playbackRequest||this.context.state!=='running')return;
        const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(this.volume*.75,t,.2);
        this.nextStepTime=t+.12;this.nextRoomSound=t+2+Math.random()*3;this.startTimer();
        if(this.roomKey)this.roomEvent('enter',this.roomKey);
      }catch(error){
        if(request!==this.playbackRequest||!this.enabled||error.name==='NotAllowedError')return;
        this.enabled=false;this.stopTimer();this.onChange?.(false);this.onError?.(error.message);
      }
    }
    setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.context&&this.enabled)this.master.gain.setTargetAtTime(this.volume*.75,this.context.currentTime,.08);}
    stopTimer(){clearInterval(this.timer);this.timer=null;}
    startTimer(){this.stopTimer();this.schedule();this.timer=setInterval(()=>this.schedule(),120);}
    async visibility(){
      if(!this.context){if(this.enabled&&!document.hidden)await this.tryStart();return;}
      if(document.hidden||!this.enabled){this.playbackRequest++;this.stopCatVoice();this.stopRoomEffects();this.stopTimer();await this.context.suspend().catch(()=>{});return;}
      await this.tryStart();
    }
    tone(midi,start,duration,level,pad=false){
      const c=this.context,osc=c.createOscillator(),gain=c.createGain();
      osc.type='sine';osc.frequency.value=frequency(midi);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+(pad ? .8 : .025));
      gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      osc.connect(gain);gain.connect(this.music);this.track(osc,gain);osc.start(start);osc.stop(start+duration+.03);this.notesScheduled++;
    }
    track(osc,...connections){this.nodes.add(osc);osc.onended=()=>{this.nodes.delete(osc);osc.disconnect();connections.forEach(node=>node.disconnect());};}
    stopRoomEffects(){for(const source of this.roomNodes){try{source.stop();}catch{}}this.roomNodes.clear();}
    enterRoom(key){this.stopCatVoice();this.stopRoomEffects();this.roomKey=key;this.nextRoomSound=(this.context?.currentTime||0)+2+Math.random()*3;this.roomEvent('enter',key);}
    leaveRoom(){this.stopCatVoice();this.stopRoomEffects();this.roomKey=null;this.nextRoomSound=Infinity;}
    stopCatVoice(){for(const source of this.catNodes){try{source.stop();}catch{}}this.catNodes.clear();}
    catVoice(voice){
      if(!this.enabled||document.hidden||this.context?.state!=='running'||voice.location!==(this.roomKey||'island'))return;
      const c=this.context,t=c.currentTime+.015,purr=voice.kind==='purr',osc=c.createOscillator(),filter=c.createBiquadFilter(),gain=c.createGain(),duration=purr?.8:.65;
      osc.type=purr?'triangle':'sawtooth';const base=purr?30:470+Math.random()*80;
      osc.frequency.setValueAtTime(base,t);osc.frequency.exponentialRampToValueAtTime(purr?34:base*1.45,t+(purr?.3:.16));osc.frequency.exponentialRampToValueAtTime(purr?27:base*.65,t+duration);
      filter.type=purr?'lowpass':'bandpass';filter.Q.value=purr?.7:2.2;filter.frequency.setValueAtTime(purr?180:1150,t);filter.frequency.linearRampToValueAtTime(purr?130:680,t+duration);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(purr?.07:.13,t+.08);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      osc.connect(filter);filter.connect(gain);gain.connect(this.cats);this.track(osc,filter,gain);this.catNodes.add(osc);osc.addEventListener('ended',()=>this.catNodes.delete(osc),{once:true});osc.start(t);osc.stop(t+duration+.02);
      this.catVoicesPlayed++;this.lastCatVoice={kind:voice.kind,location:voice.location};
    }
    trackEffect(source,...connections){this.track(source,...connections);this.roomNodes.add(source);source.addEventListener('ended',()=>this.roomNodes.delete(source),{once:true});}
    effectTone(midi,delay=0,duration=.12,level=.12,slide=0){
      const c=this.context,t=c.currentTime+.015+delay,osc=c.createOscillator(),gain=c.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(frequency(midi),t);
      if(slide)osc.frequency.exponentialRampToValueAtTime(frequency(midi+slide),t+duration);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      osc.connect(gain);gain.connect(this.effects);this.trackEffect(osc,gain);osc.start(t);osc.stop(t+duration+.02);
    }
    effectNoise(delay=0,duration=.035,level=.09,cutoff=1800){
      const c=this.context,t=c.currentTime+.015+delay,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
      source.buffer=this.noise;filter.type='bandpass';filter.frequency.value=cutoff;filter.Q.value=.7;
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+.005);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      source.connect(filter);filter.connect(gain);gain.connect(this.effects);this.trackEffect(source,filter,gain);source.start(t);source.stop(t+duration+.01);
    }
    roomEvent(type,key=this.roomKey,index=0){
      if(key!==this.roomKey||!key)return;
      if(type==='cancel'){this.stopRoomEffects();return;}
      if(!this.enabled||document.hidden||this.context?.state!=='running')return;
      const roots={clock:72,workshop:64,library:79,lab:55},root=roots[key];if(root===undefined)return;
      this.roomEffectsPlayed++;this.lastRoomEffect={key,type,index};
      const eventKey=key+':'+type;this.roomEventCounts[eventKey]=(this.roomEventCounts[eventKey]||0)+1;
      if(type==='complete'){
        const notes=key==='library'?[79,83,86]:key==='lab'?[67,74,79]:key==='workshop'?[64,71,76]:[72,76,79];
        notes.forEach((note,i)=>this.effectTone(note,i*.13,.45,.12));return;
      }
      if(type==='enter'){this.effectTone(root,0,.25,.09);this.effectTone(root+7,.14,.35,.07);return;}
      if(type==='select'||type==='back'){this.effectTone(root+(type==='back'?-5:index*2),0,.1,.09);return;}
      if(key==='clock'){
        [0,.085,.19,.3].slice(0,type==='ambient'?4:2).forEach((t,i)=>this.effectNoise(t,.025,.16,1400+i*300));
        if(type==='run')this.effectTone(76,.34,.12,.07);
      }else if(key==='workshop'){
        this.effectNoise(0,.025,.15,1100);this.effectNoise(.07,.25,.08,4300);if(type!=='ambient')this.effectTone(76,.12,.09,.08);
      }else if(key==='library'){
        this.effectTone(83,0,.09,.1);this.effectTone(83,.19,.09,.07);
      }else{
        this.effectTone(55,0,.32,.1,12);this.effectTone(74,.12,.14,.07);this.effectTone(79,.3,.16,.05);
      }
    }
    schedule(){
      if(!this.enabled||document.hidden||this.context.state!=='running')return;
      const now=this.context.currentTime;if(this.nextStepTime<now)this.nextStepTime=now+.08;
      while(this.nextStepTime<now+.35){
        const chord=Math.floor(this.step/8)%chords.length,beat=this.step%8,t=this.nextStepTime;
        if(!beat)chords[chord].forEach(note=>this.tone(note,t,6,.035,true));
        const note=melodies[chord][beat];if(note!==null){this.tone(note,t,1.6,.13);this.tone(note+12,t,1.1,.012);}
        this.step++;this.nextStepTime+=.8;
      }
      if(this.roomKey&&now>=this.nextRoomSound){this.roomEvent('ambient');this.nextRoomSound=now+4+Math.random()*5;}
    }
    updateBirds(birds,time,animate=true){
      if(!this.enabled||this.roomKey||!animate||document.hidden||this.context?.state!=='running')return;
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
    snapshot(){return{enabled:this.enabled,volume:this.volume,contextState:this.context?.state||'uninitialized',musicNotesScheduled:this.notesScheduled,chirpsPlayed:this.chirpsPlayed,lastChirp:this.lastChirp,activeVoices:this.nodes.size,roomKey:this.roomKey,roomEffectsPlayed:this.roomEffectsPlayed,lastRoomEffect:this.lastRoomEffect,roomEventCounts:{...this.roomEventCounts},activeRoomVoices:this.roomNodes.size,catVoicesPlayed:this.catVoicesPlayed,lastCatVoice:this.lastCatVoice,activeCatVoices:this.catNodes.size};}
  }
  window.IslandAudio=IslandAudio;
})();
