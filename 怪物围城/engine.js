'use strict';
class Pool {
 constructor(){this.active=[];this.free=[]}
 add(props){const o=Object.assign(this.free.pop()||{},props);this.active.push(o);return o}
 remove(i){const list=this.active,o=list[i],last=list.pop();if(i<list.length)list[i]=last;this.free.push(o)}
 clear(){while(this.active.length)this.free.push(this.active.pop())}
}
class Grid {
 constructor(){this.cols=14;this.rows=7;this.bins=Array.from({length:98},()=>[])}
 reset(es){for(const b of this.bins)b.length=0;for(const e of es)if(e.hp>0)this.bins[Math.floor(clamp(e.y/96,0,6))*14+Math.floor(clamp(e.x/96,0,13))].push(e)}
 query(x,y,r,cb){for(let j=Math.floor(clamp((y-r)/96,0,6));j<=Math.floor(clamp((y+r)/96,0,6));j++)for(let i=Math.floor(clamp((x-r)/96,0,13));i<=Math.floor(clamp((x+r)/96,0,13));i++)for(const e of this.bins[j*14+i])if(e.hp>0)cb(e)}
}
const d2=(a,b)=> (a.x-b.x)**2+(a.y-b.y)**2;
const ang=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const weaponSlot=(id,q=0)=>({id,q,cd:0});
class Game {
 constructor(role,diff,id){
  this.role=role;this.diff=diff;this.wave=0;this.kills=0;this.gold=14;this.xp=0;this.level=1;this.pending=0;this.items={};this.weapons=[weaponSlot(id)];
  this.s={...BASE,...Object.fromEntries(Object.keys(EXTRA).map(k=>[k,0]))};this.p={x:W/2,y:H/2,hp:50,face:1,walk:0,ifr:0,shield:0};this.mod(ROLES[role][2]);this.p.hp=this.s.hp;
  this.enemies=new Pool;this.bullets=new Pool;this.drops=new Pool;this.fx=new Pool;this.devices=new Pool;this.grid=new Grid;
  this.offers=[];this.status='idle';this.time=0;this.uid=0;this.shake=0;this.death=0;this.bestWave=0;this.fusions=0;this.gotSix=false;this.legend=false;
 }
 mod(o){for(const [k,v] of Object.entries(o))this.s[k]+=v;this.s.hp=Math.max(10,this.s.hp);this.p.hp=clamp(this.p.hp+(o.hp||0),1,this.s.hp)}
 get threshold(){return 8+Math.floor((this.level-1)*3.2)}
 start(){
  this.wave++;this.left=waveDuration(this.wave);this.status='fight';this.spawnClock=.32;this.bossDead=false;this.elapsed=0;this.refreshes=0;this.options=null;this.hits=0;
  for(const p of [this.enemies,this.bullets,this.drops,this.fx,this.devices])p.clear();
  Object.assign(this.p,{x:W/2,y:H/2,ifr:0,shield:this.s.opening+(this.role===5?1:0)});
  this.p.hp=Math.min(this.s.hp,this.p.hp+Math.ceil(this.s.hp*.24)+(this.role===0?5:0));
  this.weapons.forEach((w,i)=>w.cd=i*.13);
  if([5,10,15,20].includes(this.wave))this.spawn(this.wave===20?13:12);
 }
 spawn(type,x,y,scale=1){
  if(this.enemies.active.length>=180&&type<12)return;
  if(x===undefined){
   const edge=Math.floor(rnd(4)),u=.12+rnd(.76);
   x=edge===0?30:edge===1?W-30:W*u;y=edge===2?30:edge===3?H-30:H*u;
   if((x-this.p.x)**2+(y-this.p.y)**2<260**2){x=W-x;y=H-y}
  }
  const def=ENEMIES[type], hp=def.hp*DIFF[this.diff][2]*(type===13?1:type===12?1+(this.wave-5)*.12:1+(this.wave-1)*.083)*scale;
  return this.enemies.add({uid:++this.uid,type,x,y,hp,max:hp,r:def.r*Math.sqrt(scale),scale,age:0,clock:.9+rnd(1.1),wind:0,action:'',angle:0,charge:0,hit:0,kx:0,ky:0,slow:0,slowPct:0,burn:0,poison:0,burnD:0,poisonD:0,shield:type===10?hp*.38:0,face:1,stage:1});
 }
 nearest(x,y,r,except=-1,except2=-1){let best=null,dist=r*r;this.grid.query(x,y,r,(e)=>{const dd=(e.x-x)**2+(e.y-y)**2;if(dd<dist&&e.uid!==except&&e.uid!==except2){dist=dd;best=e}});return best}
 effect(kind,x,y,color,r=12,life=.27,a=0,extra=0){if(this.fx.active.length>=450)return;this.fx.add({kind,x,y,color,r,life,max:life,a,extra})}
 burst(x,y,color,n=7){for(let i=0;i<n;i++)this.effect('spark',x,y,color,3+rnd(3),.22+rnd(.30),rnd(TAU),25+rnd(110))}
 playerHit(amount,source){
  const p=this.p;if(p.ifr>0||this.status!=='fight')return;
  if(rnd(100)<clamp(this.s.dodge,0,65)){p.ifr=.27;this.effect('text',p.x,p.y-28,'#e1fda2',0,.65,0,'闪避');return}
  if(p.shield>0){p.shield--;p.ifr=.48;this.effect('ring',p.x,p.y,'#86d9ff',53);return}
  const armor=this.s.armor,m=armor>=0?100/(100+armor*5):1+Math.min(1,-armor*.055);
  p.hp=Math.max(0,p.hp-amount*m*DIFF[this.diff][3]*(1+(this.wave-1)*.024));p.ifr=.62;this.shake=.18;
  this.effect('text',p.x,p.y-24,'#ff8f78',0,.64,0,'−'+Math.round(amount*m*DIFF[this.diff][3]*(1+(this.wave-1)*.024)));sound('hurt');
  if(this.s.reflect&&source)this.rawHit(source,this.s.reflect,'#f9d296',true);
  if(p.hp<=0){this.death=.75;this.status='dying';this.burst(p.x,p.y,'#fff3d1',22);sound('lose')}
 }
 rawHit(e,n,color,show=true,crit=false){
  if(e.hp<=0)return;
  if(e.shield>0){const soak=Math.min(e.shield,n*.72);e.shield-=soak;n-=soak}
  if(e.type===2)n*=.79;
  e.hp-=n;e.hit=.095;
  if(show){this.effect('text',e.x,e.y-e.r,color,0,.52,0,(crit?'✦ ':'')+Math.round(n));if(crit)this.burst(e.x,e.y,color,4)}
  if(e.type<12&&this.s.execution>0&&e.hp/e.max<Math.min(.25,this.s.execution/100))e.hp=0;
  if(e.hp<=0){e.hp=0;this.kills++;if(e.type===13)this.bossDead=true;if(e.type===12)this.gold+=this.s.elitePay;
   this.p.hp=Math.min(this.s.hp,this.p.hp+this.s.killheal);
   this.burst(e.x,e.y,ENEMIES[e.type].color,e.type>=12?25:7);
   const worth=e.type===13?28:e.type===12?12:e.scale<.7?1:1+(e.type>=2?1:0)+(rnd(100)<clamp(this.s.luck,0,65)?1:0);
   this.drops.add({x:e.x,y:e.y,worth,pull:false,t:rnd(TAU)});
   if(e.type===8&&e.scale>.7){this.spawn(0,e.x-17,e.y,.57);this.spawn(1,e.x+17,e.y,.57)}
   if(this.s.blast)this.effect('blast',e.x,e.y,'#ffc78b',66,.23,0,this.s.blast);
  }
 }
 hit(e,w,scale=1,x=this.p.x,y=this.p.y){
  if(e.hp<=0)return;
  const s=this.s,d=WEAPONS[w.id],boss=e.type>=12,crit=rnd(100)<clamp(s.crit+d.crit+(this.p.hp>=s.hp-.01?s.maxCrit:0),0,100);
  let n=Math.max(1,d.damage*MULT[w.q]+s[d.type])*Math.max(.15,1+(s.damage+(this.p.hp<s.hp*.35?s.panic:0)+(boss?s.bossdmg+(this.role===7?15:0):0))/100)*scale;
  if(crit)n*=Math.max(1,s.critMult/100);
  if(rnd(100)<clamp(s.steal,0,50))this.p.hp=Math.min(s.hp,this.p.hp+1.4);
  const a=Math.atan2(e.y-y,e.x-x),kick=d.kick*(boss?.22:1);e.kx+=Math.cos(a)*kick*7;e.ky+=Math.sin(a)*kick*7;
  const duration=Math.max(.2,1+s.status/100);
  if(d.mode==='fire'||s.burn>0){e.burn=2.2*duration;e.burnD=(d.mode==='fire'?4:0)+s.burn}
  if(d.mode==='acid'||s.poison>0){e.poison=3.2*duration;e.poisonD=(d.mode==='acid'?6:0)+s.poison}
  if(['ice','emp'].includes(d.mode)||s.freeze>0){e.slow=2*duration;e.slowPct=clamp((d.mode==='ice'?.4:d.mode==='emp'?.32:0)+s.freeze/100,0,.72)}
  if(d.mode==='emp')e.shield=0;
  this.rawHit(e,n,crit?'#fff38c':d.color,true,crit);
  if(s.chain){const near=this.nearest(e.x,e.y,95,e.uid);if(near){this.effect('line',e.x,e.y,'#a9baff',Math.sqrt(d2(e,near)),.15,ang(e,near));this.rawHit(near,s.chain,'#b6c9ff',false)}}
 }
 area(x,y,r,w,scale=1){this.grid.query(x,y,r+50,e=>{if((e.x-x)**2+(e.y-y)**2<(r+e.r)**2)this.hit(e,w,scale,x,y)})}
 shoot(w,x,y,a,target){
  if(this.bullets.active.length>=620)return;
  const d=WEAPONS[w.id],v=({rocket:465,return:520,fire:480,ice:570,magic:440,gravity:375,acid:490,knives:690,snipe:1240})[d.mode]||780;
  const speed=v*(this.role===2&&d.type==='ranged'?1.25:1), reach=d.reach*Math.max(.5,1+this.s.range/100);
  const life=d.mode==='return'?1.25:d.mode==='gravity'?Math.min(reach,Math.hypot((target?.x??x)-x,(target?.y??y)-y))/speed+.75:reach/speed;
  this.bullets.add({w,x,y,px:x,py:y,a,speed,life,max:life,target:target?.uid??-1,last:-1,last2:-1,pierce:d.pierce+Math.floor(this.s.pierce),bounce:Math.floor(this.s.bounce),enemy:false,color:d.color,mode:d.mode,r:d.mode==='gravity'?12:d.mode==='rocket'?7:d.mode==='fire'?9:4,ret:false});
 }
 attack(w,target,r,slot){
  const p=this.p,d=WEAPONS[w.id],m=d.mode,a=ang(p,target), x=p.x,y=p.y;
  if(['slash','cleave','twin','lance','beam'].includes(m)){
   const linear=m==='lance'||m==='beam', width=m==='twin'?.43:m==='cleave'?1.06:1.42;
   this.effect(linear?'line':m==='twin'?'twin':'slash',x,y,d.color,r,linear?.21:.24,a,width);
   this.grid.query(x,y,r+35,e=>{const dd=Math.sqrt(d2(p,e)),ad=Math.abs(delta(ang(p,e),a));if(dd<r+e.r&&(linear?ad<Math.PI/2&&Math.sin(ad)*dd<e.r+(m==='beam'?10:15):ad<width||dd<e.r+13)){this.hit(e,w);if(m==='twin')this.hit(e,w,.78)}});
  }else if(m==='slam'||m==='spin'||m==='emp'){
   const at=m==='slam'?target:p, radius=m==='slam'?69:r;
   this.effect(m==='spin'?'saw':'ring',at.x,at.y,d.color,radius,.31,a);this.area(at.x,at.y,radius,w);
  }else if(m==='bolt'){
   let at=p,e=target,prev=-1;
   for(let i=0;e&&i<4+w.q;i++){this.effect('line',at.x,at.y,d.color,Math.sqrt(d2(at,e)),.20,ang(at,e));this.hit(e,w,1-i*.10);const next=this.nearest(e.x,e.y,125,e.uid,prev);prev=e.uid;at=e;e=next}
  }else if(m==='turret'||m==='mine'){
   const angle=slot*2.4+this.time, offset=m==='mine'?47:34;
   this.devices.add({w,x:clamp(x+Math.cos(angle)*offset,24,W-24),y:clamp(y+Math.sin(angle)*offset,24,H-24),cd:.18,life:m==='mine'?15:10,mode:m});
   this.effect('ring',x,y,d.color,47,.26);
  }else{
   const origin=m==='drone'?{x:x+Math.cos(this.time*4+slot)*53,y:y+Math.sin(this.time*4+slot)*53}:p;
   const spread=({shotgun:.15,knives:.19,fire:.22,acid:.15,magic:.18})[m]||0;
   for(let i=0;i<d.count;i++){
    const seeker=m==='magic'&&i!==1?this.nearest(target.x,target.y,160,target.uid)||target:target;
    this.shoot(w,origin.x,origin.y,ang(origin,seeker)+(i-(d.count-1)/2)*spread+(m==='smg'?rnd(.19)-.095:0),seeker);
   }
   this.effect('muzzle',origin.x+Math.cos(a)*17,origin.y+Math.sin(a)*17,d.color,11,.14,a);
  }
  sound(d.type==='melee'?'slash':'shoot');
 }
 hostile(e,a,speed=250,n=1,spread=.19){
  for(let j=0;j<n;j++){if(this.bullets.active.length>=620)break;const theta=a+(j-(n-1)/2)*spread;this.bullets.add({w:null,x:e.x,y:e.y,px:e.x,py:e.y,a:theta,speed,life:4,max:4,target:-1,last:-1,last2:-1,pierce:0,bounce:0,enemy:true,color:'#ff8f8e',mode:'hostile',r:e.type>=12?6:4,ret:false,amount:ENEMIES[e.type].dmg*.74})}
 }
 enemyTick(e,dt){
  const p=this.p,d=ENEMIES[e.type],a=ang(e,p), dist=Math.sqrt(d2(e,p)), type=e.type;
  e.age+=dt;e.clock-=dt;e.hit-=dt;e.slow-=dt;
  if(e.burn>0){e.burn-=dt;this.rawHit(e,e.burnD*dt,'#ffb081',false)}
  if(e.poison>0){e.poison-=dt;this.rawHit(e,e.poisonD*dt,'#b2f792',false)}
  if(e.hp<=0)return;
  e.stage=type===13?(e.hp/e.max>.67?1:e.hp/e.max>.33?2:3):1;
  let motion=1, theta=a;
  if(e.wind>0){
   e.wind-=dt;motion=0;
   if(e.wind<=0){
    switch(e.action){
     case 'fan':this.hostile(e,e.angle,type===13?300:235,type===13?(e.stage===3?13:9):type===5?7:type===12?5:1);break;
     case 'charge':e.charge=type>=12?.56:.45;if(type===13){this.spawn(1,e.x-40,e.y);this.spawn(3,e.x+40,e.y)}break;
     case 'burst':this.effect('ring',e.x,e.y,'#ff9874',95,.45);if(dist<106)this.playerHit(d.dmg,e);this.rawHit(e,e.hp*3+1,d.color,false);break;
     case 'ring':this.hostile(e,e.angle,230,24,TAU/24);this.effect('ring',e.x,e.y,'#ffa796',116,.45);if(dist<128)this.playerHit(d.dmg,e);break;
    }
   }
  }else if(e.charge>0){e.charge-=dt;theta=e.angle;motion=4.25}
  else if(e.age>.55){
   let action='',interval=2.1, warning=.48;
   if(type===3||type===5){motion=dist<180?-.75:dist<300?0:1;if(dist<470)action='fan';interval=type===3?2.35:3.2}
   if(type===4&&dist<330){action='charge';interval=3.1;warning=.68}
   if(type===6&&dist<78){action='burst';warning=.83}
   if(type===11&&dist<160){action='charge';interval=2.3;warning=.52}
   if(type===12&&dist<540){action=rnd(1)<.5?'charge':'fan';interval=2.75;warning=.7}
   if(type===13){action=e.stage===1?'fan':e.stage===2?'charge':rnd(1)<.57?'ring':'fan';interval=e.stage===1?2.7:e.stage===2?3:1.55;warning=e.stage===3?.60:.84;motion=dist<185?.28:.77}
   if(e.clock<=0&&action){Object.assign(e,{wind:warning,action,angle:a,clock:interval+warning});motion=0}
   if(type===7&&e.clock<=0){e.clock=2.6;this.grid.query(e.x,e.y,126,b=>{if(d2(e,b)<126**2)b.hp=Math.min(b.max,b.hp+b.max*.09)});this.effect('ring',e.x,e.y,'#8bf5bf',126,.48)}
   if(type===9&&e.clock<=0){e.clock=5.2;this.spawn(0,e.x+29,e.y,.7);this.spawn(1,e.x-29,e.y,.7);this.effect('ring',e.x,e.y,'#c4b6fc',70,.48)}
  }else motion=0;
  const speed=d.speed*(1+this.wave*.009)*(e.slow>0?1-e.slowPct:1)*motion;
  let sx=0,sy=0;
  if(motion>0&&e.charge<=0)this.grid.query(e.x,e.y,e.r+32,b=>{if(e===b)return;const dx=e.x-b.x,dy=e.y-b.y,rr=(e.r+b.r)*.73,dd=dx*dx+dy*dy;if(dd>1&&dd<rr*rr){sx+=dx/rr*66;sy+=dy/rr*66}});
  e.x=clamp(e.x+(Math.cos(theta)*speed+e.kx+sx)*dt,e.r,W-e.r);
  e.y=clamp(e.y+(Math.sin(theta)*speed+e.ky+sy)*dt,e.r,H-e.r);e.kx*=Math.max(0,1-dt*8);e.ky*=Math.max(0,1-dt*8);
  if(motion!==0)e.face=Math.cos(theta)>0?1:-1;
  if(e.age>.6&&dist<e.r+15)this.playerHit(d.dmg*(e.charge>0?1.19:1),e);
 }
 bulletTick(b,dt){
  b.life-=dt;b.px=b.x;b.py=b.y;
  const p=this.p;
  if(b.mode==='magic'){const e=this.nearest(b.x,b.y,220,b.last,b.last2);if(e)b.a+=clamp(delta(ang(b,e),b.a),-dt*6,dt*6)}
  if(b.mode==='return'&&b.life<b.max*.56){if(!b.ret){b.last=b.last2=-1;b.ret=true}b.a=ang(b,p);if(d2(b,p)<20**2)return false}
  if(b.mode==='gravity'&&b.life<.78){b.speed*=Math.max(0,1-dt*10);this.grid.query(b.x,b.y,130,e=>{const dd=Math.sqrt(d2(b,e));if(dd<130&&dd>3){const a=ang(e,b);e.kx+=Math.cos(a)*dt*420;e.ky+=Math.sin(a)*dt*420}});if(b.life<=0){this.area(b.x,b.y,105,b.w,1.25);this.effect('ring',b.x,b.y,b.color,105,.39);return false}}
  if(b.life<=0)return false;
  b.x+=Math.cos(b.a)*b.speed*dt;b.y+=Math.sin(b.a)*b.speed*dt;
  if(b.x<-25||b.y<-25||b.x>W+25||b.y>H+25)return false;
  if(b.enemy){if(d2(b,p)<(b.r+13)**2){this.playerHit(b.amount);return false}return true}
  if(b.mode==='gravity')return true;
  let best=null,min=Infinity;const vx=b.x-b.px,vy=b.y-b.py,len=vx*vx+vy*vy;
  this.grid.query(b.x,b.y,65,e=>{
   if(e.uid===b.last||e.uid===b.last2)return;
   const t=len?clamp(((e.x-b.px)*vx+(e.y-b.py)*vy)/len,0,1):0;
   const dd=(e.x-b.px-t*vx)**2+(e.y-b.py-t*vy)**2;
   if(dd<(e.r+b.r)**2&&t<min){min=t;best=e}
  });
  if(!best)return true;
  this.hit(best,b.w,1,b.px,b.py);this.burst(b.x,b.y,b.color,3);
  if(b.mode==='rocket'){this.area(b.x,b.y,79,b.w,.55);this.effect('ring',b.x,b.y,b.color,79,.34);return false}
  b.last2=b.last;b.last=best.uid;
  if(b.bounce>0){const near=this.nearest(best.x,best.y,200,b.last,b.last2);if(near){b.a=ang(b,near);b.life=Math.max(b.life,.36);b.bounce--;return true}}
  return b.pierce-->0;
 }
 collect(d){this.gold+=Math.max(0,Math.round(d.worth*(1+this.s.coin/100)));this.xp+=Math.max(0,Math.round(d.worth*(1+this.s.xp/100)));while(this.xp>=this.threshold){this.xp-=this.threshold;this.level++;this.pending++}}
 tick(dt,keys,stickX=0,stickY=0){
  if(this.status==='dying'){this.death-=dt;this.animate(dt);if(this.death<=0)this.status='lost';return}
  if(this.status!=='fight')return;
  this.time+=dt;this.elapsed+=dt;this.left=Math.max(0,this.left-dt);this.shake=Math.max(0,this.shake-dt);
  const p=this.p,s=this.s;p.ifr=Math.max(0,p.ifr-dt);
  const keyX=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
  const keyY=Number(keys.has('KeyS'))-Number(keys.has('KeyW'));
  const dx=keyX||keyY?keyX:stickX, dy=keyX||keyY?keyY:stickY;
  const n=Math.max(1,Math.hypot(dx,dy)), speed=Math.max(70,s.speed);
  p.x=clamp(p.x+dx/n*speed*dt,23,W-23);p.y=clamp(p.y+dy/n*speed*dt,23,H-23);
  p.walk=dx||dy?p.walk+dt*13:0;
  if(dx)p.face=Math.sign(dx);
  p.hp=Math.min(s.hp,p.hp+s.regen*dt);if(p.hp<=0){p.hp=0;this.death=.75;this.status='dying';this.burst(p.x,p.y,'#fff3d1',22);sound('lose');return}
  if(this.left>1){this.spawnClock-=dt;if(this.spawnClock<=0){this.spawnClock=Math.max(.29,1.42-this.wave*.052)/DIFF[this.diff][1];const cap=Math.min(12,2+Math.floor(this.wave*.61));for(let i=0;i<1+Math.floor((this.wave-1)/6);i++)this.spawn(rnd(1)<.29?0:Math.floor(rnd(cap)))}}
  const es=this.enemies.active;this.grid.reset(es);
  for(let i=es.length-1;i>=0;i--)if(es[i].hp>0)this.enemyTick(es[i],dt);
  if(this.status!=='fight')return;
  this.grid.reset(es);
  for(let i=0;i<this.weapons.length;i++){
   const w=this.weapons[i],d=WEAPONS[w.id];w.cd-=dt;if(w.cd>0)continue;
   const reach=d.reach*Math.max(.5,1+s.range/100),target=this.nearest(p.x,p.y,reach);
   if(!target)continue;
   const haste=s.haste+(this.role===1&&p.hp<s.hp*.4?35:0);
   w.cd=d.cd/Math.max(.25,1+haste/100)/(1+w.q*.09);
   this.attack(w,target,reach,i);
  }
  for(let i=this.devices.active.length-1;i>=0;i--){
   const d=this.devices.active[i];d.life-=dt;d.cd-=dt;
   if(d.life<=0){this.devices.remove(i);continue}if(d.cd>0)continue;
   const e=this.nearest(d.x,d.y,(d.mode==='mine'?53:410)*Math.max(.5,1+s.range/100));if(!e)continue;
   if(d.mode==='mine'){this.area(d.x,d.y,111,d.w);this.effect('ring',d.x,d.y,'#ffc584',111,.38);this.devices.remove(i)}
   else{d.cd=.45/Math.max(.25,1+(s.turret+s.haste)/100)/(1+d.w.q*.09);this.shoot(d.w,d.x,d.y,ang(d,e),e)}
  }
  for(let i=this.bullets.active.length-1;i>=0;i--)if(!this.bulletTick(this.bullets.active[i],dt))this.bullets.remove(i);
  if(this.status!=='fight')return;
  for(let i=es.length-1;i>=0;i--)if(es[i].hp<=0)this.enemies.remove(i);
  for(let i=this.drops.active.length-1;i>=0;i--){
   const d=this.drops.active[i],dd=d2(d,p);if(dd<19**2){this.collect(d);this.drops.remove(i);sound('pickup');continue}
   if(dd<(82+s.magnet)**2)d.pull=true;if(d.pull){const a=ang(d,p),v=390+Math.sqrt(dd)*2.2;d.x+=Math.cos(a)*v*dt;d.y+=Math.sin(a)*v*dt}
  }
  this.animate(dt);
  if(this.left<=0&&(this.wave<20||this.bossDead))this.finishWave();
 }
 animate(dt){
  for(let i=this.fx.active.length-1;i>=0;i--){const f=this.fx.active[i];f.life-=dt;if(f.kind==='blast'&&f.extra){const damage=f.extra;f.extra=0;this.grid.query(f.x,f.y,f.r,e=>{if(d2(f,e)<f.r*f.r)this.rawHit(e,damage,f.color,false)})}if(f.life<=0)this.fx.remove(i)}
 }
 finishWave(){
  this.bestWave=this.wave;
  this.gold+=14+this.wave*2+this.s.endcoin+Math.floor(this.gold*this.s.interest/100);
  this.status=this.wave===20?'won':'upgrade';this.options=null;
 }
 odds(){const l=this.s.luck,w=this.wave;const a=clamp(16+w*1.08+l*.34,12,51),b=clamp(w*1.05+l*.22-1,0,30),c=clamp(w*.34+l*.12-2,0,14);return [100-a-b-c,a,b,c]}
 quality(){let r=rnd(100);const odds=this.odds();for(let i=0;i<3;i++){r-=odds[i];if(r<0)return i}return 3}
 upgradeOptions(){if(!this.options){const keys=Object.keys(STATS);this.options=Array.from({length:4},()=>{const key=keys.splice(Math.floor(rnd(keys.length)),1)[0],q=this.quality();return {key,q,amount:Math.round(STATS[key][2]*MULT[q]*100)/100}})}return this.options}
 applyUpgrade(i){if(this.status!=='upgrade'||this.pending<=0||!this.options?.[i])return false;const o=this.options[i];this.mod({[o.key]:o.amount});this.options=null;this.pending--;return true}
 shop(){if(this.status!=='upgrade'||this.pending)return false;this.roll();this.status='shop';return true}
 roll(){
  this.offers=Array.from({length:4},(_,i)=>{
   const old=this.offers[i];if(old?.locked)return old;
   const q=this.quality();
   if(rnd(1)<.62||i===0){const owned=this.weapons.length&&rnd(1)<.29?pick(this.weapons):null;return {kind:'weapon',id:owned?.id??Math.floor(rnd(24)),q:owned&&q<2?owned.q:q,locked:false}}
   const pool=ITEMS.filter(item=>item.q<=q);return {kind:'item',id:pick(pool).id,q,locked:false};
  });
 }
 price(o){const cost=o.kind==='weapon'?17+o.id%7*2:ITEMS.find(x=>x.id===o.id).price;return Math.max(1,Math.round((cost*(1+o.q*.48)+this.wave*1.3)*(1-clamp(this.s.discount,0,55)/100)))}
 get refreshPrice(){return this.role===4&&!this.refreshes?0:Math.max(1,5+this.wave+this.refreshes*4-this.s.reroll)}
 refresh(){if(this.status!=='shop'||this.gold<this.refreshPrice||this.offers.every(o=>o?.locked))return false;this.gold-=this.refreshPrice;this.refreshes++;this.roll();return true}
 match(w,skip=-1){return w.q<3?this.weapons.findIndex((o,i)=>i!==skip&&o.id===w.id&&o.q===w.q):-1}
 buy(i){
  const o=this.offers[i];if(this.status!=='shop'||!o)return '商品已售出';
  const price=this.price(o), rebate=Math.floor(price*clamp(this.s.rebate,0,55)/100);if(this.gold<price)return '金币不足';
  if(o.kind==='weapon'){
   if(this.weapons.length>=6){const j=this.match(o);if(j<0)return '武器槽已满。请先出售或合成一把武器。';this.weapons[j].q++;this.fusions++}
   else this.weapons.push(weaponSlot(o.id,o.q));
   this.gotSix||=this.weapons.length===6;this.legend||=this.weapons.some(w=>w.q===3);
  }else{
   const item=ITEMS.find(x=>x.id===o.id);this.items[item.id]=(this.items[item.id]||0)+1;
   this.mod(Object.fromEntries(Object.entries(item.mods).map(([k,v])=>[k,Math.round(v*(1+o.q*.28)*100)/100])));
  }
  this.gold-=price-rebate;this.offers[i]=null;return '';
 }
 salePrice(w){return Math.round((8+w.q*8)*(1+this.s.salvage/100))}
 sell(i){const w=this.weapons[i];if(this.status!=='shop'||!w||this.weapons.length===1)return false;this.gold+=this.salePrice(w);this.weapons.splice(i,1);return true}
 merge(i){const w=this.weapons[i];if(this.status!=='shop'||!w)return false;const j=this.match(w,i);if(j<0)return false;w.q++;this.fusions++;this.legend||=w.q===3;this.weapons.splice(j,1);return true}
}