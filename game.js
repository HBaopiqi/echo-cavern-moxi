"use strict";
/* ===== 主题 ===== */
const THEMES=[
  {name:"起笔",bg:"#0a0908",ink:"#3a3428",inkHot:"#6a5a40",wave:"#8a8070",glow:"#d4a843"},
  {name:"浓墨",bg:"#080c11",ink:"#2a3a4a",inkHot:"#4a6a80",wave:"#7aa0b8",glow:"#e8c878"},
  {name:"朱砂",bg:"#100a08",ink:"#4a2a20",inkHot:"#8a4838",wave:"#c09880",glow:"#f0d0a0"},
  {name:"花青",bg:"#080c11",ink:"#2a3a4a",inkHot:"#4a7a8a",wave:"#80c0d0",glow:"#e8d0a0"},
  {name:"焦墨",bg:"#0b0907",ink:"#3a3020",inkHot:"#7a5a30",wave:"#c0a878",glow:"#ffd890"},
];
const BELL_RADIUS_TILES=5.5,BELL_HOLD=2.4,BELL_FADE=4.8;
/* ===== 迷宫生成（递归回溯） ===== */
function genMaze(cols,rows,seed,loopCount=0,roomCount=0){
  let s=seed;
  const rnd=()=>(s=(s*9301+49297)%233280)/233280;
  const g=Array.from({length:rows},()=>Array(cols).fill("#"));
  const stack=[[1,1]];g[1][1]=".";
  const dirs=[[0,-2],[0,2],[-2,0],[2,0]];
  while(stack.length){
    const[x,y]=stack[stack.length-1];const opts=[];
    for(const[dx,dy]of dirs){
      const nx=x+dx,ny=y+dy;
      if(nx>0&&nx<cols-1&&ny>0&&ny<rows-1&&g[ny][nx]==="#")opts.push([dx,dy,nx,ny]);
    }
    if(opts.length){
      const[dx,dy,nx,ny]=opts[Math.floor(rnd()*opts.length)];
      g[y+dy/2][x+dx/2]=".";g[ny][nx]=".";stack.push([nx,ny]);
    }else stack.pop();
  }
  // 把部分死路编织成环路。追逐时必须至少有第二条逃生路线。
  const dead=[];
  for(let y=1;y<rows-1;y+=2)for(let x=1;x<cols-1;x+=2){
    if(g[y][x]!==".")continue;
    let degree=0;
    for(const[dx,dy]of dirs)if(g[y+dy/2][x+dx/2]!=="#")degree++;
    if(degree===1)dead.push([x,y]);
  }
  for(let i=dead.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[dead[i],dead[j]]=[dead[j],dead[i]];}
  let opened=0;
  for(const[x,y]of dead){
    const choices=[];
    for(const[dx,dy]of dirs){
      const nx=x+dx,ny=y+dy,mx=x+dx/2,my=y+dy/2;
      if(nx>0&&nx<cols-1&&ny>0&&ny<rows-1&&g[ny][nx]!=="#"&&g[my][mx]==="#")choices.push([mx,my]);
    }
    if(choices.length){const[mx,my]=choices[Math.floor(rnd()*choices.length)];g[my][mx]=".";opened++;}
    if(opened>=loopCount)break;
  }
  // 少量三乘三“墨池”给玩家观察、转向和绕过敌人的空间。
  const centers=[];
  for(let y=3;y<rows-3;y+=2)for(let x=3;x<cols-3;x+=2)if(g[y][x]!=="#")centers.push([x,y]);
  for(let i=centers.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[centers[i],centers[j]]=[centers[j],centers[i]];}
  const carved=[];
  for(const[x,y]of centers){
    if(carved.some(([cx,cy])=>Math.hypot(cx-x,cy-y)<6))continue;
    for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)g[yy][xx]=".";
    carved.push([x,y]);
    if(carved.length>=roomCount)break;
  }
  return g;
}
/* ===== 装饰：孢子/铃铛/敌人/出口 ===== */
function decorate(g,sporeCount,bellPickup,seed){
  const rows=g.length,cols=g[0].length;
  const floors=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(g[y][x]===".")floors.push([x,y]);
  // BFS 距离
  const dist={"1,1":0};const q=[[1,1]];
  while(q.length){
    const[x,y]=q.shift();
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=nx+","+ny;
      if(nx>=0&&nx<cols&&ny>=0&&ny<rows&&g[ny][nx]!=="#"&&!(k in dist)){
        dist[k]=dist[x+","+y]+1;q.push([nx,ny]);
      }
    }
  }
  let ex=1,ey=1,ed=0;
  for(const k in dist){if(dist[k]>ed){ed=dist[k];ex=+k.split(",")[0];ey=+k.split(",")[1];}}
  g[ey][ex]="E";g[1][1]="P";
  const far=floors.filter(([x,y])=>dist[x+","+y]>7&&(x!==ex||y!==ey));
  let sh=seed*7+3;
  const rnd2=()=>(sh=(sh*9301+49297)%233280)/233280;
  for(let i=far.length-1;i>0;i--){const j=Math.floor(rnd2()*(i+1));[far[i],far[j]]=[far[j],far[i]];}
  if(far.length<sporeCount+bellPickup)throw new Error("关卡可用通道不足");
  // 最远点采样：目标分散到不同区域，避免全部挤在同一条支路。
  const chosen=[],need=sporeCount+bellPickup;
  while(chosen.length<need&&far.length){
    let best=0,bestScore=-Infinity;
    for(let i=0;i<far.length;i++){
      const[x,y]=far[i];
      const separation=chosen.length?Math.min(...chosen.map(([cx,cy])=>Math.abs(cx-x)+Math.abs(cy-y))):dist[x+","+y];
      const score=separation*10+dist[x+","+y]*.15+rnd2();
      if(score>bestScore){bestScore=score;best=i;}
    }
    chosen.push(far.splice(best,1)[0]);
  }
  for(const[x,y]of chosen.slice(0,sporeCount))g[y][x]="*";
  for(const[x,y]of chosen.slice(sporeCount,need))g[y][x]="B";
  return g;
}
function validateMaze(g,expectedSpores){
  const h=g.length,w=g[0].length,seen=new Set(["1,1"]),queue=[[1,1]];
  let spores=0,exit=0;
  if(g[1][1]!=="P")throw new Error("玩家起点无效");
  for(let head=0;head<queue.length;head++){
    const[x,y]=queue[head],cell=g[y][x];
    if(cell==="*")spores++;
    if(cell==="E")exit++;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=nx+","+ny;
      if(nx<0||ny<0||nx>=w||ny>=h||g[ny][nx]==="#"||seen.has(k))continue;
      seen.add(k);queue.push([nx,ny]);
    }
  }
  if(spores!==expectedSpores||exit!==1)throw new Error("迷宫目标不可达");
  return true;
}
/* ===== 关卡 ===== */
const LEVELS=[
  {cols:15,rows:11,seed:11,spore:5,bellPickup:1,bells:3,patrol:0,listener:0,loops:2,rooms:1},
  {cols:19,rows:13,seed:22,spore:7,bellPickup:2,bells:3,patrol:1,listener:0,loops:4,rooms:1},
  {cols:21,rows:15,seed:33,spore:9,bellPickup:2,bells:3,patrol:1,listener:1,loops:6,rooms:2},
  {cols:23,rows:17,seed:44,spore:11,bellPickup:3,bells:4,patrol:1,listener:2,loops:8,rooms:2},
  {cols:25,rows:19,seed:55,spore:13,bellPickup:3,bells:4,patrol:2,listener:2,loops:10,rooms:3},
];
/* ===== 画布 ===== */
const canvas=document.getElementById("stage");
const ctx=canvas.getContext("2d");
let DPR=1,VW=0,VH=0,TILE=40;
function resize(){
  DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  VW=window.innerWidth;VH=window.innerHeight;
  canvas.width=VW*DPR;canvas.height=VH*DPR;
  canvas.style.width=VW+"px";canvas.style.height=VH+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(!window.gameReady){fitTile();return;}
  if(!state.grid.length){fitTile();return;}
  const oldTile=TILE;fitTile();
  if(Math.abs(oldTile-TILE)<.01)return;
  const ratio=TILE/oldTile,xy=o=>{if(!o)return;o.x*=ratio;o.y*=ratio;};
  xy(state.player);state.player.vx*=ratio;state.player.vy*=ratio;
  state.player.r=Math.max(11,Math.min(16,TILE*.25));
  for(const t of state.player.trail)xy(t);
  xy(state.exit);
  for(const list of [state.spores,state.bells,state.plates,state.portals,state.clearings,state.decoyStones,state.floaters])for(const o of list)xy(o);
  for(const o of state.decoys){xy(o);o.vx*=ratio;o.vy*=ratio;}
  for(const o of state.particles){xy(o);o.vx*=ratio;o.vy*=ratio;}
  for(const w of state.waves){xy(w);w.r*=ratio;w.maxR*=ratio;}
  for(const e of state.enemies){
    xy(e);for(const k of ["wx","tx","homeX"])if(Number.isFinite(e[k]))e[k]*=ratio;
    for(const k of ["wy","ty","homeY"])if(Number.isFinite(e[k]))e[k]*=ratio;
    if(Number.isFinite(e.vx))e.vx*=ratio;if(Number.isFinite(e.vy))e.vy*=ratio;
  }
  state.camX*=ratio;state.camY*=ratio;
}
function fitTile(){TILE=Math.max(28,Math.min(60,VW/9,VH/10));}
window.addEventListener("resize",resize);resize();
/* ===== 精灵 ===== */
const ART={
  player:"assets/player-v2.png",spore:"assets/spore-v2.png",
  bell:"assets/bell-v2.png",ghost:"assets/ghost-v2.png",
  bg:"assets/ink-bg-v2.png",panel:"assets/panel-v2.png",
  portal:"assets/portal-v2.png",plate:"assets/plate-v2.png",
  rock:"assets/rock-v2.png"
};
document.documentElement.style.setProperty("--ink-bg",`url("${ART.bg}")`);
document.documentElement.style.setProperty("--paper-panel",`url("${ART.panel}")`);
const ASSET_TOTAL=Object.keys(ART).length,assetRecords=[];
const loadingStarted=Date.now();
let assetsReady=false,loadingRevealQueued=false;
function updateLoadingProgress(){
  const done=assetRecords.filter(r=>r.status!=="loading").length;
  const failed=assetRecords.filter(r=>r.status==="failed").length;
  const pct=Math.min(100,Math.round(done/ASSET_TOTAL*100));
  const phase=done<3?"唤醒朱砂墨灵":done<6?"晕开洞壁墨色":done<ASSET_TOTAL?"摆好铃石机关":"画卷已经醒来";
  document.getElementById("loadingFill").style.width=pct+"%";
  document.getElementById("loadingPct").textContent=pct+"%";
  document.getElementById("loadingStep").textContent=`${phase} · ${done} / ${ASSET_TOTAL}`;
  if(done<ASSET_TOTAL)return;
  if(failed){
    document.getElementById("loadingLine").textContent=`有 ${failed} 件画材未能载入，请重新尝试`;
    document.getElementById("reloadAssetsBtn").hidden=false;
    return;
  }
  assetsReady=true;
  document.getElementById("loadingLine").textContent="画卷已醒，正在展开";
  if(!loadingRevealQueued){
    loadingRevealQueued=true;
    const wait=Math.max(120,900-(Date.now()-loadingStarted));
    setTimeout(revealMainMenu,wait);
  }
}
function revealMainMenu(){
  if(!assetsReady)return;
  document.body.classList.remove("loading");
  document.body.classList.add("menu-ready");
  document.getElementById("loadingScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
  document.getElementById("startBtn").disabled=false;
}
function loadImg(p,full=false){
  const im=new Image();
  const record={image:im,path:p,status:"loading"};
  assetRecords.push(record);
  im.onload=()=>{
    if(!full){
      try{
        const cv=document.createElement("canvas");cv.width=im.naturalWidth;cv.height=im.naturalHeight;
        const c=cv.getContext("2d",{willReadFrequently:true});c.drawImage(im,0,0);
        const data=c.getImageData(0,0,cv.width,cv.height).data;
        let x0=cv.width,y0=cv.height,x1=0,y1=0;
        for(let y=0;y<cv.height;y+=2)for(let x=0;x<cv.width;x+=2){
          if(data[(y*cv.width+x)*4+3]>12){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
        }
        im.crop=x1>x0&&y1>y0?[x0,y0,x1-x0+2,y1-y0+2]:[0,0,cv.width,cv.height];
      }catch(e){
        im.crop=[0,0,im.naturalWidth,im.naturalHeight];
      }
    }
    record.status="ready";updateLoadingProgress();
  };
  im.onerror=()=>{record.status="failed";updateLoadingProgress();};
  im.src=p;
  return im;
}
function drawSprite(im,x,y,size){
  if(!im.complete||!im.naturalWidth)return;
  const [sx,sy,sw,sh]=im.crop||[0,0,im.naturalWidth,im.naturalHeight];
  const scale=size/Math.max(sw,sh),w=sw*scale,h=sh*scale;
  ctx.drawImage(im,sx,sy,sw,sh,x-w/2,y-h/2,w,h);
}
function drawInkSpirit(im,size,phase,motion){
  if(!im.complete||!im.naturalWidth)return false;
  const [sx,sy,sw,sh]=im.crop||[0,0,im.naturalWidth,im.naturalHeight];
  const scale=size/Math.max(sw,sh),w=sw*scale,h=sh*scale;
  const cut=sw*.4,overlap=sw*.035,pivot=-w/2+cut*scale;
  // 手绘素材分成头与墨尾两层，尾部独立摆动，接缝由头部覆盖。
  ctx.save();ctx.translate(pivot,0);
  ctx.rotate(Math.sin(phase)*(.07+.22*motion));
  ctx.drawImage(im,sx+cut-overlap,sy,sw-cut+overlap,sh,
    -overlap*scale,-h/2,(sw-cut+overlap)*scale,h);
  ctx.restore();
  ctx.drawImage(im,sx,sy,cut+overlap,sh,-w/2,-h/2,(cut+overlap)*scale,h);
  return true;
}
const spr={
  player:loadImg(ART.player),
  spore:loadImg(ART.spore),
  bell:loadImg(ART.bell),
  ghost:loadImg(ART.ghost),
  bg:loadImg(ART.bg,true),
  panel:loadImg(ART.panel,true),
  portal:loadImg(ART.portal),
  plate:loadImg(ART.plate),
  rock:loadImg(ART.rock),
};
document.getElementById("reloadAssetsBtn").addEventListener("click",()=>window.location.reload());
/* ===== 音频：一次解锁，音乐和音效分别混音 ===== */
let actx=null,masterGain=null,musicGain=null,sfxGain=null,bgmOn=false,muted=false;
let bgmTimer=null,bgmStep=0,bgmDrones=[];
function audioStatus(message){
  document.getElementById("muteBtn").textContent=muted?"声关":"声开";
  document.getElementById("pauseMuteBtn").textContent=muted?"开 声":"静 音";
  const status=document.getElementById("audioStatus");
  if(status)status.textContent=message||
    (muted?"当前已静音":actx&&actx.state==="running"?"声音与水墨配乐已开启":"点击落笔开启声音");
}
function audioInit(){
  if(muted){audioStatus();return false;}
  try{
    if(!actx){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio){audioStatus("此浏览器不支持网页音频");return false;}
      actx=new Audio();
      masterGain=actx.createGain();masterGain.gain.value=.82;
      musicGain=actx.createGain();musicGain.gain.value=.72;
      sfxGain=actx.createGain();sfxGain.gain.value=.88;
      musicGain.connect(masterGain);sfxGain.connect(masterGain);
      masterGain.connect(actx.destination);
    }
    if(actx.state!=="running"){
      const ready=actx.resume();
      if(ready&&ready.then)ready.then(()=>audioStatus()).catch(()=>audioStatus("声音未启动，请再次点击落笔"));
    }
    if(!bgmOn){bgmOn=true;startBGM();}
    audioStatus(actx.state==="running"?"声音已开启":"正在开启声音…");
    return true;
  }catch(e){audioStatus("声音未启动，请检查设备或浏览器权限");return false;}
}
function tone(freq,dur,type="sine",vol=.12,delay=0,slide=null,bus="sfx"){
  if(!actx||muted)return;
  const t=actx.currentTime+delay;
  const o=actx.createOscillator(),g=actx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(1,slide),t+dur);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+.018);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(bus==="music"?musicGain:sfxGain);o.start(t);o.stop(t+dur+.05);
}
function noiseBurst(dur=.15,vol=.08){
  if(!actx||muted)return;
  const n=Math.ceil(actx.sampleRate*dur),buf=actx.createBuffer(1,n,actx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  const src=actx.createBufferSource(),g=actx.createGain();
  g.gain.setValueAtTime(vol,actx.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+dur);
  src.buffer=buf;src.connect(g).connect(sfxGain);src.start();
}
const sfx={
  start(){[293.66,392,523.25,659.25].forEach((f,i)=>tone(f,.5,"triangle",.11,i*.105));},
  ping(){tone(587.3,.34,"sine",.09,0,392);tone(880,.42,"sine",.032,.07,587);tone(1174.6,.34,"sine",.018,.14,784);},
  dash(){noiseBurst(.11,.035);tone(196,.25,"triangle",.085,0,392);tone(293.7,.22,"sine",.045,.045,587);},
  bell(){[440,660,880,1320].forEach((f,i)=>{tone(f,1.8,"sine",.14/(1+i*.5),i*.025);tone(f*.5,1.25,"triangle",.04/(1+i),.09+i*.02);});},
  spore(c){const scale=[659.3,740,880,987.8,1174.7,1318.5],b=scale[Math.min(c-1,scale.length-1)];tone(b,.24,"triangle",.1);tone(b*1.5,.38,"sine",.055,.06);},
  bellPick(){tone(523.3,.36,"triangle",.1);tone(784,.55,"sine",.075,.09);tone(1046.5,.45,"sine",.035,.18);},
  win(){[392,523.3,659.3,784,1046.5].forEach((f,i)=>tone(f,.75,"triangle",.11,i*.14));},
  bump(){tone(110,.12,"triangle",.04,0,82);noiseBurst(.05,.018);},
  hurt(){tone(220,.3,"triangle",.085,0,92);tone(146.8,.38,"sine",.055,.035,73.4);noiseBurst(.14,.035);},
  decoy(){tone(493.9,.22,"sine",.065,0,329.6);tone(740,.3,"sine",.035,.08,493.9);},
  enemyAlert(){tone(293.7,.28,"triangle",.065,0,196);tone(392,.2,"sine",.035,.06,261.6);},
  enemyBreak(){noiseBurst(.2,.055);[392,587.3,880,1174.6].forEach((f,i)=>tone(f,.38,"triangle",.085/(1+i*.25),i*.055,f*1.25));},
};
function startBGM(){
  if(!actx||bgmTimer)return;
  [73.42,146.83].forEach((f,i)=>{
    const o=actx.createOscillator(),g=actx.createGain();
    o.type="sine";o.frequency.value=f;g.gain.value=i===0?.055:.025;
    o.connect(g).connect(musicGain);o.start();bgmDrones.push(o);
  });
  bgmTimer=setInterval(musicStepTick,430);
}
function musicStepTick(){
  if(!actx||muted||!state.running||state.paused)return;
  const roots=[146.83,130.81,164.81,146.83,110],root=roots[state.level%roots.length];
  const ratios=[1,1.125,1.25,1.5,1.6875,2],patterns=[0,2,4,2,1,3,5,3];
  const step=bgmStep++%patterns.length,f=root*2*ratios[patterns[step]];
  if(step%2===0)tone(root,.72,"sine",.072,0,root*.997,"music");
  tone(f,.48,"triangle",.08,0,f*.997,"music");
  tone(f*2,.72,"sine",.022,.085,f*1.98,"music");
  if(step===3||step===7)tone(root*ratios[state.level%ratios.length]*3,.95,"sine",.034,.16,null,"music");
  for(let i=0;i<bgmDrones.length;i++)bgmDrones[i].frequency.setTargetAtTime(root*(i?1:.5),actx.currentTime,.45);
}
function toggleMute(){
  muted=!muted;
  if(!muted)audioInit();
  if(masterGain)masterGain.gain.setTargetAtTime(muted?0:.82,actx.currentTime,.025);
  audioStatus();
  if(!muted)sfx.bellPick();
}
/* ===== 输入 ===== */
const keys={};
window.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();keys[k]=true;
  if(k===" "){e.preventDefault();if(!e.repeat)doBell();}
  if(k==="shift"&&!e.repeat)doDash();
  if(k==="q"&&!e.repeat)doDecoy();
  if(k.startsWith("arrow"))e.preventDefault();
});
window.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
window.addEventListener("blur",()=>{for(const k in keys)keys[k]=false;jEnd();if(state.running&&!state.paused)togglePause(true);});
// 触摸检测：避免桌面 Chrome 仅暴露 touch 事件时误显示虚拟摇杆。
const coarsePointer=window.matchMedia&&window.matchMedia("(pointer: coarse)").matches;
if(coarsePointer||navigator.maxTouchPoints>0)document.body.classList.add("touch");
/* ===== 摇杆 ===== */
const joyEl=document.getElementById("joy"),joyKnob=document.getElementById("joyKnob");
let joyOn=false,jx=0,jy=0,jid=null;
function jStart(e){jid=e.pointerId;joyOn=true;joyEl.setPointerCapture(e.pointerId);jMove(e);e.preventDefault();}
function jMove(e){
  if(!joyOn||e.pointerId!==jid)return;
  const r=joyEl.getBoundingClientRect();
  let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
  const max=38,l=Math.hypot(dx,dy);
  if(l>max){dx=dx/l*max;dy=dy/l*max;}
  jx=dx/max;jy=dy/max;
  joyKnob.style.transform=`translate(calc(-50%+${dx}px),calc(-50%+${dy}px))`;
  e.preventDefault();
}
function jEnd(e){if(e&&e.pointerId!==jid)return;joyOn=false;jid=null;jx=jy=0;joyKnob.style.transform="translate(-50%,-50%)";}
joyEl.addEventListener("pointerdown",jStart);
joyEl.addEventListener("pointermove",jMove);
joyEl.addEventListener("pointerup",jEnd);
joyEl.addEventListener("pointercancel",jEnd);
/* ===== 动作 ===== */
function doDash(){
  if(!state.running||state.paused||state.dashCD>0||state.dashT>0)return;
  let dx=0,dy=0;
  if(keys["w"]||keys["arrowup"])dy-=1;
  if(keys["s"]||keys["arrowdown"])dy+=1;
  if(keys["a"]||keys["arrowleft"])dx-=1;
  if(keys["d"]||keys["arrowright"])dx+=1;
  dx+=jx;dy+=jy;
  const l=Math.hypot(dx,dy);
  if(l<.1){// 朝当前速度方向
    dx=state.player.vx;dy=state.player.vy;
    if(Math.hypot(dx,dy)<10)dy=-1;
  }
  const nl=Math.hypot(dx,dy);
  state.player.vx=dx/nl*650;state.player.vy=dy/nl*650;
  state.dashT=.18;state.dashCD=state.dashMaxCD;
  state.waves.push({x:state.player.x,y:state.player.y,r:0,maxR:TILE*8,kind:"dash"});
  sfx.dash();state.shake=Math.max(state.shake,4);state.flash=Math.max(state.flash,.13);state.flashColor="#c83828";
  // 冲刺粒子
  for(let i=0;i<12;i++){
    const a=Math.random()*Math.PI*2;
    state.particles.push({x:state.player.x,y:state.player.y,vx:Math.cos(a)*60,vy:Math.sin(a)*60,t:0,life:.5,color:"#c83828",r:2});
  }
}
function doBell(){
  if(!state.running||state.paused)return;
  if(state.bellsLeft<=0){sfx.bump();return;}
  state.bellsLeft--;
  document.getElementById("bellLeft").textContent=state.bellsLeft;
  state.waves.push({x:state.player.x,y:state.player.y,r:0,maxR:TILE*BELL_RADIUS_TILES,kind:"bell"});
  sfx.bell();state.shake=Math.max(state.shake,7);state.freeze=.04;state.flash=.62;state.flashColor="#d4a843";
  for(let i=0;i<26;i++){
    const a=Math.random()*Math.PI*2,sp=50+Math.random()*120;
    state.particles.push({x:state.player.x,y:state.player.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:.9,color:"#d4a843",r:2.5});
  }
}
function doDecoy(){
  if(!state.running||state.paused||state.decoysLeft<=0)return;
  state.decoysLeft--;
  document.getElementById("decoyLeft").textContent=state.decoysLeft;
  // 朝玩家前方投出
  let dx=state.player.vx,dy=state.player.vy;
  const l=Math.hypot(dx,dy);
  if(l<10){dx=Math.cos(state.player.lastAng||0);dy=Math.sin(state.player.lastAng||0);}else{dx/=l;dy/=l;}
  state.decoys.push({x:state.player.x,y:state.player.y,vx:dx*230,vy:dy*230,t:0,r:3});
  sfx.decoy();
}
/* ===== 按钮绑定 ===== */
function bindBtn(id,fn){
  const el=document.getElementById(id);
  el.addEventListener("pointerdown",e=>{e.preventDefault();fn();});
}
bindBtn("dashBtn",doDash);
bindBtn("bellBtn",doBell);
bindBtn("decoyBtn",doDecoy);
document.getElementById("muteBtn").addEventListener("click",toggleMute);
/* ===== 状态 ===== */
const state={
  level:0,grid:[],cols:0,rows:0,
  player:{x:0,y:0,vx:0,vy:0,r:13,sx:1,sy:1,anim:0,trail:[]},
  spores:[],bells:[],exit:{x:0,y:0,open:false},
  enemies:[],waves:[],particles:[],floaters:[],decoys:[],decoyStones:[],
  plates:[],doors:[],portals:[],clearings:[],paused:false,
  wallGlow:new Map(),wallMark:new Map(),
  camX:0,camY:0,
  time:0,lastPing:0,
  hp:3,maxHp:3,hitT:0,
  bellsLeft:3,decoysLeft:2,
  dashCD:0,dashT:0,dashMaxCD:1.6,
  combo:0,comboT:0,shake:0,freeze:0,flash:0,flashColor:"#d4a843",
  running:false,theme:THEMES[0],
};
window.gameReady=true;
/* ===== 关卡加载 ===== */
function loadLevel(idx){
  fitTile();
  const L=LEVELS[idx];
  state.theme=THEMES[idx%THEMES.length];
  const g=decorate(genMaze(L.cols,L.rows,L.seed,L.loops,L.rooms),L.spore,L.bellPickup,L.seed);
  validateMaze(g,L.spore);
  state.grid=g;state.cols=L.cols;state.rows=L.rows;
  state.spores=[];state.bells=[];state.enemies=[];
  state.waves=[];state.particles=[];state.floaters=[];state.decoys=[];state.decoyStones=[];
  state.wallGlow.clear();state.wallMark.clear();
  state.plates=[];state.doors=[];state.portals=[];state.clearings=[];state.paused=false;
  state.player.trail=[];state.player.vx=0;state.player.vy=0;
  state.time=0;state.lastPing=0;
  state.bellsLeft=L.bells;state.decoysLeft=2;
  state.dashCD=0;state.dashT=0;
  state.combo=0;state.comboT=0;state.shake=0;state.freeze=0;state.flash=0;
  state.hitT=0;
  state.hp=state.maxHp;
  state.player.r=Math.max(11,Math.min(16,TILE*.25));
  state.player.sx=1;state.player.sy=1;state.player.lastAng=0;state.player.anim=0;
  for(let y=0;y<state.rows;y++){
    for(let x=0;x<state.cols;x++){
      const c=g[y][x],cx=x*TILE+TILE/2,cy=y*TILE+TILE/2;
      if(c==="P"){state.player.x=cx;state.player.y=cy;}
      else if(c==="*")state.spores.push({x:cx,y:cy,got:false,ph:Math.random()*6,visibleT:0});
      else if(c==="B")state.bells.push({x:cx,y:cy,got:false,visibleT:0});
      else if(c==="E"){state.exit.x=cx;state.exit.y=cy;state.exit.open=false;}
    }
  }
  // 敌人只出生在至少有两个出口的通道，并与起点保持图距离。
  const spawnDist=new Map([["1,1",0]]),spawnQ=[[1,1]];
  for(let head=0;head<spawnQ.length;head++){
    const[x,y]=spawnQ[head],d=spawnDist.get(x+","+y);
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=nx+","+ny;
      if(nx<0||ny<0||nx>=state.cols||ny>=state.rows||state.grid[ny][nx]==="#"||spawnDist.has(k))continue;
      spawnDist.set(k,d+1);spawnQ.push([nx,ny]);
    }
  }
  // 识别生成出的开阔墨池，作为地图地标与追逐转身空间。
  for(let y=2;y<state.rows-2;y++)for(let x=2;x<state.cols-2;x++){
    if(state.grid[y][x]==="#")continue;
    let open=0;
    for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(state.grid[yy][xx]!=="#")open++;
    if(open>=8&&state.clearings.every(c=>Math.hypot(c.gx-x,c.gy-y)>4))
      state.clearings.push({gx:x,gy:y,x:(x+.5)*TILE,y:(y+.5)*TILE,ph:Math.random()*6});
  }
  let spawnSeed=L.seed*31+idx*17+9;
  const spawnRnd=()=>(spawnSeed=(spawnSeed*9301+49297)%233280)/233280;
  const spawnSpots=[];
  for(let y=1;y<state.rows-1;y++)for(let x=1;x<state.cols-1;x++){
    if(state.grid[y][x]!=="."||(spawnDist.get(x+","+y)||0)<8)continue;
    let degree=0;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(state.grid[y+dy][x+dx]!=="#")degree++;
    if(degree>=2)spawnSpots.push([x,y]);
  }
  for(let i=spawnSpots.length-1;i>0;i--){const j=Math.floor(spawnRnd()*(i+1));[spawnSpots[i],spawnSpots[j]]=[spawnSpots[j],spawnSpots[i]];}
  let enemyId=0;
  const spawnEnemy=(type)=>{
    let pick=spawnSpots.findIndex(([x,y])=>state.enemies.every(e=>Math.hypot(e.x-(x+.5)*TILE,e.y-(y+.5)*TILE)>TILE*4));
    if(pick<0)pick=0;
    const spot=spawnSpots.splice(pick,1)[0];
    if(!spot)return;
    const[x,y]=spot,px=(x+.5)*TILE,py=(y+.5)*TILE,id=enemyId++;
    state.enemies.push({id,x:px,y:py,tx:px,ty:py,type,ph:spawnRnd()*6,
      mode:"patrol",modeT:0,stunT:0,luredT:0,visibleT:2,routeT:0,wx:px,wy:py,homeX:px,homeY:py,
      rngSeed:((L.seed+1)*1000003+(id+1)*9176)>>>0});
  };
  for(let i=0;i<L.patrol;i++)spawnEnemy("patrol");
  for(let i=0;i<L.listener;i++)spawnEnemy("listener");
  // === 机关生成（第2关起）===
  if(idx>=1){
    const open=[];
    for(let y=1;y<state.rows-1;y++)for(let x=1;x<state.cols-1;x++)
      if(state.grid[y][x]===".")open.push([x,y]);
    const far2=open.filter(([x,y])=>Math.hypot(x-1,y-1)>6);
    // 压板与石门构成可选择的捷径；墨石落在压板上也能触发。
    for(const[px,py]of far2.sort(()=>Math.random()-.5)){
      for(const[ox,oy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const wx=px+ox,wy=py+oy;
        if(wx>0&&wy>0&&wx<state.cols-1&&wy<state.rows-1&&state.grid[wy][wx]==="#"){
          const bx=wx+ox,by=wy+oy;
          if(bx>0&&by>0&&bx<state.cols-1&&by<state.rows-1&&state.grid[by][bx]==="."){
            state.plates.push({x:px*TILE+TILE/2,y:py*TILE+TILE/2,on:false});
            state.doors.push({gx:wx,gy:wy,open:false});
            state.grid[wy][wx]="D";
            break;
          }
        }
      }
      if(state.plates.length)break;
    }
    // 传送墨涡（成对）
    if(far2.length>10){
      const spots=far2.filter(([x,y])=>!state.plates.some(pl=>Math.hypot(pl.x-(x+.5)*TILE,pl.y-(y+.5)*TILE)<TILE));
      const a=spots.splice(Math.floor(Math.random()*spots.length),1)[0];
      const remote=spots.filter(q=>Math.hypot(a[0]-q[0],a[1]-q[1])>5);
      if(remote.length){
        const b=remote[Math.floor(Math.random()*remote.length)];
        state.portals.push(
          {x:a[0]*TILE+TILE/2,y:a[1]*TILE+TILE/2,cd:0},
          {x:b[0]*TILE+TILE/2,y:b[1]*TILE+TILE/2,cd:0});
      }
    }
  }
  // 相机
  const mw=state.cols*TILE,mh=state.rows*TILE;
  state.camX=mw<VW?(mw-VW)/2:Math.max(0,Math.min(mw-VW,state.player.x-VW/2));
  state.camY=mh<VH?(mh-VH)/2:Math.max(0,Math.min(mh-VH,state.player.y-VH/2));
  // 初始照亮玩家周围
  const pgx=Math.floor(state.player.x/TILE),pgy=Math.floor(state.player.y/TILE);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const gx=pgx+dx,gy=pgy+dy;
    if(gx>=0&&gy>=0&&gx<state.cols&&gy<state.rows&&state.grid[gy][gx]==="#")
      state.wallGlow.set(gx+","+gy,.6);
  }
  // HUD
  document.getElementById("lvNum").textContent=idx+1;
  document.getElementById("lvName").textContent=state.theme.name;
  document.getElementById("sporeAll").textContent=state.spores.length;
  document.getElementById("sporeGot").textContent=0;
  document.getElementById("bellLeft").textContent=state.bellsLeft;
  document.getElementById("decoyLeft").textContent=state.decoysLeft;
  document.getElementById("exitHint").textContent="留白未开";
  document.getElementById("dashCDFill").style.width="100%";
  document.getElementById("combo").classList.remove("show");
  updateHp();
}
function updateHp(){
  document.getElementById("hpDisp").textContent=
    "●".repeat(Math.max(0,state.hp))+"○".repeat(state.maxHp-state.hp);
}
/* ===== 墙体检测 ===== */
function isWall(px,py){
  const gx=Math.floor(px/TILE),gy=Math.floor(py/TILE);
  if(gx<0||gy<0||gx>=state.cols||gy>=state.rows)return true;
  const c=state.grid[gy][gx];
  if(c==="#")return true;
  if(c==="D"){const d=state.doors.find(d=>d.gx===gx&&d.gy===gy);return d?!d.open:true;}
  return false;
}
function circleWall(x,y,r){
  const minX=Math.floor((x-r)/TILE),maxX=Math.floor((x+r)/TILE);
  const minY=Math.floor((y-r)/TILE),maxY=Math.floor((y+r)/TILE);
  for(let gy=minY;gy<=maxY;gy++)for(let gx=minX;gx<=maxX;gx++){
    if(!isWall((gx+.5)*TILE,(gy+.5)*TILE))continue;
    const nearX=Math.max(gx*TILE,Math.min(x,(gx+1)*TILE));
    const nearY=Math.max(gy*TILE,Math.min(y,(gy+1)*TILE));
    if((x-nearX)**2+(y-nearY)**2<r*r)return true;
  }
  return false;
}
function circleTouchesCell(ent,gx,gy,fallbackR=8){
  const r=ent.r||fallbackR;
  const nearX=Math.max(gx*TILE,Math.min(ent.x,(gx+1)*TILE));
  const nearY=Math.max(gy*TILE,Math.min(ent.y,(gy+1)*TILE));
  return (ent.x-nearX)**2+(ent.y-nearY)**2<r*r;
}
function doorOccupied(d){
  return circleTouchesCell(state.player,d.gx,d.gy,state.player.r)||
    state.enemies.some(e=>!e.dead&&circleTouchesCell(e,d.gx,d.gy,8))||
    state.decoys.some(o=>circleTouchesCell(o,d.gx,d.gy,3))||
    state.decoyStones.some(o=>circleTouchesCell(o,d.gx,d.gy,4));
}
function moveCircle(ent,dt){
  const r=ent.r||9;
  let hit=false,hx=0,hy=0;
  const steps=Math.max(1,Math.ceil(Math.hypot(ent.vx*dt,ent.vy*dt)/Math.max(3,r*.7)));
  for(let i=0;i<steps;i++){
    const nx=ent.x+ent.vx*dt/steps;
    if(circleWall(nx,ent.y,r)){hit=true;hx=ent.vx;ent.vx=0;}else ent.x=nx;
    const ny=ent.y+ent.vy*dt/steps;
    if(circleWall(ent.x,ny,r)){hit=true;hy=ent.vy;ent.vy=0;}else ent.y=ny;
  }
  return{hit,hx,hy};
}
/* ===== 工具 ===== */
function hexA(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return`rgba(${r},${g},${b},${a})`;
}
function nextStepToward(sx,sy,tx,ty){
  const x0=Math.floor(sx/TILE),y0=Math.floor(sy/TILE);
  const x1=Math.floor(tx/TILE),y1=Math.floor(ty/TILE);
  if(x0===x1&&y0===y1)return [x1*TILE+TILE/2,y1*TILE+TILE/2];
  const w=state.cols,h=state.rows,start=y0*w+x0,goal=y1*w+x1;
  const prev=new Int32Array(w*h);prev.fill(-1);
  const queue=new Int32Array(w*h);let head=0,tail=0;
  queue[tail++]=start;prev[start]=start;
  while(head<tail){
    const v=queue[head++],x=v%w,y=Math.floor(v/w);
    if(v===goal)break;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,n=ny*w+nx;
      if(nx<0||ny<0||nx>=w||ny>=h||prev[n]!==-1||isWall((nx+.5)*TILE,(ny+.5)*TILE))continue;
      prev[n]=v;queue[tail++]=n;
    }
  }
  if(goal<0||goal>=prev.length||prev[goal]===-1)return null;
  let step=goal;
  while(prev[step]!==start)step=prev[step];
  return [(step%w+.5)*TILE,(Math.floor(step/w)+.5)*TILE];
}
function patrolStep(e){
  const gx=Math.floor(e.x/TILE),gy=Math.floor(e.y/TILE),opts=[];
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
    const x=gx+dx,y=gy+dy;
    if(!isWall((x+.5)*TILE,(y+.5)*TILE))opts.push([x,y]);
  }
  if(!opts.length)return;
  const better=opts.filter(([x,y])=>x!==e.prevGX||y!==e.prevGY);
  // 每只墨影保留自己的随机序列，巡逻自然变化且同一关卡可稳定复现。
  if(!Number.isFinite(e.rngSeed))e.rngSeed=(((e.id||1)+1)*2654435761)>>>0;
  e.rngSeed=(Math.imul(e.rngSeed,1664525)+1013904223)>>>0;
  const choices=better.length?better:opts;
  const [x,y]=choices[Math.floor(e.rngSeed/4294967296*choices.length)];
  e.prevGX=gx;e.prevGY=gy;
  e.wx=(x+.5)*TILE;e.wy=(y+.5)*TILE;
}
function clearSight(x0,y0,x1,y1){
  const d=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(d/(TILE*.25)));
  for(let i=1;i<steps;i++)if(isWall(x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps))return false;
  return true;
}
function setEnemyMode(e,mode,duration=0,tx=e.x,ty=e.y){
  const changed=e.mode!==mode;
  e.mode=mode;e.modeT=duration;e.tx=tx;e.ty=ty;e.routeT=0;
  if(mode==="chase"&&changed){
    sfx.enemyAlert();state.shake=Math.max(state.shake,2.5);
    state.floaters.push({x:e.x,y:e.y-22,text:"！",t:0,life:.7});
  }
}
function stunEnemy(e,duration=3.2){
  const fresh=e.mode!=="stunned";
  e.mode="stunned";e.stunT=Math.max(e.stunT||0,duration);e.visibleT=Math.max(e.visibleT||0,duration+.7);
  e.vx=e.vy=0;
  if(fresh){
    state.floaters.push({x:e.x,y:e.y-20,text:"定",t:0,life:.9});
    for(let k=0;k<10;k++){const a=Math.random()*Math.PI*2;
      state.particles.push({x:e.x,y:e.y,vx:Math.cos(a)*70,vy:Math.sin(a)*70,t:0,life:.55,color:"#d4a843",r:2});}
  }
}
function banishEnemy(e){
  e.dead=true;sfx.enemyBreak();state.shake=Math.max(state.shake,6);state.freeze=Math.max(state.freeze,.045);
  state.floaters.push({x:e.x,y:e.y-24,text:"破影",t:0,life:1.1});
  for(let k=0;k<24;k++){const a=Math.random()*Math.PI*2,sp=55+Math.random()*150;
    state.particles.push({x:e.x,y:e.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:.8,color:k%3?"#161311":"#c83828",r:2.8});}
}
/* ===== 渲染 ===== */
function update(dt){
  if(!state.running||state.paused||dt<=0)return;
  if(state.freeze>0){state.freeze-=dt;return;}
  state.time+=dt;
  if(state.flash>0)state.flash=Math.max(0,state.flash-dt*1.7);
  for(const o of [...state.spores,...state.bells])o.visibleT=Math.max(0,(o.visibleT||0)-dt);
  for(const[key,until]of state.wallMark)if(until<=state.time)state.wallMark.delete(key);
  if(state.shake>0)state.shake=Math.max(0,state.shake-dt*18);
  if(state.hitT>0)state.hitT-=dt;
  if(state.dashCD>0)state.dashCD-=dt;
  if(state.dashT>0)state.dashT-=dt;
  // dash CD UI
  document.getElementById("dashCDFill").style.width=
    Math.min(100,(1-state.dashCD/state.dashMaxCD)*100)+"%";
  // combo 超时
  if(state.comboT>0){state.comboT-=dt;if(state.comboT<=0){state.combo=0;document.getElementById("combo").classList.remove("show");}}

  /* --- 玩家输入 --- */
  let ix=0,iy=0;
  if(keys["w"]||keys["arrowup"])iy-=1;
  if(keys["s"]||keys["arrowdown"])iy+=1;
  if(keys["a"]||keys["arrowleft"])ix-=1;
  if(keys["d"]||keys["arrowright"])ix+=1;
  ix+=jx;iy+=jy;
  const il=Math.hypot(ix,iy);
  if(il>1){ix/=il;iy/=il;}

  const p=state.player;
  if(state.exit.open){
    const a=Math.atan2(state.exit.y-p.y,state.exit.x-p.x);
    const arrows=["→","↘","↓","↙","←","↖","↑","↗"];
    document.getElementById("exitHint").textContent="留白 "+arrows[(Math.round(a/(Math.PI/4))+8)%8];
  }
  if(state.dashT<=0){
    // 加速度移动
    const accel=1900,maxSpd=240;
    p.vx+=ix*accel*dt;p.vy+=iy*accel*dt;
    // 摩擦
    if(il<.1){p.vx*=Math.pow(.001,dt);p.vy*=Math.pow(.001,dt);}
    // 限速
    const sp=Math.hypot(p.vx,p.vy);
    if(sp>maxSpd){p.vx=p.vx/sp*maxSpd;p.vy=p.vy/sp*maxSpd;}
  }
  const wasMoving=Math.hypot(p.vx,p.vy);
  const res=moveCircle(p,dt);
  if(res.hit){
    state.shake=Math.max(state.shake,2);
    if(Math.random()<.3)sfx.bump();
    // 撞墙挤压
    if(res.hx)p.sx=.6;
    if(res.hy)p.sy=.6;
  }
  // squash & stretch 恢复
  p.sx+=(1-p.sx)*dt*10;p.sy+=(1-p.sy)*dt*10;
  // 移动时拉伸
  const cur=Math.hypot(p.vx,p.vy);
  p.anim+=dt*(cur>20?Math.min(16,5+cur*.042):2.2);
  if(cur>50&&state.dashT<=0){
    const stretch=Math.min(.25,cur/800);
    const ang=Math.atan2(p.vy,p.vx);
    // 简化：朝移动方向轻微拉伸
    p.sx=1+stretch*Math.abs(Math.cos(ang));
    p.sy=1+stretch*Math.abs(Math.sin(ang));
  }
  // 留痕
  if(cur>20){
    p.trail.push({x:p.x,y:p.y,t:state.time});
    if(p.trail.length>45)p.trail.shift();
    // 自动 ping
    if(state.time-state.lastPing>1.1){
      state.lastPing=state.time;
      state.waves.push({x:p.x,y:p.y,r:0,maxR:TILE*6,kind:"ping"});
      sfx.ping();
    }
  }

  /* --- 波传播 --- */
  for(let i=state.waves.length-1;i>=0;i--){
    const w=state.waves[i];
    const wsp=w.kind==="bell"?320:w.kind==="dash"?380:260;
    w.r+=wsp*dt;
    const gx0=Math.floor(w.x/TILE),gy0=Math.floor(w.y/TILE);
    const rr=Math.ceil(w.r/TILE);
    for(let ty=gy0-rr;ty<=gy0+rr;ty++){
      for(let tx=gx0-rr;tx<=gx0+rr;tx++){
        if(tx<0||ty<0||tx>=state.cols||ty>=state.rows)continue;
        if(state.grid[ty][tx]!=="#")continue;
        const cx=tx*TILE+TILE/2,cy=ty*TILE+TILE/2;
        const d=Math.hypot(cx-w.x,cy-w.y);
        if(Math.abs(d-w.r)<TILE*.75){
          if(w.kind==="bell"){
            state.wallMark.set(tx+","+ty,state.time+BELL_HOLD+BELL_FADE);
            state.wallGlow.set(tx+","+ty,state.time+.65);
          }else{
            state.wallGlow.set(tx+","+ty,state.time);
          }
        }
      }
    }
    // 声波经过墨影时先揭示其位置，再根据波的性质改变行为。
    if(!w.hitEnemies)w.hitEnemies=new Set();
    for(const e of state.enemies){
      if(e.dead||w.hitEnemies.has(e.id))continue;
      const d=Math.hypot(e.x-w.x,e.y-w.y);
      if(d>=w.r+TILE||d<=w.r-TILE*1.5)continue;
      w.hitEnemies.add(e.id);e.visibleT=Math.max(e.visibleT||0,1.8);
      if(w.kind==="bell")stunEnemy(e,3.2);
      else if(w.kind==="decoy"){
        e.luredT=4.5;setEnemyMode(e,"investigate",4.5,w.x,w.y);
      }else if(e.type==="listener"){
        if(e.mode!=="chase"&&e.mode!=="stunned")setEnemyMode(e,"investigate",w.kind==="dash"?4.2:3.2,w.x,w.y);
      }else if(w.kind==="dash"&&e.mode!=="stunned")setEnemyMode(e,"investigate",2.8,w.x,w.y);
    }
    for(const o of [...state.spores,...state.bells]){
      if(o.got)continue;
      const d=Math.hypot(o.x-w.x,o.y-w.y);
      if(d<w.r+TILE&&d>w.r-TILE*1.5)o.visibleT=Math.max(o.visibleT||0,w.kind==="bell"?4.5:2.2);
    }
    if(w.r>w.maxR)state.waves.splice(i,1);
  }

  /* --- 敌人 AI --- */
  for(const e of state.enemies){
    if(e.dead)continue;
    e.ph=(e.ph||0)+dt;e.mode=e.mode||"patrol";e.routeT=(e.routeT||0)-dt;
    e.visibleT=Math.max(0,(e.visibleT||0)-dt);e.luredT=Math.max(0,(e.luredT||0)-dt);
    e.modeT=Math.max(0,(e.modeT||0)-dt);
    const playerDist=Math.hypot(p.x-e.x,p.y-e.y);
    if(e.mode==="stunned"){
      e.stunT=Math.max(0,(e.stunT||0)-dt);e.vx=e.vy=0;
      if(e.stunT<=0)setEnemyMode(e,"search",1.5,e.x,e.y);
    }else{
      // 只有近距离且视线畅通才会从“最后声源”升级为追击，避免隔墙透视。
      const seesPlayer=e.luredT<=0&&playerDist<TILE*(e.type==="listener"?3.5:2.3)&&clearSight(e.x,e.y,p.x,p.y);
      if(seesPlayer&&e.mode!=="chase")setEnemyMode(e,"chase",2.4,p.x,p.y);
      if(e.mode==="chase"){
        if(seesPlayer){e.tx=p.x;e.ty=p.y;e.modeT=Math.max(e.modeT,1.1);}
        if(e.modeT<=0)setEnemyMode(e,"search",1.8,e.tx,e.ty);
      }else if(e.mode==="investigate"){
        if(e.modeT<=0||Math.hypot(e.x-e.tx,e.y-e.ty)<TILE*.45)setEnemyMode(e,"search",1.7,e.tx,e.ty);
      }else if(e.mode==="search"){
        if(e.modeT<=0)setEnemyMode(e,"patrol",0,e.homeX||e.x,e.homeY||e.y);
      }
      if(e.mode==="chase"||e.mode==="investigate"){
        if(e.routeT<=0){
          const step=nextStepToward(e.x,e.y,e.tx,e.ty);
          if(step){e.wx=step[0];e.wy=step[1];}
          e.routeT=e.mode==="chase"?.12:.22;
        }
      }else if(Math.hypot(e.x-(e.wx||e.x),e.y-(e.wy||e.y))<3)patrolStep(e);
      const dx=(e.wx||e.x)-e.x,dy=(e.wy||e.y)-e.y,d=Math.hypot(dx,dy);
      if(d>1){
        const speed=e.mode==="chase"?150:e.mode==="investigate"?96:52+state.level*6;
        const step=Math.min(d,speed*dt);
        e.vx=dx/d*step/dt;e.vy=dy/d*step/dt;
        const body={x:e.x,y:e.y,vx:e.vx,vy:e.vy,r:8};
        const moved=moveCircle(body,dt);e.x=body.x;e.y=body.y;
        if(moved.hit)e.routeT=0;
      }
    }
    const contact=Math.hypot(e.x-p.x,e.y-p.y)<p.r+11;
    if(contact&&state.dashT>0){
      if(e.mode==="stunned")banishEnemy(e);
      else{
        stunEnemy(e,.85);e.x-=p.vx*.04;e.y-=p.vy*.04;
        state.floaters.push({x:e.x,y:e.y-18,text:"穿影",t:0,life:.7});
      }
      continue;
    }
    if(contact&&e.mode!=="stunned"&&state.hitT<=0){
      state.hp--;state.hitT=1.8;state.combo=0;state.comboT=0;
      document.getElementById("combo").classList.remove("show");
      state.shake=9;state.freeze=.05;state.flash=.55;state.flashColor="#c83828";sfx.hurt();updateHp();
      state.floaters.push({x:p.x,y:p.y-22,text:"墨影!",t:0,life:1});
      const ang=Math.atan2(p.y-e.y,p.x-e.x);
      p.vx=Math.cos(ang)*300;p.vy=Math.sin(ang)*300;stunEnemy(e,1.15);
      if(state.hp<=0){levelFail();return;}
    }
  }
  state.enemies=state.enemies.filter(e=>!e.dead);

  /* --- 诱饵 --- */
  for(let i=state.decoys.length-1;i>=0;i--){
    const d=state.decoys[i];d.t+=dt;
    const dr=moveCircle(d,dt);
    d.vx*=Math.pow(.25,dt);d.vy*=Math.pow(.25,dt);
    if(dr.hit||d.t>.62){
      state.waves.push({x:d.x,y:d.y,r:0,maxR:TILE*7,kind:"decoy"});
      state.decoyStones.push({x:d.x,y:d.y,t:3});
      for(const e of state.enemies){e.luredT=4.5;setEnemyMode(e,"investigate",4.5,d.x,d.y);}
      state.decoys.splice(i,1);
    }
  }
  for(let i=state.decoyStones.length-1;i>=0;i--){
    state.decoyStones[i].t-=dt;
    if(state.decoyStones[i].t<=0)state.decoyStones.splice(i,1);
  }

  /* --- 机关：压板/门/传送 --- */
  for(const pl of state.plates){
    const was=pl.on;
    pl.on=Math.hypot(pl.x-p.x,pl.y-p.y)<TILE*.48||
      state.decoyStones.some(s=>Math.hypot(pl.x-s.x,pl.y-s.y)<TILE*.48)||
      state.enemies.some(e=>Math.hypot(pl.x-e.x,pl.y-e.y)<TILE*.48);
    if(pl.on!==was){
      if(pl.on){sfx.dash();state.shake=Math.max(state.shake,3);
        state.floaters.push({x:pl.x,y:pl.y-14,text:"石门开",t:0,life:1});}
    }
  }
  const anyPlateOn=state.plates.some(pl=>pl.on);
  for(const d of state.doors){
    // 门格内还有玩家、墨影或诱饵时延迟关门，避免把移动实体夹进石门。
    d.open=anyPlateOn||doorOccupied(d);
  }
  for(const pt of state.portals){
    if(pt.cd>0)pt.cd-=dt;
    if(pt.cd<=0&&Math.hypot(pt.x-p.x,pt.y-p.y)<TILE*.42){
      const other=state.portals.find(x=>x!==pt);
      p.x=other.x;p.y=other.y;pt.cd=1;other.cd=1;
      sfx.decoy();state.shake=Math.max(state.shake,4);
      for(let k=0;k<16;k++){const a=Math.random()*Math.PI*2;
        state.particles.push({x:other.x,y:other.y,vx:Math.cos(a)*80,vy:Math.sin(a)*80,t:0,life:.6,color:"#8a8070",r:2});}
    }
  }
  /* --- 孢子收集 --- */
  for(const s of state.spores){
    if(s.got)continue;
    s.ph+=dt*2;
    if(Math.hypot(s.x-p.x,s.y-p.y)<p.r+12){
      s.got=true;state.combo++;state.comboT=2.2;
      sfx.spore(state.combo);
      state.shake=Math.max(state.shake,3);state.freeze=.02;
      for(let k=0;k<18;k++){
        const a=Math.random()*Math.PI*2,sp=60+Math.random()*110;
        state.particles.push({x:s.x,y:s.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:.7,color:"#d4a843",r:2.5});
      }
      state.floaters.push({x:s.x,y:s.y,text:state.combo>1?"x"+state.combo:"+1",t:0,life:1});
      const got=state.spores.filter(x=>x.got).length;
      document.getElementById("sporeGot").textContent=got;
      if(state.combo>1){
        const c=document.getElementById("combo");
        c.textContent="x"+state.combo;c.classList.add("show");
      }
      if(state.spores.every(x=>x.got)){
        state.exit.open=true;sfx.bellPick();
        state.floaters.push({x:p.x,y:p.y-35,text:"留白已开",t:0,life:1.4});
      }
    }
  }
  /* --- 铃铛拾取 --- */
  for(const b of state.bells){
    if(b.got)continue;
    if(Math.hypot(b.x-p.x,b.y-p.y)<p.r+13){
      b.got=true;state.bellsLeft++;sfx.bellPick();
      document.getElementById("bellLeft").textContent=state.bellsLeft;
      state.floaters.push({x:b.x,y:b.y,text:"朱铃+1",t:0,life:1.2});
      for(let k=0;k<16;k++){
        const a=Math.random()*Math.PI*2,sp=50+Math.random()*90;
        state.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:.8,color:"#c83828",r:2});
      }
    }
  }
  /* --- 出口 --- */
  if(state.exit.open&&Math.hypot(state.exit.x-p.x,state.exit.y-p.y)<p.r+15){
    levelComplete();return;
  }
  /* --- 粒子/飘字 --- */
  for(let i=state.particles.length-1;i>=0;i--){
    const pt=state.particles[i];pt.t+=dt;
    pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vx*=.93;pt.vy*=.93;
    if(pt.t>pt.life)state.particles.splice(i,1);
  }
  for(let i=state.floaters.length-1;i>=0;i--){
    const f=state.floaters[i];f.t+=dt;f.y-=28*dt;
    if(f.t>f.life)state.floaters.splice(i,1);
  }
  /* --- 相机 --- */
  const mw=state.cols*TILE,mh=state.rows*TILE;
  let tx=p.x-VW/2+p.vx*.15,ty=p.y-VH/2+p.vy*.15;
  tx=mw<VW?(mw-VW)/2:Math.max(0,Math.min(mw-VW,tx));
  ty=mh<VH?(mh-VH)/2:Math.max(0,Math.min(mh-VH,ty));
  state.camX+=(tx-state.camX)*Math.min(1,dt*6);
  state.camY+=(ty-state.camY)*Math.min(1,dt*6);
}
function render(){
  const th=state.theme;
  ctx.fillStyle=th.bg;ctx.fillRect(0,0,VW,VH);
  // 暗墨底图
  if(spr.bg.complete&&spr.bg.naturalWidth){
    ctx.globalAlpha=.42;
    ctx.drawImage(spr.bg,0,0,VW,VH);
    ctx.globalAlpha=1;
  }
  // 震屏
  let shx=0,shy=0;
  if(state.shake>0){shx=(Math.random()-.5)*state.shake;shy=(Math.random()-.5)*state.shake;}
  ctx.save();
  ctx.translate(-state.camX+shx,-state.camY+shy);
  const now=state.time,p=state.player;

  // 开阔墨池：微弱留白与干笔边缘组成可辨认的地图地标。
  for(const c of state.clearings){
    const pulse=.82+.18*Math.sin(now*.8+c.ph);
    const g=ctx.createRadialGradient(c.x,c.y,TILE*.15,c.x,c.y,TILE*1.75);
    g.addColorStop(0,hexA(th.inkHot,.09*pulse));g.addColorStop(.6,hexA(th.ink,.055*pulse));g.addColorStop(1,hexA(th.ink,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(c.x,c.y,TILE*1.75,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=hexA(th.wave,.07);ctx.lineWidth=1;ctx.setLineDash([TILE*.18,TILE*.34]);
    ctx.beginPath();ctx.ellipse(c.x,c.y,TILE*1.05,TILE*.68,c.ph*.12,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  }
  // 留痕
  if(p.trail.length>1){
    ctx.lineCap="round";ctx.lineJoin="round";
    for(let i=1;i<p.trail.length;i++){
      const a=Math.max(0,.16-(now-p.trail[i].t)*.075);
      if(a<=0)continue;
      ctx.strokeStyle=`rgba(200,56,40,${a})`;ctx.lineWidth=2.5+i/p.trail.length*3;
      ctx.beginPath();ctx.moveTo(p.trail[i-1].x,p.trail[i-1].y);ctx.lineTo(p.trail[i].x,p.trail[i].y);ctx.stroke();
    }
  }
  for(const tr of p.trail){
    const age=now-tr.t,a=Math.max(0,.14-age*.07);
    if(a<=0)continue;
    ctx.fillStyle=`rgba(200,56,40,${a})`;
    ctx.beginPath();ctx.arc(tr.x,tr.y,2.8,0,Math.PI*2);ctx.fill();
  }
  // 墙壁
  for(let y=0;y<state.rows;y++){
    for(let x=0;x<state.cols;x++){
      if(state.grid[y][x]!=="#")continue;
      const px=x*TILE,py=y*TILE;
      if(px>state.camX+VW+TILE||py>state.camY+VH+TILE||px+TILE<state.camX-TILE||py+TILE<state.camY-TILE)continue;
      const key=x+","+y;
      const last=state.wallGlow.get(key);
      let alpha=0;
      if(last!==undefined){
        const age=now-last;
        alpha=age<.15?1:Math.max(0,1-(age-.15)/2);
      }
      const remaining=(state.wallMark.get(key)||0)-now;
      const marked=remaining>0;
      const markAlpha=marked ? .7*Math.min(1,remaining/BELL_FADE) : 0;
      if(alpha<=.02&&!marked)continue;
      const cx=px+TILE/2,cy=py+TILE/2;
      if(alpha>.02){
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,TILE*.9);
        g.addColorStop(0,hexA(th.inkHot,alpha*.7));
        g.addColorStop(.55,hexA(th.ink,alpha*.45));
        g.addColorStop(1,hexA(th.ink,0));
        ctx.fillStyle=g;
        ctx.fillRect(px-TILE*.4,py-TILE*.4,TILE*1.8,TILE*1.8);
      }
      ctx.save();
      ctx.globalAlpha=Math.max(markAlpha,alpha*.96);
      ctx.translate(cx,cy);ctx.rotate(((x*13+y*31)%9-4)*.045);
      drawSprite(spr.rock,0,0,TILE*1.25);
      ctx.restore();
      if(marked&&alpha<.3){
        ctx.strokeStyle=hexA(th.glow,markAlpha*.75);ctx.lineWidth=.9;
        ctx.beginPath();
        ctx.arc(cx,cy,TILE*.16,-.7,2.5);
        ctx.stroke();
      }
    }
  }
  // 出口
  if(state.exit.open){
    ctx.save();ctx.translate(state.exit.x,state.exit.y);
    ctx.rotate(now*.65);drawSprite(spr.portal,0,0,42);ctx.restore();
    const g=ctx.createRadialGradient(state.exit.x,state.exit.y,0,state.exit.x,state.exit.y,42);
    g.addColorStop(0,hexA(th.glow,.4));g.addColorStop(1,hexA(th.glow,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(state.exit.x,state.exit.y,42,0,Math.PI*2);ctx.fill();
  }else{
    ctx.strokeStyle="rgba(160,140,100,.22)";ctx.lineWidth=1.3;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.arc(state.exit.x,state.exit.y,9,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
  }
  // 孢子
  for(const s of state.spores){
    if(s.got)continue;
    const reveal=Math.max(.1,Math.max(0,1-Math.hypot(s.x-p.x,s.y-p.y)/(TILE*4)),Math.min(1,(s.visibleT||0)*.7));
    ctx.globalAlpha=reveal;
    const pulse=.6+.4*Math.sin(s.ph);
    const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,18);
    g.addColorStop(0,`rgba(212,168,67,${.5*pulse})`);g.addColorStop(1,"rgba(212,168,67,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(s.x,s.y,18,0,Math.PI*2);ctx.fill();
    const sz=21*pulse;
    if(spr.spore.complete)drawSprite(spr.spore,s.x,s.y,sz*1.55);
    else{ctx.fillStyle="#d4a843";ctx.beginPath();ctx.arc(s.x,s.y,3.5,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }
  // 铃铛
  for(const b of state.bells){
    if(b.got)continue;
    const reveal=Math.max(.12,Math.max(0,1-Math.hypot(b.x-p.x,b.y-p.y)/(TILE*4)),Math.min(1,(b.visibleT||0)*.7));
    ctx.globalAlpha=reveal;
    const bob=Math.sin(now*3+b.x)*2,by=b.y+bob;
    const g=ctx.createRadialGradient(b.x,by,0,b.x,by,22);
    g.addColorStop(0,"rgba(200,56,40,.28)");g.addColorStop(1,"rgba(200,56,40,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,by,22,0,Math.PI*2);ctx.fill();
    if(spr.bell.complete){
      ctx.save();ctx.translate(b.x,by);ctx.rotate(Math.sin(now*3+b.x)*.13);
      drawSprite(spr.bell,0,0,40);ctx.restore();
    }
    ctx.globalAlpha=1;
  }
  // 压板
  for(const pl of state.plates){
    const sz=pl.on?26:30;
    if(spr.plate.complete){
      ctx.globalAlpha=pl.on?.5:1;
      drawSprite(spr.plate,pl.x,pl.y,sz);
      ctx.globalAlpha=1;
    }
  }
  // 门（关闭时画石门）
  for(const d of state.doors){
    if(d.open)continue;
    const px=(d.gx+.5)*TILE,py=(d.gy+.5)*TILE;
    drawSprite(spr.rock,px,py,TILE*1.25);
    ctx.strokeStyle="rgba(200,56,40,.6)";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(px-7,py+7);ctx.lineTo(px+7,py-7);ctx.stroke();
  }
  // 传送涡
  for(const pt of state.portals){
    const pulse=.7+.3*Math.sin(state.time*3+pt.x);
    const g=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,30);
    g.addColorStop(0,hexA("#9a9080",.3*pulse));g.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(pt.x,pt.y,30,0,Math.PI*2);ctx.fill();
    const sz=34*pulse;
    if(spr.portal.complete){
      ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(state.time*1.5);
      drawSprite(spr.portal,0,0,sz);ctx.restore();
    }
  }
  // 敌人
  for(const e of state.enemies){
    const proximity=Math.max(0,1-Math.hypot(e.x-p.x,e.y-p.y)/(TILE*3));
    const visibility=Math.max(.12,proximity*.75,e.visibleT>0?Math.min(1,.42+e.visibleT*.22):0);
    const pulse=.75+.25*Math.sin(e.ph*3);
    const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,34);
    const aura=e.mode==="chase"?"200,56,40":e.mode==="stunned"?"212,168,67":e.mode==="investigate"?"190,145,70":"80,88,92";
    g.addColorStop(0,`rgba(${aura},${visibility*.48*pulse})`);g.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(e.x,e.y,34,0,Math.PI*2);ctx.fill();
    const enemyBase=Math.max(58,Math.min(74,TILE*1.35));
    const sz=e.mode==="chase"?enemyBase+9:e.mode==="stunned"?enemyBase-4:enemyBase;
    ctx.globalAlpha=visibility;
    if(spr.ghost.complete){
      ctx.save();
      ctx.translate(e.x+Math.sin(e.ph*1.8)*1.3,e.y+Math.sin(e.ph*2.7)*2.2);
      ctx.rotate(Math.sin(e.ph*2.1)*(e.mode==="stunned"?.035:.13));
      const squirm=e.mode==="stunned"?.025:.08;
      ctx.scale(1+Math.sin(e.ph*3.2)*squirm,1-Math.sin(e.ph*3.2)*squirm);
      if(e.mode==="chase"){ctx.shadowColor="#c83828";ctx.shadowBlur=14;}
      if(e.mode==="stunned"){ctx.shadowColor="#d4a843";ctx.shadowBlur=16;}
      drawSprite(spr.ghost,0,0,sz);
      ctx.restore();
    }else{ctx.fillStyle="#1a1a1a";ctx.beginPath();ctx.arc(e.x,e.y,9,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    if(e.mode!=="patrol"&&visibility>.32){
      ctx.font="bold 17px KaiTi,serif";ctx.textAlign="center";
      ctx.fillStyle=e.mode==="chase"?"#e85a40":e.mode==="stunned"?"#e8c878":"#c8b890";
      ctx.fillText(e.mode==="chase"?"！":e.mode==="stunned"?"定":"？",e.x,e.y-20);
    }
  }
  for(const stone of state.decoyStones){
    ctx.globalAlpha=Math.min(1,stone.t);
    drawSprite(spr.rock,stone.x,stone.y,13);
    ctx.globalAlpha=1;
  }
  // 波
  for(const w of state.waves){
    const fade=1-w.r/w.maxR;
    let col=th.wave,wid=1.6;
    if(w.kind==="bell"){col="#d4a843";wid=2.4;}
    if(w.kind==="dash"){col="#e85a40";wid=2.2;}
    if(w.kind==="decoy"){col="#c6a981";wid=1.8;}
    const seg=52,layers=w.kind==="bell"?3:2;
    for(let layer=0;layer<layers;layer++){
      const rr=w.r-layer*(w.kind==="bell"?6:4);
      if(rr<=0)continue;
      ctx.beginPath();
      for(let i=0;i<=seg;i++){
        const a=i/seg*Math.PI*2;
        const jit=Math.sin(a*(6+layer)+w.r*.07+layer)*1.5+Math.sin(a*13+layer)*.45;
        const r=rr+jit,x=w.x+Math.cos(a)*r,y=w.y+Math.sin(a)*r;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.closePath();
      ctx.strokeStyle=hexA(col,fade*(w.kind==="bell"?.78:.46)*(1-layer*.24));
      ctx.lineWidth=Math.max(.6,wid-layer*.45);
      if(layer===0&&(w.kind==="bell"||w.kind==="dash")){ctx.shadowColor=hexA(col,.45);ctx.shadowBlur=12;}
      if(layer>0)ctx.setLineDash([5+layer*2,8+layer*3]);
      ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;
    }
    if((w.kind==="bell"||w.kind==="dash")&&fade>.15){
      ctx.fillStyle=hexA(col,fade*.52);
      for(let k=0;k<8;k++){
        const a=k*Math.PI/4+w.r*.008,r=w.r+Math.sin(k*7+w.r*.05)*4;
        ctx.beginPath();ctx.arc(w.x+Math.cos(a)*r,w.y+Math.sin(a)*r,1.1+(k%3)*.45,0,Math.PI*2);ctx.fill();
      }
    }
  }
  // 粒子
  for(const pt of state.particles){
    const a=1-pt.t/pt.life;
    ctx.fillStyle=hexA(pt.color,a);
    ctx.beginPath();ctx.arc(pt.x,pt.y,(pt.r||2)*a+.5,0,Math.PI*2);ctx.fill();
  }
  // 飘字
  for(const f of state.floaters){
    const a=1-f.t/f.life;
    ctx.font="bold 15px KaiTi,serif";
    ctx.fillStyle=`rgba(212,168,67,${a})`;
    ctx.textAlign="center";ctx.fillText(f.text,f.x,f.y);
  }
  // 玩家（squash & stretch）
  const motion=Math.min(1,Math.hypot(p.vx,p.vy)/185);
  const breathe=1+Math.sin(p.anim*.8)*.045;
  const psz=Math.max(72,Math.min(96,TILE*1.75))*breathe;
  const halo=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,68);
  halo.addColorStop(0,"rgba(200,56,40,.28)");halo.addColorStop(1,"rgba(200,56,40,0)");
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,p.y,68,0,Math.PI*2);ctx.fill();
  ctx.save();
  ctx.translate(p.x,p.y+Math.sin(p.anim)*(.8+motion*1.2));
  // 蝌蚪朝速度方向（图片默认头朝左，补180°）
  if(Math.hypot(p.vx,p.vy)>20)p.lastAng=Math.atan2(p.vy,p.vx);
  const moveAng=p.lastAng||0;
  ctx.rotate(moveAng+Math.PI+Math.sin(p.anim)*.035*motion);
  ctx.scale(p.sx*(1+Math.sin(p.anim)*.045),p.sy*(1-Math.sin(p.anim)*.035));
  if(state.hitT>0&&Math.floor(now*12)%2===0)ctx.globalAlpha=.35;
  if(spr.player.complete)drawInkSpirit(spr.player,psz,p.anim,state.dashT>0?1:motion);
  else{ctx.fillStyle="#c83828";ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  ctx.globalAlpha=1;
  ctx.restore();

  // 暗角
  const vg=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.32,VW/2,VH/2,Math.max(VW,VH)*.72);
  vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,.55)");
  ctx.fillStyle=vg;ctx.fillRect(0,0,VW,VH);
  if(state.flash>0){
    const fg=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.15,VW/2,VH/2,Math.max(VW,VH)*.7);
    fg.addColorStop(0,hexA(state.flashColor,state.flash*.07));fg.addColorStop(1,hexA(state.flashColor,state.flash*.2));
    ctx.fillStyle=fg;ctx.fillRect(0,0,VW,VH);
  }
}
/* ===== 过关/失败 ===== */
function levelComplete(){
  state.running=false;sfx.win();
  const secs=Math.round(state.time);
  const par=LEVELS[state.level].spore*9+state.cols*1.6;
  let rating="C";
  if(state.hp===state.maxHp&&secs<=par)rating="S";
  else if(state.hp===state.maxHp||(state.hp===2&&secs<=par))rating="A";
  else if(state.hp===2||secs<=par)rating="B";
  // 最佳
  let bestHtml="";
  try{
    const k="echo_best_"+state.level;
    const prev=parseInt(localStorage.getItem(k)||"0");
    if(!prev||secs<prev){localStorage.setItem(k,secs);bestHtml=`<span style="color:#c83828">新纪录</span>`;}
    else if(prev){const m=Math.floor(prev/60),s=prev%60;bestHtml=`本页最佳 <b>${m}:${s.toString().padStart(2,"0")}</b>`;}
  }catch(e){}
  const mm=Math.floor(secs/60),ss=secs%60;
  document.getElementById("endSeal").textContent="成";
  document.getElementById("endTitle").textContent=state.level+1<LEVELS.length?"此 页 已 成":"整 卷 完";
  document.getElementById("endStats").innerHTML=
    `<div class="rate">${rating}</div>用时 <b>${mm}:${ss.toString().padStart(2,"0")}</b><br>${bestHtml}`;
  document.getElementById("nextBtn").textContent=state.level+1<LEVELS.length?"接 着 画":"重 新 开 笔";
  setTimeout(()=>document.getElementById("endScreen").classList.remove("hidden"),450);
}
function levelFail(){
  state.running=false;
  document.getElementById("endSeal").textContent="散";
  document.getElementById("endTitle").textContent="墨 散 了";
  document.getElementById("endStats").innerHTML="墨影吞没了你。<br>重画这一页。";
  document.getElementById("nextBtn").textContent="重 画 此 页";
  setTimeout(()=>document.getElementById("endScreen").classList.remove("hidden"),500);
}

/* ===== 暂停 ===== */
function togglePause(force){
  const want=force!==undefined?force:!state.paused;
  state.paused=want;
  document.getElementById("pauseScreen").classList.toggle("hidden",!want);
}
document.getElementById("pauseBtn").addEventListener("click",()=>togglePause(true));
document.getElementById("resumeBtn").addEventListener("click",()=>{audioInit();togglePause(false);musicStepTick();});
document.getElementById("restartBtn").addEventListener("click",()=>{
  audioInit();togglePause(false);loadLevel(state.level);state.running=true;sfx.start();musicStepTick();});
document.getElementById("quitBtn").addEventListener("click",()=>{
  togglePause(false);state.running=false;
  document.getElementById("hud").classList.remove("on");
  document.body.classList.remove("playing");
  document.getElementById("startScreen").classList.remove("hidden");});
document.getElementById("pauseMuteBtn").addEventListener("click",()=>{
  toggleMute();});
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&!e.repeat&&state.running)togglePause();});

/* ===== 主循环 ===== */
let lastT=0;
function loop(t){
  const dt=Math.min(.05,(t-lastT)/1000||0);
  lastT=t;update(dt);render();
  requestAnimationFrame(loop);
}
/* ===== 启动/下一页 ===== */
document.getElementById("startBtn").addEventListener("pointerdown",audioInit);
document.getElementById("startBtn").addEventListener("click",()=>{
  if(!assetsReady)return;
  audioInit();
  sfx.start();
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("hud").classList.add("on");
  document.body.classList.add("playing");
  state.level=0;loadLevel(0);state.running=true;musicStepTick();
});
document.getElementById("nextBtn").addEventListener("click",()=>{
  audioInit();
  document.getElementById("endScreen").classList.add("hidden");
  document.getElementById("endSeal").textContent="成";
  if(state.hp<=0){loadLevel(state.level);}
  else{state.level=(state.level+1)%LEVELS.length;loadLevel(state.level);}
  state.running=true;sfx.start();musicStepTick();
});
requestAnimationFrame(loop);
