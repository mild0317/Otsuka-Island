(() => {
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
  function peopleClear(a,b,people,radius=48){
    return people.every(p=>{const r=p.radius||radius,start=distance(a,p),end=distance(b,p),nearest=segmentDistance(p,a,b);return nearest>=r-.01||(start<r&&end>start&&nearest>=start-.01);});
  }
  // Feet are painted directly on these visible surfaces. z is physical height,
  // not an extra rendering offset. Only these connected footholds are climbable.
  // Each chain starts at verified floor; cats cannot select arbitrary sky pixels.
  const chains={
    island:[
      ['設計室外扶手與屋頂',[[450,635,0],[420,610,40],[405,520,100],[408,432,180],[435,388,225],[498,360,275]]],
      ['工坊扶手與屋頂',[[899,1031,0],[945,1000,45],[1010,950,90],[1018,875,145],[1020,820,205],[940,730,270],[834,664,325]]],
      ['驗証室矮牆與屋頂',[[302,1218,0],[277,1193,40],[198,1165,80],[140,1095,135],[115,1020,195],[137,945,245],[194,876,300]]],
      ['實驗室扶手與屋頂樑',[[748,1490,0],[745,1430,45],[705,1360,100],[700,1265,165],[739,1178,230],[802,1147,265]]],
      ['石橋扶手',[[371,870,0],[335,865,40],[350,895,40],[370,904,40]]],
    ],
    clock:[['工作台與窗台',[[880,800,0],[940,715,50],[1100,585,105],[1175,605,105],[1215,525,155],[1230,450,210]]]],
    workshop:[['工坊桌邊與牆台',[[1040,880,0],[1090,840,45],[1130,760,95],[1300,630,145],[1320,520,215]]]],
    library:[['驗証桌邊與窗台',[[880,810,0],[910,730,45],[1040,640,115],[1180,665,115],[1260,600,165],[1260,490,225]]]],
    lab:[['模擬平台邊緣',[[990,800,0],[920,725,45],[900,670,95],[810,710,95],[740,700,95]]]],
  };
  function scene(key){
    const nodes=[],edges=[];
    for(const [group,points] of chains[key]||[]){let previous=null;points.forEach(([x,y,z],i)=>{const n={id:key+'-'+nodes.length,x,y,z,group,surface:i===0?'floor':z>180?'roof':z>70?'ledge':'rail'};nodes.push(n);if(previous)edges.push([previous.id,n.id]);previous=n;});}
    return {nodes,edges};
  }
  const scenes=Object.fromEntries(Object.keys(chains).map(key=>[key,scene(key)]));
  function graphRoute(terrain,start,end){
    const cost=new Map([[start,0]]),previous=new Map(),open=new Set([start]);
    while(open.size){let current;for(const id of open)if(current===undefined||cost.get(id)<cost.get(current))current=id;open.delete(current);if(current===end)break;
      for(const [a,b] of terrain.edges){const next=a===current?b:b===current?a:null;if(!next)continue;const p=terrain.nodes.find(n=>n.id===current),q=terrain.nodes.find(n=>n.id===next),candidate=cost.get(current)+distance(p,q)+Math.abs(q.z-p.z)*.5;if(candidate<(cost.get(next)??Infinity)){cost.set(next,candidate);previous.set(next,current);open.add(next);}}
    }
    if(!cost.has(end))return null;const route=[];for(let id=end;id!==start;id=previous.get(id))route.unshift(terrain.nodes.find(n=>n.id===id));return route;
  }
  window.IslandCatTerrain=Object.freeze({scenes,peopleClear,segmentDistance,graphRoute});
})();
