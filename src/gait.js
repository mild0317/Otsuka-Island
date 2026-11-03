(() => {
  'use strict';
  const tau=Math.PI*2,smooth=t=>t*t*(3-2*t);
  function sample(phase,index,{stride=44,lift=14,heading=0}={}){
    const cycle=((phase/tau+index*.5)%1+1)%1,support=cycle<.6,u=support?cycle/.6:(cycle-.6)/.4;
    const travel=support?stride*(.5-u):stride*(smooth(u)-.5),height=support?0:Math.sin(Math.PI*u)*lift;
    const x=Math.cos(heading)*travel,y=Math.sin(heading)*travel*.35-height;
    return {support,cycle,foot:{x,y},knee:{x:x*.55+Math.cos(heading)*height*.30,y:y*.45}};
  }
  function deform(y,hip,knee,ankle,step){
    if(y<=hip)return {x:0,y:0};
    if(y>=ankle)return {...step.foot};
    if(y<knee){const t=smooth((y-hip)/(knee-hip));return{x:step.knee.x*t,y:step.knee.y*t};}
    const t=smooth((y-knee)/(ankle-knee));return{x:step.knee.x+(step.foot.x-step.knee.x)*t,y:step.knee.y+(step.foot.y-step.knee.y)*t};
  }
  window.IslandGait=Object.freeze({sample,deform});
})();
