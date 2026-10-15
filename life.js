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
      this.random = random; this.isWalkable = isWalkable; this.birds = []; this.serial = 0; this.time = 0;
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
    update(now, actor = null) {
      this.time = now;
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
      return { targetCount: this.targetCount, count: this.birds.filter(b => this.time >= b.visibleAt).length, birds: this.birds.filter(b => this.time >= b.visibleAt).map(b => ({ id: b.id, state: b.state, mode: b.mode, x: b.x, y: b.y })) };
    }
  }

  function createIslandLife({ ctx, original, mask, cleanWorkshop, birdSheet, isWalkable, random = Math.random }) {
    const native = surface(original.naturalWidth, original.naturalHeight), nativeContext = native.getContext('2d');
    nativeContext.drawImage(original, 0, 0);
    // The original JPG has clouds occluding a few cliff/tree edges. Recover only
    // those occluded areas from the cutout; keep original-resolution detail elsewhere.
    const recoveryAreas = [[806,383,180,165],[163,583,176,125],[958,1116,156,133],[89,1390,167,186],[140,1628,282,182],[572,1663,295,168],[791,1704,242,190]];
    for(const [x,y,w,h] of recoveryAreas){
      const pw=Math.ceil(w*original.width/W),ph=Math.ceil(h*original.height/H);
      const coverage=surface(pw,ph),m=coverage.getContext('2d');
      m.filter='blur(4px)';m.fillStyle='#fff';m.fillRect(6,6,pw-12,ph-12);
      const recovered=surface(pw,ph),r=recovered.getContext('2d');
      r.drawImage(mask,x/W*mask.width,y/H*mask.height,w/W*mask.width,h/H*mask.height,0,0,pw,ph);
      r.globalCompositeOperation='destination-in';r.drawImage(coverage,0,0);
      nativeContext.globalCompositeOperation='destination-out';nativeContext.drawImage(coverage,x/W*native.width,y/H*native.height);
      nativeContext.globalCompositeOperation='lighter';nativeContext.drawImage(recovered,x/W*native.width,y/H*native.height);
    }
    nativeContext.globalCompositeOperation = 'destination-in'; nativeContext.drawImage(mask, 0, 0, native.width, native.height);
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
    const trees = [
      { pivot: [371, 547], phase: 0, poly: [[256,410],[275,365],[312,350],[330,326],[367,318],[394,333],[406,366],[400,418],[408,447],[398,480],[374,502],[332,506],[299,495],[273,474],[256,449]] },
      { pivot: [749, 606], phase: 1.9, poly: [[695,450],[710,420],[740,404],[770,397],[794,391],[822,403],[838,426],[840,460],[832,483],[840,514],[831,541],[811,567],[778,579],[744,575],[721,551],[699,522],[693,491]] },
      { pivot: [127, 1014], phase: 4.1, poly: [[31,856],[42,837],[72,826],[104,814],[141,815],[161,829],[174,851],[171,877],[153,904],[141,931],[116,949],[83,965],[58,962],[38,938],[30,907]] }
    ].map(tree => ({ ...tree, patch: softPatch(tree.poly, native, 4) }));
    const robotPatches = [
      [[751,883],[784,882],[812,914],[817,938],[795,942],[779,932],[756,938],[751,912]],
      [[845,916],[882,909],[898,929],[901,956],[881,958],[869,946],[843,947]]
    ].map(p => softPatch(p, cleanWorkshop, 2.5));
    function drawBase(t, g = ctx) {
      // The complete, high-resolution island remains underneath every tree patch.
      // Feathered moving leaves cannot punch a transparent polygon seam into it.
      g.drawImage(native, 0, 0, W, H);
      for (const tree of trees) {
        const breeze = Math.sin(t * .7 + tree.phase) * .018 + Math.sin(t * 1.3 + tree.phase) * .004;
        const { texture, box } = tree.patch;
        g.save(); g.translate(...tree.pivot); g.rotate(breeze); g.translate(-tree.pivot[0], -tree.pivot[1]);
        g.globalAlpha = .88; g.drawImage(texture, box.x, box.y, box.w, box.h); g.restore();
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

    function link(g, a, b, width) {
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(a.x + 1.3, a.y + 2); g.lineTo(b.x + 1.3, b.y + 2); g.strokeStyle = '#28302d35'; g.lineWidth = width + 2; g.stroke();
      const gradient = g.createLinearGradient(a.x - nx * width / 2, a.y - ny * width / 2, a.x + nx * width / 2, a.y + ny * width / 2);
      gradient.addColorStop(0, '#8e9a96'); gradient.addColorStop(.26, '#e5e6db'); gradient.addColorStop(.58, '#f5f2e8'); gradient.addColorStop(1, '#a5afaa');
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineWidth = width; g.strokeStyle = gradient; g.stroke();
      g.beginPath(); g.moveTo(lerp(a.x,b.x,.15)-nx*width*.23,lerp(a.y,b.y,.15)-ny*width*.23); g.lineTo(lerp(a.x,b.x,.82)-nx*width*.23,lerp(a.y,b.y,.82)-ny*width*.23); g.lineWidth = .7; g.strokeStyle = '#ffffff99'; g.stroke();
    }
    function hub(g, p, r) {
      const gradient = g.createRadialGradient(p.x-2,p.y-2,1,p.x,p.y,r);
      gradient.addColorStop(0,'#f1eee2'); gradient.addColorStop(.6,'#b8c1ba'); gradient.addColorStop(1,'#717d78');
      g.fillStyle=gradient; g.beginPath(); g.ellipse(p.x,p.y,r,r*.84,-.2,0,Math.PI*2); g.fill();
      g.fillStyle='#66706d'; g.beginPath(); g.ellipse(p.x+.9,p.y,r*.48,r*.45,0,0,Math.PI*2); g.fill();
      g.fillStyle='#dadfd5'; g.beginPath(); g.arc(p.x+.4,p.y-.6,1.2,0,Math.PI*2); g.fill();
    }
    function rotate(v, a) { return point(v.x*Math.cos(a)-v.y*Math.sin(a),v.x*Math.sin(a)+v.y*Math.cos(a)); }
    function robotPose(t, index) {
      const base = index ? point(891,966) : point(774,950), shoulder = index ? point(890,951) : point(775,938);
      const a = Math.sin(t * .72 + index * 2) * .14, b = Math.sin(t * .89 + index * 1.8) * .22;
      const v1 = rotate(index ? point(-8,-29) : point(-4,-41),a), elbow=point(shoulder.x+v1.x,shoulder.y+v1.y);
      const v2 = rotate(index ? point(-28,16) : point(29,26),a+b), wrist=point(elbow.x+v2.x,elbow.y+v2.y);
      return {base,shoulder,elbow,wrist,grip:.65+Math.sin(t*1.2+index)*.3};
    }
    function drawRobot(t,index) {
      const {base,shoulder,elbow,wrist,grip}=robotPose(t,index);
      ctx.save();
      ctx.fillStyle='#424b46';ctx.beginPath();ctx.ellipse(base.x,base.y,12,6,-.2,0,Math.PI*2);ctx.fill();
      link(ctx,point(base.x,base.y-3),shoulder,12);hub(ctx,shoulder,7.3);
      link(ctx,shoulder,elbow,index?9:10);hub(ctx,elbow,6);
      link(ctx,elbow,wrist,index?7.6:8.8);hub(ctx,wrist,4.5);
      const angle=Math.atan2(wrist.y-elbow.y,wrist.x-elbow.x);
      ctx.translate(wrist.x,wrist.y);ctx.rotate(angle);
      ctx.strokeStyle='#727f79';ctx.lineWidth=2;ctx.lineCap='round';
      for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(3,sign*2);ctx.lineTo(7,sign*(2+grip*2));ctx.lineTo(10,sign*grip);ctx.stroke();}
      ctx.restore();
    }
    const screens = [
      {quad:[[692,873],[705,867],[705,876],[692,882]],kind:'bars',phase:0},
      {quad:[[738,841],[753,835],[754,851],[739,858]],kind:'graph',phase:2},
      {quad:[[800,812],[821,812],[821,826],[800,826]],kind:'graph',phase:4},
      {quad:[[893,873],[904,878],[904,887],[893,883]],kind:'bars',phase:6},
      {quad:[[832,1257],[867,1257],[868,1285],[831,1285]],kind:'graph',phase:1},
      {quad:[[771,1279],[803,1264],[803,1295],[770,1310]],kind:'bars',phase:3},
      {quad:[[923,1273],[944,1286],[946,1306],[924,1293]],kind:'bars',phase:5}
    ];
    const display=surface(128,80),displayContext=display.getContext('2d');
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
      }else{
        for(let row=0;row<6;row++){g.fillStyle=row%2?'#66c99b':'#85e6af';g.fillRect(8,9+row*11,35+(Math.sin(phase*.9+row*1.8)+1)*34,3);}
        for(let i=0;i<5;i++){g.fillStyle=Math.sin(phase*2+i)>0?'#b6f4c9':'#2f745c';g.fillRect(104,i*12+10,8,5);}
      }
      const [a,b,,d]=screen.quad;
      ctx.save();ctx.transform((b[0]-a[0])/128,(b[1]-a[1])/128,(d[0]-a[0])/80,(d[1]-a[1])/80,a[0],a[1]);ctx.drawImage(display,0,0);ctx.restore();
    }
    function drawInteriors(t) {
      for(const {texture,box} of robotPatches) ctx.drawImage(texture,box.x,box.y,box.w,box.h);
      drawRobot(t,0);drawRobot(t,1); screens.forEach(screen=>drawScreen(screen,t));
    }
    function drawBirds(t) {
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
      update(t,actor){time=t;birds.update(t,actor);},
      snapshot(){return{resolution:{width:native.width,height:native.height},birds:birds.snapshot(),robotPoses:[robotPose(time,0),robotPose(time,1)]};},
      treeCoverage
    };
  }
  window.IslandBirds=IslandBirds;
  window.createIslandLife=createIslandLife;
})();
