(() => {
  'use strict';
  const W = 1143, H = 2048;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const point = (x, y) => ({ x, y });
  function path(g, vertices) { g.moveTo(...vertices[0]); vertices.slice(1).forEach(p => g.lineTo(...p)); g.closePath(); }
  function surface(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function cubic(a, b, c, d, t) {
    const u = 1 - t;
    return point(u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x, u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y);
  }

  class IslandBirds {
    constructor({ random = Math.random, isWalkable = () => true } = {}) {
      this.random = random; this.isWalkable = isWalkable; this.birds = [];this.active=true; this.serial = 0; this.time = 0;
      this.targetCount = Math.floor(this.random() * 4); this.nextPopulation = this.range(12, 22);
      this.roofs = [point(582, 171), point(618, 233), point(832, 648), point(960, 730), point(179, 865), point(330, 934), point(860, 1117)];
      this.grounds = [point(348, 1225), point(697, 1536), point(783, 1071), point(400, 685)];
      this.balance(0);
    }
    range(a, b) { return a + this.random() * (b - a); }
    choose(values) { return values[Math.floor(this.random() * values.length)]; }
    flight(bird, start, end, state, now) {
      const dx = end.x - start.x;
      bird.start = { ...start }; bird.end = { ...end };
      bird.control1 = point(start.x + dx * .32, start.y - this.range(45, 100));
      bird.control2 = point(end.x - dx * .18, end.y - this.range(65, 135));
      bird.duration = clamp(Math.hypot(dx, end.y - start.y) / this.range(190, 255), 2.5, 8);
      bird.since = now; bird.state = state; bird.facing = dx >= 0 ? 1 : -1;
    }
    spawn(now) {
      const mode = this.choose(['through', 'roof', 'ground']);
      const anchor = mode === 'roof' ? this.choose(this.roofs) : this.choose(this.grounds.filter(p => this.isWalkable(p)));
      const fromLeft = this.random() > .5;
      const start = point(fromLeft ? -190 : W + 190, clamp((anchor?.y ?? 900) - this.range(80, 280), 130, 1580));
      const end = mode === 'through' ? point(fromLeft ? W + 190 : -190, clamp(start.y + this.range(-120, 160), 100, 1650)) : { ...anchor };
      const bird = { id: ++this.serial, mode, anchor: { ...end }, x: start.x, y: start.y, phase: this.range(0, 6), pose: 4, retiring: false, visibleAt: now + this.range(0, 2.8) };
      this.flight(bird, start, end, mode === 'through' ? 'flying' : 'approaching', bird.visibleAt);
      this.birds.push(bird);
    }
    depart(bird, now) {
      const direction = this.random() > .5 ? 1 : -1;
      const end = point(direction > 0 ? W + 190 : -190, clamp(bird.y - this.range(130, 300), 60, 1600));
      this.flight(bird, point(bird.x, bird.y), end, 'departing', now);
    }
    balance(now) {
      // Departures count toward the hard cap until they leave the scene.
      while (this.birds.length < this.targetCount && this.birds.length < 3) this.spawn(now);
    }
    update(now, actor = null, daylight = true) {
      this.time = now;
      if(!daylight){this.active=false;this.birds=[];this.targetCount=0;return;}
      if(!this.active){this.active=true;this.targetCount=Math.floor(this.random()*4);this.nextPopulation=now+this.range(12,24);}

      if (now >= this.nextPopulation) {
        this.targetCount = Math.floor(this.random() * 4); this.nextPopulation = now + this.range(12, 24);
        this.birds.slice(this.targetCount).forEach(bird => { bird.retiring = true; if (['perched', 'hopping', 'approaching', 'landing'].includes(bird.state)) this.depart(bird, now); });
      }
      this.birds = this.birds.filter(bird => !(bird.retiring && now < bird.visibleAt));
      for (const bird of this.birds) {
        if (now < bird.visibleAt) continue;
        if (['flying', 'approaching', 'landing', 'departing'].includes(bird.state)) {
          const u = clamp((now - bird.since) / bird.duration);
          const p = cubic(bird.start, bird.control1, bird.control2, bird.end, u);
          bird.x = p.x; bird.y = p.y;
          if (bird.state === 'approaching' && u > .84) bird.state = 'landing';
          if (u >= 1) {
            if (bird.state === 'landing' || bird.state === 'approaching') {
              bird.state = 'perched'; bird.anchor = { ...bird.end }; bird.perchUntil = now + this.range(4, 10); bird.nextAction = now + this.range(.8, 2); bird.pose = 4;
            } else bird.finished = true;
          }
        } else if (bird.state === 'hopping') {
          const u = clamp((now - bird.since) / .42);
          bird.x = lerp(bird.start.x, bird.end.x, smooth(u)); bird.y = lerp(bird.start.y, bird.end.y, smooth(u)) - Math.sin(u * Math.PI) * 7;
          if (u >= 1) { bird.state = 'perched'; bird.anchor = { ...bird.end }; bird.nextAction = now + this.range(1, 2); }
        } else {
          const startled = actor && bird.mode === 'ground' && Math.hypot(actor.x - bird.x, actor.y - bird.y) < 52;
          if (bird.retiring || now > bird.perchUntil || startled) { this.depart(bird, now); continue; }
          if (now > bird.nextAction) {
            bird.pose = this.choose([4, 4, 5, 6, 7]); bird.nextAction = now + this.range(.55, 1.8);
            if (bird.mode === 'ground' && this.random() < .35) {
              const end = point(bird.x + this.range(-9, 9), bird.y + this.range(-4, 4));
              if (this.isWalkable(end)) { bird.start = point(bird.x, bird.y); bird.end = end; bird.since = now; bird.state = 'hopping'; bird.facing = end.x > bird.x ? 1 : -1; }
            }
          }
        }
      }
      this.birds = this.birds.filter(bird => !bird.finished); this.balance(now);
    }
    snapshot() {
      return { active:this.active,targetCount: this.targetCount, count: this.birds.filter(b => this.time >= b.visibleAt).length, birds: this.birds.filter(b => this.time >= b.visibleAt).map(b => ({ id: b.id, state: b.state, mode: b.mode, x: b.x, y: b.y })) };
    }
  }

  function createIslandLife({ ctx, unifiedArt, original, mask, birdSheet, validationArt, edaArt, designArt, reorderedArt, workshopArt, detailImages = {}, isWalkable, onBirdState, random = Math.random }) {
    // A single master owns the buildings, paving, cliffs and alpha edge. Never
    // reapply the historical crop textures over a repaired master.
    const baseArt=unifiedArt||original;
    const native = surface(baseArt.naturalWidth, baseArt.naturalHeight), nativeContext = native.getContext('2d');
    nativeContext.drawImage(baseArt, 0, 0);
    // The original JPG has clouds occluding a few cliff/tree edges. Recover only
    // those occluded areas from the cutout; keep original-resolution detail elsewhere.
    const recoveryAreas = [[806,383,180,165],[163,583,176,125],[958,1116,156,133],[89,1390,167,186],[140,1628,282,182],[572,1663,295,168],[791,1704,242,190]];
    if(!unifiedArt)for(const [x,y,w,h] of recoveryAreas){
      const pw=Math.ceil(w*original.width/W),ph=Math.ceil(h*original.height/H);
      const coverage=surface(pw,ph),m=coverage.getContext('2d');
      m.filter='blur(4px)';m.fillStyle='#fff';m.fillRect(6,6,pw-12,ph-12);
      const recovered=surface(pw,ph),r=recovered.getContext('2d');
      r.drawImage(mask,x/W*mask.width,y/H*mask.height,w/W*mask.width,h/H*mask.height,0,0,pw,ph);
      r.globalCompositeOperation='destination-in';r.drawImage(coverage,0,0);
      nativeContext.globalCompositeOperation='destination-out';nativeContext.drawImage(coverage,x/W*native.width,y/H*native.height);
      nativeContext.globalCompositeOperation='lighter';nativeContext.drawImage(recovered,x/W*native.width,y/H*native.height);
    }
    if(!unifiedArt){nativeContext.globalCompositeOperation = 'destination-in'; nativeContext.drawImage(mask, 0, 0, native.width, native.height);}
    nativeContext.globalCompositeOperation = 'source-over';
    const scaleX = native.width / W, scaleY = native.height / H;
    const birds = new IslandBirds({ random, isWalkable });
    let time = 0;
    function softPatch(vertices, image, blur = 3) {
      const xs = vertices.map(p => p[0]), ys = vertices.map(p => p[1]);
      const box = { x: Math.floor(Math.min(...xs)) - 12, y: Math.floor(Math.min(...ys)) - 12, w: Math.ceil(Math.max(...xs) - Math.min(...xs)) + 24, h: Math.ceil(Math.max(...ys) - Math.min(...ys)) + 24 };
      const texture = surface(box.w * scaleX, box.h * scaleY), g = texture.getContext('2d');
      g.drawImage(image, box.x / W * image.width, box.y / H * image.height, box.w / W * image.width, box.h / H * image.height, 0, 0, texture.width, texture.height);
      const coverage = surface(texture.width, texture.height), m = coverage.getContext('2d');
      m.scale(scaleX, scaleY); m.translate(-box.x, -box.y); m.filter = `blur(${blur}px)`; m.fillStyle = '#fff'; m.beginPath(); path(m, vertices); m.fill();
      g.globalCompositeOperation = 'destination-in'; g.drawImage(coverage, 0, 0);
      return { texture, box };
    }
    if (validationArt&&!unifiedArt) {
      // Replace furnishings only. The original roof, arched facade and island stay intact.
      const replacement = softPatch([[264,954],[405,1021],[414,1147],[390,1178],[336,1202],[304,1187],[279,1208],[190,1169],[188,1088],[210,1082],[260,1052]], validationArt, 1.5);
      const { texture, box } = replacement;
      nativeContext.drawImage(texture, box.x*scaleX, box.y*scaleY, box.w*scaleX, box.h*scaleY);
    }
    if (edaArt&&!unifiedArt) {
      const regions = [
        [[431,462],[523,413],[526,499],[535,501],[659,540],[670,585],[563,635],[424,582]],
        [[631,848],[695,820],[781,790],[864,816],[922,837],[1011,893],[1017,975],[978,1018],[843,1066],[618,966]],
        [[696,1018],[790,1018],[790,1102],[696,1102]],
        [[805,1269],[869,1269],[890,1326],[854,1346],[796,1320]]
      ];
      for (const vertices of regions) {
        const { texture, box } = softPatch(vertices, edaArt, 1.5);
        nativeContext.drawImage(texture, box.x*scaleX, box.y*scaleY, box.w*scaleX, box.h*scaleY);
      }
    }
    if (designArt&&!unifiedArt) {
      const { texture, box } = softPatch([[431,462],[523,413],[526,478],[572,488],[580,513],[659,540],[670,585],[563,635],[424,582]], designArt, 1.5);
      nativeContext.drawImage(texture, box.x*scaleX, box.y*scaleY, box.w*scaleX, box.h*scaleY);
    }
    // Keep each remastered interior at its own full source resolution. Baking it
    // back into the whole-island texture would discard most of the new detail.
    const detailSpecs = [
      {key:'design',x:390,y:380,size:320,poly:[[431,462],[523,413],[526,478],[572,488],[580,513],[659,540],[670,585],[563,635],[424,582]]},
      {key:'workshop',x:605,y:765,size:430,poly:[[631,848],[695,820],[781,790],[864,816],[922,837],[1011,893],[1017,975],[978,1018],[843,1066],[618,966]]},
      {key:'terrace',x:605,y:765,size:430,poly:[[680,1015],[792,1015],[792,1120],[680,1120]]},
      {key:'verification',x:175,y:935,size:270,poly:[[264,954],[405,1021],[414,1147],[390,1178],[336,1202],[304,1187],[279,1208],[190,1169],[188,1088],[210,1082],[260,1052]]},
      {key:'simulation',x:685,y:1190,size:350,poly:[[716,1240],[747,1209],[801,1198],[869,1204],[934,1231],[984,1275],[989,1392],[969,1429],[904,1462],[823,1468],[752,1448],[715,1425]]}
    ];
    const detailLayers = detailSpecs.filter(s => !unifiedArt&&detailImages[s.key]&&(!reorderedArt||s.key==='design'||s.key==='terrace')).map(spec => {
      const image = detailImages[spec.key], texture = surface(image.width,image.height), g = texture.getContext('2d');
      const coverage = surface(image.width,image.height), m = coverage.getContext('2d');
      g.drawImage(image,0,0); m.scale(image.width/spec.size,image.height/spec.size); m.translate(-spec.x,-spec.y);
      m.filter = 'blur(1.1px)'; m.fillStyle = '#fff'; m.beginPath(); path(m,spec.poly); m.fill();
      g.globalCompositeOperation = 'destination-in'; g.drawImage(coverage,0,0);
      return {...spec,texture};
    });
    if(reorderedArt&&!unifiedArt){
      // Only the building silhouettes change; original bridges, stairs, ground
      // textures and cliffs retain their exact navigation coordinates.
      for(const [key,contour] of Object.entries(IslandOutlines.replacedBuildings)){
        nativeContext.save();nativeContext.scale(scaleX,scaleY);
        nativeContext.clip(new Path2D(contour));nativeContext.clearRect(0,0,W,H);
        if(key==='lower'&&workshopArt){
          // Reuse the user's selected workshop artwork at its original island coordinates.
          nativeContext.drawImage(workshopArt,0,0,W,H);
        }else nativeContext.drawImage(reorderedArt,0,0,W,H);
        nativeContext.restore();
      }
    }
    let fringeRemoved=0;
    if(!unifiedArt){
      // Remove only pale matte connected to transparency, never interior highlights.
      const pixels=nativeContext.getImageData(0,0,native.width,native.height),rgba=pixels.data;
      const count=native.width*native.height,depth=new Uint8Array(count),queue=new Int32Array(count);
      const isMatte=i=>rgba[i*4+3]>0&&Math.min(rgba[i*4],rgba[i*4+1],rgba[i*4+2])>195&&Math.max(rgba[i*4],rgba[i*4+1],rgba[i*4+2])-Math.min(rgba[i*4],rgba[i*4+1],rgba[i*4+2])<48;
      let head=0,tail=0;
      for(let i=0;i<count;i++){
        if(!isMatte(i))continue;
        const x=i%native.width,y=Math.floor(i/native.width);
        if((x&&rgba[(i-1)*4+3]<8)||(x<native.width-1&&rgba[(i+1)*4+3]<8)||(y&&rgba[(i-native.width)*4+3]<8)||(y<native.height-1&&rgba[(i+native.width)*4+3]<8)){depth[i]=1;queue[tail++]=i;}
      }
      const matteWidth=Math.ceil(scaleX*7);
      while(head<tail){
        const i=queue[head++],x=i%native.width,y=Math.floor(i/native.width);rgba[i*4+3]=0;fringeRemoved++;
        if(depth[i]>=matteWidth)continue;
        for(const j of [x?i-1:-1,x<native.width-1?i+1:-1,y?i-native.width:-1,y<native.height-1?i+native.width:-1]){
          if(j>=0&&!depth[j]&&isMatte(j)){depth[j]=depth[i]+1;queue[tail++]=j;}
        }
      }
      nativeContext.putImageData(pixels,0,0);
    }
    const trees = [
      { pivot: [371, 547], phase: 0, poly: [[256,410],[275,365],[312,350],[330,326],[367,318],[394,333],[406,366],[400,418],[408,447],[398,480],[374,502],[332,506],[299,495],[273,474],[256,449]] },
      { pivot: [749, 606], phase: 1.9, poly: [[695,450],[710,420],[740,404],[770,397],[794,391],[822,403],[838,426],[840,460],[832,483],[840,514],[831,541],[811,567],[778,579],[744,575],[721,551],[699,522],[693,491]] },
      { pivot: [127, 1014], phase: 4.1, poly: [[31,856],[42,837],[72,826],[104,814],[141,815],[161,829],[174,851],[171,877],[153,904],[141,931],[116,949],[83,965],[58,962],[38,938],[30,907]] }
    ].map(tree => ({ ...tree, patch: softPatch(tree.poly, native, 4) }));
    const plants=[
      {pivot:[620,720],phase:.7,poly:[[485,670],[720,665],[732,740],[510,765]]},
      {pivot:[767,1100],phase:2.2,poly:[[620,1070],[850,1060],[845,1150],[630,1180]]},
      {pivot:[240,1285],phase:4.5,poly:[[100,1230],[310,1240],[300,1340],[130,1320]]},
      {pivot:[390,1510],phase:1.5,poly:[[330,1390],[455,1400],[470,1520],[340,1540]]},
      {pivot:[1040,1490],phase:3.6,poly:[[1005,1440],[1085,1440],[1090,1630],[1020,1640]]},
      {pivot:[190,1490],phase:5.1,poly:[[145,1470],[220,1470],[255,1700],[180,1710]]}
    ].map(plant=>{
      const patch=softPatch(plant.poly,native,3),g=patch.texture.getContext('2d'),data=g.getImageData(0,0,patch.texture.width,patch.texture.height);
      for(let i=0;i<data.data.length;i+=4){const r=data.data[i],green=data.data[i+1],b=data.data[i+2];if(!(green>r*.9&&green>b*1.16&&green>32))data.data[i+3]=0;}
      g.putImageData(data,0,0);return {...plant,patch};
    });
    const buildingSpecs=Object.entries({clock:{x:385,y:70,w:330,h:595},library:{x:585,y:625,w:470,h:460},lab:{x:95,y:870,w:350,h:355},workshop:{x:605,y:1105,w:470,h:420}}).map(([key,box])=>({key,...box,levels:{}}));
    function buildingLevel(spec,size){
      let entry=spec.levels[size];if(entry)return entry;
      const image=new Image();image.decoding='async';image.fetchPriority='low';
      entry={image,ready:false,failed:false,presentations:{}};spec.levels[size]=entry;
      image.onload=()=>{entry.ready=true;};image.onerror=()=>{entry.failed=true;};
      image.src='assets/building-'+spec.key+'-'+({1024:'1k',2048:'2k',4096:'4k'}[size])+'-v62.webp';return entry;
    }
    function drawBuildingDetails(g,lighting){
      if(unifiedArt)return;
      const matrix=g.getTransform(),density=Math.hypot(matrix.a,matrix.b);
      for(const spec of buildingSpecs){
        const left=spec.x*matrix.a+matrix.e,top=spec.y*matrix.d+matrix.f;
        if(left+spec.w*density<0||top+spec.h*density<0||left>g.canvas.width||top>g.canvas.height)continue;
        const pixels=Math.max(spec.w,spec.h)*density,renderSize=pixels>2200?4096:pixels>1100?2048:1024;
        const full=buildingLevel(spec,4096);
        const fallback=full.ready?null:buildingLevel(spec,1024);
        const entry=full.ready?full:fallback?.ready?fallback:null;
        if(!entry)continue;
        // The source is always 4K once loaded. Cache its screen-size resampling
        // so the four large textures do not need downsampling on every frame.
        const sourceSize=Math.max(entry.image.naturalWidth,entry.image.naturalHeight);
        const target=Math.min(renderSize,sourceSize);let texture=entry.image;
        if(target<sourceSize){
          texture=entry.presentations[target];
          if(!texture){texture=surface(Math.round(entry.image.naturalWidth*target/sourceSize),Math.round(entry.image.naturalHeight*target/sourceSize));const p=texture.getContext('2d');p.imageSmoothingEnabled=true;p.imageSmoothingQuality='high';p.drawImage(entry.image,0,0,texture.width,texture.height);entry.presentations[target]=texture;}
        }
        spec.drawnSource=sourceSize;spec.renderSize=target;
        g.drawImage(grade(texture,lighting),spec.x,spec.y,spec.w,spec.h);
      }
    }
    const gradedTextures=new WeakMap();
    function grade(texture,lighting){
      const dusk=Math.round((lighting.dusk||0)*20)/20,night=Math.round((lighting.night||0)*10)/10;
      if(!dusk&&!night)return texture;
      const key=dusk+':'+night,old=gradedTextures.get(texture);if(old?.key===key)return old.canvas;
      const canvas=surface(texture.width,texture.height),g=canvas.getContext('2d');
      g.filter='sepia('+(dusk*.34)+') saturate('+(1+dusk*.12)+') brightness('+(1-dusk*.1-night*.12)+')';
      g.drawImage(texture,0,0);g.filter='none';
      if(dusk>0){const warmth=g.createLinearGradient(0,canvas.height,canvas.width,0);warmth.addColorStop(0,'#6d5b8b');warmth.addColorStop(.5,'#ba9481');warmth.addColorStop(1,'#ffd298');g.globalCompositeOperation='source-atop';g.globalAlpha=dusk*.20;g.fillStyle=warmth;g.fillRect(0,0,canvas.width,canvas.height);}
      gradedTextures.set(texture,{key,canvas});return canvas;
    }
    function drawBase(t, g = ctx, lighting = {}) {
      // The complete, high-resolution island remains underneath every tree patch.
      // Feathered moving leaves cannot punch a transparent polygon seam into it.
      g.drawImage(grade(native,lighting), 0, 0, W, H);
      for (const detail of detailLayers) g.drawImage(grade(detail.texture,lighting),detail.x,detail.y,detail.size,detail.size);
      drawBuildingDetails(g,lighting);
      for (const tree of trees) {
        const gust=.8+.35*Math.sin(t*.21+tree.phase*.5);
        const breeze=(Math.sin(t*.65+tree.phase)*.027+Math.sin(t*1.45+tree.phase)*.007)*gust;
        const { texture, box } = tree.patch;
        g.save(); g.translate(...tree.pivot); g.rotate(breeze); g.translate(-tree.pivot[0], -tree.pivot[1]);
        g.globalAlpha = .88; g.drawImage(grade(texture,lighting), box.x, box.y, box.w, box.h); g.restore();
      }
      for(const plant of plants){
        const wind=Math.sin(t*.87+plant.phase)*.024+Math.sin(t*1.73+plant.phase)*.009;
        const {texture,box}=plant.patch;g.save();g.translate(...plant.pivot);
        g.transform(1,0,wind,1,Math.sin(t*.53+plant.phase)*1.2,0);g.translate(-plant.pivot[0],-plant.pivot[1]);
        g.globalAlpha=.82;g.drawImage(grade(texture,lighting),box.x,box.y,box.w,box.h);g.restore();
      }
    }

    const falls = [
      [[474,769,30],[469,798,29],[468,827,26],[468,839,24]],
      [[481,997,15],[478,1018,16],[473,1037,16],[471,1051,15]],
      [[560,1168,22],[570,1196,27],[592,1218,29],[608,1247,29],[609,1288,28],[608,1329,28]]
    ];
    function waterPoint(points, u) {
      const p = clamp(u, 0, .999999) * (points.length - 1), i = Math.floor(p), f = p - i, a = points[i], b = points[i + 1];
      return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), w: lerp(a[2], b[2], f) };
    }
    function drawWater(t) {
      // Only travelling highlights are drawn here; the original water and foam stay still.
      for (const [fallIndex, points] of falls.entries()) {
        ctx.save();
        ctx.beginPath();
        points.forEach(([x,y,w], i) => i ? ctx.lineTo(x-w/2,y) : ctx.moveTo(x-w/2,y));
        [...points].reverse().forEach(([x,y,w]) => ctx.lineTo(x+w/2,y));
        ctx.closePath(); ctx.clip();
        ctx.lineCap = 'round'; ctx.strokeStyle = '#c4f3f6';
        const count = fallIndex === 2 ? 18 : 12;
        for (let i = 0; i < count; i++) {
          const head = (t * (.21 + (i % 3) * .035) + i * .137 + fallIndex * .27) % 1;
          const length = .07 + (i % 4) * .018, lane = Math.sin(i * 5.17 + fallIndex) * .36;
          ctx.lineWidth = .65 + (i % 3) * .22;
          // Small segments fade at both ends instead of wrapping across the waterfall.
          for (let j = 0; j < 6; j++) {
            const u = head - length + length * j / 6, v = head - length + length * (j + 1) / 6;
            if (u < 0 || v > 1) continue;
            const a = waterPoint(points,u), b = waterPoint(points,v);
            const fade = smooth(u/.12) * smooth((1-v)/.16);
            ctx.globalAlpha = .26 * Math.sin(Math.PI * (j+.5)/6) * fade;
            ctx.beginPath(); ctx.moveTo(a.x + lane*a.w, a.y); ctx.lineTo(b.x + lane*b.w, b.y); ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    const screens = [
      {quad:[[693,868],[710,861],[710,875],[693,884]],kind:'graph',phase:0},
      {quad:[[724,836],[768,814],[768,846],[724,868]],kind:'pcb',phase:2},
      {quad:[[800,807],[859,820],[859,849],[800,836]],kind:'pcb',phase:4},
      {quad:[[909,875],[923,880],[923,888],[909,883]],kind:'graph',phase:6},
      {quad:[[935,877],[976,899],[976,922],[935,900]],kind:'pcb',phase:3},
      {quad:[[832,1257],[867,1257],[868,1285],[831,1285]],kind:'thermal',phase:1},
      {quad:[[771,1279],[803,1264],[803,1295],[770,1310]],kind:'eye',phase:3},
      {quad:[[923,1273],[944,1286],[946,1306],[924,1293]],kind:'thermal',phase:5},
      {quad:[[278,1008],[324,1025],[324,1072],[278,1055]],kind:'pcb',phase:0,occlusion:[[309,1047],[321,1051],[322,1070],[309,1065]]},
      {quad:[[342,1033],[396,1052],[396,1093],[342,1074]],kind:'pass',phase:2}
    ];
    const relocatedScreens = [
      {quad:[[758,849],[815,868],[815,892],[758,873]],kind:'pcb',phase:0},
      {quad:[[845,872],[894,890],[894,915],[845,897]],kind:'pass',phase:2},
      {quad:[[184,1048],[243,1030],[243,1080],[184,1097]],kind:'thermal',phase:1},
      {quad:[[316,1031],[382,1055],[382,1090],[316,1067]],kind:'eye',phase:3},
      {quad:[[751,1308],[792,1291],[792,1323],[751,1340]],kind:'pcb',phase:4},
      {quad:[[830,1278],[880,1296],[880,1329],[830,1311]],kind:'pcb',phase:6}
    ];
    const display=surface(768,480),displayContext=display.getContext('2d');
    displayContext.scale(6,6);
    function drawScreen(screen,t) {
      const g=displayContext,phase=t+screen.phase;
      g.fillStyle='#113e34';g.fillRect(0,0,128,80);
      g.strokeStyle='#3a82683f';g.lineWidth=1;
      for(let x=0;x<128;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x,80);g.stroke();}
      for(let y=0;y<80;y+=16){g.beginPath();g.moveTo(0,y);g.lineTo(128,y);g.stroke();}
      if(screen.kind==='graph'){
        g.beginPath();for(let x=0;x<=128;x+=2){const y=43+Math.sin(x*.09-phase*2)*13+Math.sin(x*.25+phase)*6;if(x)g.lineTo(x,y);else g.moveTo(x,y);}
        g.strokeStyle='#75eb9d';g.lineWidth=2;g.shadowColor='#62e8a0';g.shadowBlur=3;g.stroke();g.shadowBlur=0;
        const scan=(phase*23)%128;g.fillStyle='#b7ffcc50';g.fillRect(scan,0,1,80);
      }else if(screen.kind==='eye'){
        g.strokeStyle='#79e8c0';g.lineWidth=1.2;
        for(let n=0;n<9;n++){
          g.beginPath();
          for(let x=4;x<124;x++){
            const envelope=Math.cos((x-64)*Math.PI/120),y=37+Math.sin(n*1.8)*envelope*25+Math.sin(x*.11+phase+n)*2;
            if(x===4)g.moveTo(x,y);else g.lineTo(x,y);
          }
          g.globalAlpha=.45+n*.05;g.stroke();
        }
        g.globalAlpha=1;g.font='8px monospace';g.fillStyle='#c8ffdf';g.fillText('PCB SI',7,74);
      }else if(screen.kind==='thermal'){
        g.fillStyle='#143f86';g.fillRect(12,7,102,58);
        for(const [x,y,r] of [[48,28,27],[87,42,21]]){
          const hot=g.createRadialGradient(x,y,1,x,y,r+Math.sin(phase)*2);
          hot.addColorStop(0,'#ed544a');hot.addColorStop(.3,'#ffbc36');hot.addColorStop(.65,'#52cc87');hot.addColorStop(1,'#28a8c200');
          g.fillStyle=hot;g.fillRect(12,7,102,58);
        }
        g.strokeStyle='#acffe38a';g.lineWidth=1;
        for(let i=0;i<8;i++){g.beginPath();g.moveTo(17+i*12,12);g.lineTo(17+i*12,57);g.stroke();}
        g.fillStyle='#173c42';g.fillRect(38,20,19,16);g.fillRect(79,34,16,13);
        g.font='8px monospace';g.fillStyle='#c8ffdf';g.fillText('PCB TEMP / PI',7,76);
      }else if(screen.kind==='pcb'||screen.kind==='pass'){
        const boardWidth=screen.kind==='pass'?64:128;
        g.fillStyle='#102a25';g.fillRect(0,0,128,80);
        g.strokeStyle='#5ce29d';g.lineWidth=1.2;
        for(let i=0;i<9;i++){
          const x=8+i*(boardWidth-16)/9,y=10+(i*17)%56;
          g.beginPath();g.moveTo(x,5);g.lineTo(x,y);g.lineTo(Math.min(boardWidth-5,x+10),y+10);g.lineTo(Math.min(boardWidth-5,x+10),75);g.stroke();
          g.fillStyle='#f6d891';g.fillRect(x-1.5,y-1.5,3,3);
        }
        g.fillStyle='#172c29';g.fillRect(boardWidth*.32,27,boardWidth*.38,27);
        g.strokeStyle='#a9f5be';g.strokeRect(boardWidth*.32,27,boardWidth*.38,27);
        g.font='7px monospace';g.fillStyle='#c6ffd8';g.fillText('PCB',boardWidth*.37,44);
        g.fillStyle='#baffd399';g.fillRect((phase*18)%boardWidth,0,3,80);
        if(screen.kind==='pass'){
          g.fillStyle='#10372f';g.fillRect(65,0,63,80);
          g.font='bold 19px monospace';g.textAlign='center';g.fillStyle='#92fcae';g.fillText('PASS',96,45);
          g.font='7px monospace';g.fillText('PCB CHECK',96,61);g.textAlign='start';
        }
      }else{
        for(let row=0;row<6;row++){g.fillStyle=row%2?'#66c99b':'#85e6af';g.fillRect(8,9+row*11,35+(Math.sin(phase*.9+row*1.8)+1)*34,3);}
        for(let i=0;i<5;i++){g.fillStyle=Math.sin(phase*2+i)>0?'#b6f4c9':'#2f745c';g.fillRect(104,i*12+10,8,5);}
      }
      const [a,b,,d]=screen.quad;
      ctx.save();
      // Animate over the remastered monitor artwork without hiding its fine routing.
      if (unifiedArt||detailLayers.length) { ctx.globalCompositeOperation='screen'; ctx.globalAlpha=.32; }
      if(screen.occlusion){ctx.beginPath();path(ctx,screen.quad);path(ctx,screen.occlusion);ctx.clip('evenodd');}
      ctx.transform((b[0]-a[0])/128,(b[1]-a[1])/128,(d[0]-a[0])/80,(d[1]-a[1])/80,a[0],a[1]);ctx.drawImage(display,0,0,128,80);ctx.restore();
    }
    function drawInteriors(t) {
      (unifiedArt||reorderedArt ? relocatedScreens : screens).forEach(screen=>drawScreen(screen,t));
    }
    function drawBirds(t) {
      if(!birds.active)return;
      for(const bird of birds.birds){
        if(t<bird.visibleAt)continue;
        const flight=['flying','approaching','landing','departing'].includes(bird.state);
        let frame=flight?[0,1,2,1][Math.floor((t*7+bird.phase)*4)%4]:bird.pose;
        if(bird.state==='landing')frame=3;
        if(bird.state==='departing'&&t-bird.since<.2)frame=7;
        const column=frame%4,upper=frame<4;
        const sourceW=birdSheet.width/1788,sourceH=birdSheet.height/894;
        const sx=column*447,sy=upper?0:520,sh=upper?510:350,baseline=upper?417:281;
        const scale=.087*(bird.mode==='roof'?.94:1);
        ctx.save();ctx.translate(bird.x,bird.y);
        if(!flight){ctx.fillStyle='#25332e30';ctx.beginPath();ctx.ellipse(0,0,8,2.4,0,0,Math.PI*2);ctx.fill();}
        ctx.scale(bird.facing,1);
        if(flight)ctx.rotate(Math.sin(t*2+bird.phase)*.035);
        ctx.drawImage(birdSheet,sx*sourceW,sy*sourceH,447*sourceW,sh*sourceH,-252*scale,-baseline*scale,447*scale,sh*scale);
        ctx.restore();
      }
    }
    function treeCoverage(t) {
      const reference=surface(W,H),result=surface(W,H),a=reference.getContext('2d'),b=result.getContext('2d');
      a.drawImage(native,0,0,W,H);drawBase(t,b);
      const before=a.getImageData(0,0,W,H).data,after=b.getImageData(0,0,W,H).data;
      let gaps=0;
      for(const tree of trees){const {box}=tree.patch;for(let y=box.y;y<box.y+box.h;y++)for(let x=box.x;x<box.x+box.w;x++){const i=(Math.floor(y)*W+Math.floor(x))*4+3;if(before[i]>240&&after[i]<220)gaps++;}}
      return gaps;
    }
    return {
      drawBase,drawWater,drawInteriors,drawBirds,
      update(t,actor,daylight=true){time=t;birds.update(t,actor,daylight);onBirdState?.(birds.birds,t);},
      snapshot(){return{unifiedArt:unifiedArt?{source:unifiedArt.getAttribute('src'),width:native.width,height:native.height}:null,buildingDetails:(unifiedArt?[]:buildingSpecs).map(spec=>({key:spec.key,drawnSource:spec.drawnSource||0,renderSize:spec.renderSize||0,box:{x:spec.x,y:spec.y,w:spec.w,h:spec.h},levels:Object.entries(spec.levels).map(([size,entry])=>({size:Number(size),ready:entry.ready,failed:entry.failed,width:entry.image.naturalWidth,height:entry.image.naturalHeight}))})),fringeRemoved,plantPatches:plants.length,resolution:{width:native.width,height:native.height},detailTextures:Object.entries(detailImages).map(([key,image])=>({key,width:image.width,height:image.height})),displayResolution:{width:display.width,height:display.height},birds:birds.snapshot(),pcbDisplayCount:screens.length};},
      treeCoverage
    };
  }
  window.IslandBirds=IslandBirds;
  window.createIslandLife=createIslandLife;
})();
