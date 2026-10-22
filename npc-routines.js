(() => {
  'use strict';
  // Feet and furniture contacts are in the room artwork's 1536 × 1024 space.
  const station=(x,y,lx,ly,extra={})=>({x,y,look:{x:lx,y:ly},...extra});
  const profiles={
    clock:{name:'小公主',asset:'princess',height:363,speed:[105,135],start:'bench',habit:'動手試作、整理零件，偶爾回電腦確認佈線',
      stations:{bench:station(580,800,540,530,{contact:[510,585],item:{x:530,y:585},prop:'tray'}),computer:station(1185,815,1250,535,{chair:true,seatHip:[1180,710],contact:[1235,615]}),stool:station(665,795,565,530,{chair:true,mode:'bench',seatHip:[660,640],contact:[590,570]}),parts:station(810,760,735,550,{contact:[735,550],item:{x:735,y:550},storage:true,prop:'pcb'}),pause:station(785,885,720,650)},
      jobs:[['prototype',5],['computer',2],['organize',4],['inspect',3],['break',1]],
      times:{work:[12,23],type:[19,34],think:[3,7],inspect:[5,10],rest:[5,10]},
      extras:['nod','stretch','look','scratch']},
    library:{name:'Hank',asset:'hank',height:341,speed:[85,110],start:'bench',habit:'量測、核對紀錄、換站確認 PASS，動作較從容',
      stations:{bench:station(625,745,535,510,{contact:[555,540],item:{x:554,y:535},prop:'pcb'}),computer:station(610,685,570,430,{chair:true,mode:'bench',seatHip:[690,575],contact:[610,520],back:[[698,485],[747,477],[761,489],[756,552],[742,568],[690,567],[677,554],[684,513]]}),second:station(1055,785,1160,470,{chair:true,seatHip:[1050,640],contact:[1130,580],back:[[976,535],[1017,539],[1051,566],[1060,615],[1045,642],[990,628],[975,599]]}),notes:station(1135,800,1190,550,{contact:[1185,595],item:{x:1185,y:595},prop:'clipboard'}),pause:station(690,865,590,630)},
      jobs:[['measure',5],['computer',3],['crosscheck',4],['inspect',3],['record',2],['break',1]],
      times:{work:[13,25],type:[16,27],think:[5,11],inspect:[7,13],rest:[5,9]},extras:['glasses','nod','look','scratch']},
    lab:{name:'安東尼',asset:'anthony',height:330,speed:[80,105],start:'right',habit:'較長時間分析波形，換螢幕比對，盤胸或踱步思考',
      stations:{right:station(1125,715,1160,400,{contact:[1180,530]}),computer:station(1050,635,1140,400,{chair:true,seatHip:[1050,535],contact:[1120,480]}),second:station(465,635,410,410,{chair:true,seatHip:[465,535],contact:[415,480]}),overview:station(995,800,790,540,{contact:[940,625],item:{x:945,y:600},prop:'tablet'}),pause:station(600,835,770,530)},
      jobs:[['computer',5],['crosscheck',3],['analyze',4],['pace',3],['break',1]],
      times:{work:[14,25],type:[30,49],think:[8,17],inspect:[9,17],rest:[7,13]},extras:['fold','glasses','stretch','look']}
  };
  const action=(kind,time,station)=>({kind,time,station});
  function makeJob(profile,name,random=Math.random){
    const rand=range=>range[0]+random()*(range[1]-range[0]),t=profile.times;
    const at=(s,steps)=>[action('walk',0,s),...steps.map(([k,d])=>action(k,Array.isArray(d)?rand(d):d,s))];
    const computer=s=>at(s,[['stand',.45],['half',.85],['sit',.85],[profile.stations[s].mode==='bench'?'seatedWork':'type',t.type],['seatedLook',[2,5]],['half',.85],['stand',.9]]);
    const inspect=s=>at(s,[['reach',1.25],['pick',1.4],['inspect',t.inspect],['place',1.5],...(profile.asset==='hank'?[['scratch',t.think]]:[]),['work',t.work]]);
    let steps;
    switch(name){
      case 'computer':steps=computer('computer');break;
      case 'crosscheck':steps=[...computer('second'),...at(profile.asset==='anthony'?'overview':'bench',[['fold',t.think],['nod',2.5]])];break;
      case 'prototype':steps=[...at('bench',[['work',t.work],['scratch',t.think],['work',t.work]]),...computer('stool')];break;
      case 'organize':steps=[...at('parts',[['reach',1.2],['pick',1.3]]),...at('bench',[['inspect',t.inspect],['place',1.4],['sort',t.work],['pick',1.3]]),...at('parts',[['place',1.4],['sort',[4,8]]])];break;
      case 'measure':steps=[...at('bench',[['work',t.work],['glasses',3],['work',t.work]]),...computer('computer')];break;
      case 'record':steps=inspect('notes');break;
      case 'inspect':steps=inspect('bench');break;
      case 'analyze':steps=[...inspect('overview'),...at('right',[['fold',t.think],['scratch',t.think]])];break;
      case 'pace':steps=[...at('pause',[['fold',t.think]]),...at('overview',[['look',t.think]]),...at('right',[['scratch',t.think]])];break;
      default:steps=at('pause',[[profile.extras[Math.floor(random()*profile.extras.length)],t.rest],['stand',t.rest]]);
    }
    return steps;
  }
  window.IslandNPCRoutines=Object.freeze({profiles,makeJob});
})();
