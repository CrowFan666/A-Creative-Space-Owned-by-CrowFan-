'use strict';
const ASSET=window.SIEGE_ASSETS||{cover:'assets/cover.png',sprites:'assets/sprites.png',arena:'assets/arena.png',icons:'assets/icons.png'};
const art={};
for(const [key,src] of Object.entries(ASSET)){art[key]=new Image;art[key].src=src}
const cv=document.querySelector('canvas'),ctx=cv.getContext('2d',{alpha:false});
const ready=img=>img?.complete&&img.naturalWidth>0;
function sprite(i,x,y,size,face=1,tilt=0,flash=false){
 const im=art.sprites;if(!ready(im))return false;
 const sw=im.naturalWidth/4,sh=im.naturalHeight/4;
 ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(face,1);if(flash)ctx.filter='brightness(1.85) saturate(.6)';
 ctx.drawImage(im,(i%4)*sw,Math.floor(i/4)*sh,sw,sh,-size/2,-size*.62,size,size);
 ctx.restore();return true;
}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill()}
function ring(x,y,r,color,w=2){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke()}
function line(x,y,xx,yy,color,w=2){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke()}
function poly(r,n,offset=0){ctx.beginPath();for(let i=0;i<n;i++){const a=i*TAU/n+offset;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath()}
function mutant(e,bob){
 const type=e.type,d=ENEMIES[type],r=e.r;
 ctx.save();ctx.translate(e.x,e.y+bob);ctx.scale(e.face,1);
 ctx.fillStyle=e.hit>0?'#fff2cc':d.color;ctx.strokeStyle='#101612';ctx.lineWidth=3;
 if(type===4){ctx.beginPath();ctx.moveTo(r*1.36,-r*.9);ctx.lineTo(r*.34,-r*.48);ctx.lineTo(-r,-r*.72);ctx.lineTo(-r*.68,r*.76);ctx.lineTo(r*.85,r*.72);ctx.closePath()}
 else if(type===5){poly(r*1.28,10,-.15)}
 else if(type===8){poly(r*1.17,6)}
 else if(type===9){ctx.beginPath();ctx.roundRect(-r,-r,r*2,r*1.9,r*.32)}
 else if(type===11){ctx.beginPath();ctx.moveTo(-r*1.3,r*.8);ctx.quadraticCurveTo(-r*.8,-r*1.72,r*.48,-r*.87);ctx.quadraticCurveTo(r*1.3,-r*.48,r*.96,r*.62);ctx.closePath()}
 else{poly(r,type===12?8:7)}
 ctx.fill();ctx.stroke();
 ellipse(0,r*.45,r*.63,r*.27,'#321d24');
 for(let i=-1;i<=1;i++){ctx.fillStyle='#f9ebbb';ctx.beginPath();ctx.moveTo(i*r*.3-3,r*.33);ctx.lineTo(i*r*.3+3,r*.33);ctx.lineTo(i*r*.3,r*.61);ctx.fill()}
 const n=type===5?3:type===9||type===12?1:2;
 for(let i=0;i<n;i++){const x=(i-(n-1)/2)*r*.55;ellipse(x,-r*.19,r*.27,r*.34,'#171819');ellipse(x+1,-r*.21,r*.16,r*.24,type===12?'#ff6f57':'#fff1ac');ellipse(x+2,-r*.18,r*.065,r*.14,'#1b1820')}
 ctx.restore();
}
function crystal(x,y,scale=1){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#b7fb58';ctx.strokeStyle='#e2ffa5';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,-2);ctx.lineTo(3,6);ctx.lineTo(-4,7);ctx.lineTo(-6,0);ctx.closePath();ctx.fill();ctx.stroke();line(0,-7,-1,6,'#7ac137',1.5);ctx.restore();
}
function drawGame(g){
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#232c23';ctx.fillRect(0,0,W,H);
 if(g.shake>0&&prefs.shake)ctx.translate((rnd(1)-.5)*g.shake*37,(rnd(1)-.5)*g.shake*37);
 if(ready(art.arena))ctx.drawImage(art.arena,0,0,W,H);else{
  for(let x=0;x<W;x+=80)line(x,0,x,H,'#343f32',1);
  for(let y=0;y<H;y+=60)line(0,y,W,y,'#343f32',1);
  ctx.strokeStyle='#66704e';ctx.strokeRect(12,12,W-24,H-24);
 }
 const time=g.time,p=g.p;
 for(const d of g.drops.active){const y=d.y+Math.sin(time*6+d.t)*3;ellipse(d.x,y+7,9,3,'#11250d90');crystal(d.x,y,d.worth>3?1.45:1)}
 for(const e of g.enemies.active){
  if(e.hp<=0||e.wind<=0)continue;
  ctx.globalAlpha=.62+.25*Math.sin(time*24);
  if(e.action==='charge'){line(e.x,e.y,e.x+Math.cos(e.angle)*335,e.y+Math.sin(e.angle)*335,'#ff7767',5);line(e.x,e.y,e.x+Math.cos(e.angle)*335,e.y+Math.sin(e.angle)*335,'#ffcf9e',1)}
  else if(e.action==='fan'){ctx.fillStyle='#ff65463b';ctx.beginPath();ctx.moveTo(e.x,e.y);const spread=e.type===13?1.12:e.type===5?.65:e.type===12?.41:.105;ctx.arc(e.x,e.y,e.type>=12?300:235,e.angle-spread,e.angle+spread);ctx.closePath();ctx.fill();ctx.strokeStyle='#ff9773';ctx.stroke()}
  else{const r=e.action==='burst'?106:128;ellipse(e.x,e.y,r,r,'#ff564936');ring(e.x,e.y,r,'#ffac77',3);ring(e.x,e.y,r*(.18+Math.max(0,1-e.wind/.85)*.82),'#ff7f5f',2)}
  ctx.globalAlpha=1;
 }
 for(const d of g.devices.active){
  const color=WEAPONS[d.w.id].color;ellipse(d.x,d.y+10,16,6,'#0008');
  ctx.save();ctx.translate(d.x,d.y);ctx.fillStyle='#1f2826';ctx.strokeStyle=color;ctx.lineWidth=2;poly(d.mode==='mine'?11:15,6,Math.PI/6);ctx.fill();ctx.stroke();ctx.restore();
  if(d.mode==='mine')ring(d.x,d.y,16+Math.sin(time*10)*3,'#ffba7588');else{line(d.x,d.y,d.x+12,d.y-9,color,5);ellipse(d.x,d.y,5,5,color)}
 }
 for(const e of g.enemies.active){
  if(e.hp<=0)continue;
  const d=ENEMIES[e.type],bob=Math.sin(e.age*(e.type===1?20:11)+e.uid)*3;
  ellipse(e.x,e.y+e.r*.72,e.r*.89,e.r*.32,'#03070688');
  if(e.age<.55){ring(e.x,e.y,e.r+15*(1-e.age/.55),'#ffbf7766');ctx.globalAlpha=.25+e.age}
  if(e.type===11&&e.charge<=0&&e.wind<=0&&d2(e,p)>175**2)ctx.globalAlpha=.34;
  if(d.sprite<0||!sprite(d.sprite,e.x,e.y+bob,e.r*(e.type===13?2.8:2.65),e.face,Math.sin(e.age*8)*.043,e.hit>0))mutant(e,bob);
  ctx.globalAlpha=1;
  if(e.shield>0)ring(e.x,e.y,e.r*1.19,'#7ddcff',2);
  if(e.slow>0)ring(e.x,e.y+3,e.r*.92,'#7cd4fa66',2);
  if(e.type===12){ring(e.x,e.y+3,e.r*1.23,'#ffbb66');ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffe8a8';ctx.fillText('精英',e.x,e.y-e.r-15)}
  if(e.type!==13&&(e.hp<e.max||e.type===12)){const ww=e.r*1.66;ctx.fillStyle='#121515';ctx.fillRect(e.x-ww/2,e.y+e.r+7,ww,4);ctx.fillStyle=d.color;ctx.fillRect(e.x-ww/2,e.y+e.r+7,ww*e.hp/e.max,3)}
 }
 if(g.status!=='lost'&&g.status!=='won'){
  const dying=g.status==='dying',s=dying?Math.max(.05,g.death/.75):1;
  const walk=p.walk?Math.sin(p.walk)*3:Math.sin(time*4)*1.2;
  ctx.globalAlpha=dying?s:p.ifr>0&&Math.floor(p.ifr*20)%2===0?.52:1;
  ellipse(p.x,p.y+20,24*s,9*s,'#020503a0');
  ctx.strokeStyle='#bcff7b';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+17,24*s,10*s,0,0,TAU);ctx.stroke();
  if(!sprite(g.role,p.x,p.y+walk,62*s,p.face,dying?(1-s)*1.9:walk*.024,p.ifr>.47))ellipse(p.x,p.y,16*s,17*s,ROLES[g.role][5]);
  ctx.globalAlpha=1;
  if(p.shield)ring(p.x,p.y,29,'#8fdfffaa');
  if(p.hp<g.s.hp){ctx.fillStyle='#211c18';ctx.fillRect(p.x-23,p.y+30,46,5);ctx.fillStyle='#ff8a73';ctx.fillRect(p.x-23,p.y+30,46*p.hp/g.s.hp,4)}
  for(let i=0;i<g.weapons.length;i++)if(g.weapons[i].id===22){const a=time*4+i;ellipse(p.x+Math.cos(a)*53,p.y+Math.sin(a)*53,10,6,'#8be5ee');ellipse(p.x+Math.cos(a)*53,p.y+Math.sin(a)*53,3,3,'#152e31')}
 }
 for(const b of g.bullets.active){
  if(b.mode==='gravity'){ellipse(b.x,b.y,12,12,'#271743');ring(b.x,b.y,12+Math.sin(time*11)*4,b.color,2);ring(b.x,b.y,23,b.color+'66');continue}
  if(b.mode==='return'||b.mode==='ice'||b.mode==='knives'){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.mode==='return'?time*26:b.a);ctx.fillStyle=b.color;poly(b.mode==='return'?10:7,b.mode==='return'?3:4);ctx.fill();ctx.restore();continue}
  const len=b.enemy?8:b.mode==='snipe'?27:b.mode==='fire'?8:15;
  line(b.x-Math.cos(b.a)*len,b.y-Math.sin(b.a)*len,b.x,b.y,b.color,b.enemy?3:b.r+1);ellipse(b.x,b.y,b.r*.75,b.r*.75,b.enemy?'#ffd0a8':'#fff7c9');
 }
 for(const f of g.fx.active){
  const t=1-f.life/f.max;ctx.globalAlpha=clamp(1-t,0,1);
  if(f.kind==='text'&&prefs.numbers){ctx.font='900 '+(String(f.extra).startsWith('✦')?22:17)+'px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#171612';ctx.strokeText(f.extra,f.x,f.y-t*34);ctx.fillStyle=f.color;ctx.fillText(f.extra,f.x,f.y-t*34)}
  if(f.kind==='spark')ellipse(f.x+Math.cos(f.a)*f.extra*t,f.y+Math.sin(f.a)*f.extra*t,f.r*(1-t*.8),f.r*(1-t*.8),f.color);
  if(f.kind==='ring'||f.kind==='blast'||f.kind==='saw'){ring(f.x,f.y,f.r*(.35+.65*t),f.color,f.kind==='saw'?9:4);if(f.kind==='saw'){ctx.save();ctx.translate(f.x,f.y);ctx.rotate(t*3);ctx.strokeStyle=f.color;poly(f.r*(.68+.32*t),15);ctx.stroke();ctx.restore()}}
  if(f.kind==='slash'||f.kind==='twin'){ctx.strokeStyle=f.color;ctx.lineWidth=f.kind==='twin'?5:13;for(let j=0;j<(f.kind==='twin'?2:1);j++){ctx.beginPath();ctx.arc(f.x,f.y,f.r*(.44+.43*t+j*.18),f.a-f.extra,f.a+f.extra);ctx.stroke()}}
  if(f.kind==='line'){line(f.x,f.y,f.x+Math.cos(f.a)*f.r,f.y+Math.sin(f.a)*f.r,f.color,13*(1-t)+1);line(f.x,f.y,f.x+Math.cos(f.a)*f.r,f.y+Math.sin(f.a)*f.r,'#fff7e1',2)}
  if(f.kind==='muzzle'){ellipse(f.x,f.y,f.r*(1-t*.5),f.r*(1-t*.5),f.color);ellipse(f.x,f.y,4,4,'#fff7cb')}
 }
 ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);
}
let audio=null,sfxBus=null,musicBus=null,noteAt=0,noteIndex=0;
const played={};
function initAudio(){
 try{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;audio=new Audio;sfxBus=audio.createGain();musicBus=audio.createGain();sfxBus.connect(audio.destination);musicBus.connect(audio.destination)}audio.resume().catch(()=>{});audioSettings()}catch{}
}
function audioSettings(){if(audio){sfxBus.gain.value=prefs.sfx;musicBus.gain.value=prefs.music}}
function tone(bus,type,from,to,vol,seconds,at){
 if(!audio||!vol)return;const o=audio.createOscillator(),g=audio.createGain();
 o.type=type;o.frequency.setValueAtTime(from,at);o.frequency.exponentialRampToValueAtTime(Math.max(1,to),at+seconds);g.gain.setValueAtTime(vol,at);g.gain.exponentialRampToValueAtTime(.001,at+seconds);o.connect(g);g.connect(bus);o.start(at);o.stop(at+seconds+.015);
}
function sound(name){
 if(!audio||audio.state!=='running'||!prefs.sfx)return;
 const now=audio.currentTime;if(now-(played[name]??-1)<.058)return;played[name]=now;
 const s={shoot:['triangle',270,90,.055,.085],slash:['sawtooth',160,65,.032,.09],pickup:['sine',500,940,.075,.115],hurt:['triangle',160,48,.15,.20],click:['sine',370,570,.058,.09],lose:['triangle',340,43,.15,.7],clear:['triangle',330,660,.12,.35]}[name];
 if(s)tone(sfxBus,...s,now);
}
function music(active){
 if(!audio||audio.state!=='running'||!prefs.music||!active){noteAt=0;return}
 const now=audio.currentTime;if(noteAt<now)noteAt=now+.015;
 const roots=[55,55,65.406,49],notes=[0,7,12,3,0,10,7,3];
 while(noteAt<now+.11){
  const bar=Math.floor(noteIndex/16)%4,i=noteIndex%16,root=roots[bar];
  if(i%4===0)tone(musicBus,'triangle',root,root*.99,.20,.31,noteAt);
  if(i%2===0||i===15){const f=root*4*2**(notes[i%8]/12);tone(musicBus,'triangle',f,f*.998,.048,.17,noteAt)}
  if(i%8===0||i%8===5)tone(musicBus,'sine',81,34,.15,.13,noteAt);
  noteIndex++;noteAt+=.173;
 }
}