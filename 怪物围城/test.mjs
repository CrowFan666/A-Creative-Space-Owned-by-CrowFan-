import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const source=(await Promise.all(['data.js','engine.js'].map(name=>fs.readFile(new URL(name,import.meta.url),'utf8')))).join('\n');
const cases=[];
const register=(name,fn)=>cases.push([name,fn]);
const math=Object.create(Math);
let seed=28477;
math.random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
vm.runInNewContext(source+`
const idle=new Set();
const step=(game,n,keys=idle)=>{for(let i=0;i<n;i++)game.tick(1/60,keys)};
test('内容目录与分类',()=>{
 assert.equal(WEAPONS.length,24);
 assert.equal(ITEMS.length,60);
 assert.equal(new Set(ITEMS.map(item=>item.id)).size,60);
 assert.equal(ITEM_GROUPS.map(g=>g[1].length).join(),'14,12,10,8,10,6');
 assert.equal(ROLES.length,8);
 assert.equal(ENEMIES.length,14);
});
test('角色、斜向速度、敌人追踪、材料一次结算与等级',()=>{
 const g=new Game(0,1,6);g.start();
 assert.equal(g.p.hp,55);assert.equal(g.s.speed,231);
 const x=g.p.x,y=g.p.y;step(g,1,new Set(['KeyD','KeyS']));
 assert.ok(Math.abs(Math.hypot(g.p.x-x,g.p.y-y)-231/60)<.001);
 const e=g.spawn(0,g.p.x+140,g.p.y);e.age=1;const ex=e.x;step(g,1);assert.ok(e.x<ex);
 g.rawHit(e,100,'#fff');const drop=g.drops.active.at(-1);drop.x=g.p.x;drop.y=g.p.y;
 g.xp=g.threshold-drop.worth;const gold=g.gold;step(g,2);
 assert.equal(g.gold,gold+drop.worth);assert.equal(g.level,2);assert.equal(g.xp,0);assert.equal(g.pending,1);
 g.finishWave();const o=g.upgradeOptions()[0],before=g.s[o.key];
 assert.ok(g.applyUpgrade(0));assert.ok(Math.abs(g.s[o.key]-before-o.amount)<.001);assert.ok(g.shop());
});
test('摇杆的模拟力度、斜向限速与键盘优先',()=>{
 const g=new Game(0,1,6);g.start();
 const speed=g.s.speed/60;
 let {x,y}=g.p;g.tick(1/60,idle,.5,0);
 assert.ok(Math.abs(g.p.x-x-speed*.5)<.001);assert.equal(g.p.y,y);assert.equal(g.p.face,1);
 x=g.p.x;g.tick(1/60,idle,-1,1);
 assert.ok(Math.abs(Math.hypot(g.p.x-x,g.p.y-y)-speed)<.001);assert.equal(g.p.face,-1);
 x=g.p.x;y=g.p.y;g.tick(1/60,new Set(['KeyW']),1,0);
 assert.equal(g.p.x,x);assert.ok(Math.abs(g.p.y-y+speed)<.001);
 x=g.p.x;y=g.p.y;g.tick(1/60,idle,0,0);assert.equal(g.p.x,x);assert.equal(g.p.y,y);
});
test('随机商店、购买、跨波锁定、六槽合成和出售',()=>{
 const g=new Game(0,1,6);g.start();g.finishWave();g.shop();assert.equal(g.offers.length,4);
 g.gold=1000;g.offers[0].locked=true;const locked=g.offers[0];
 assert.ok(g.refresh());assert.equal(g.offers[0],locked);
 g.start();g.finishWave();g.shop();assert.equal(g.offers[0],locked);
 g.weapons=Array.from({length:6},()=>weaponSlot(6));g.offers[0]={kind:'weapon',id:7,q:0};
 let old=g.gold;assert.ok(g.buy(0));assert.equal(g.gold,old);assert.equal(g.weapons.length,6);
 g.offers[0]={kind:'weapon',id:6,q:0};assert.equal(g.buy(0),'');assert.equal(g.weapons.length,6);assert.equal(g.weapons[0].q,1);
 assert.ok(g.merge(1));assert.equal(g.weapons.length,5);assert.ok(g.sell(0));assert.equal(g.weapons.length,4);
 const before=g.s.crit;g.offers[0]={kind:'item',id:ITEMS[0].id,q:0};
 assert.equal(g.buy(0),'');assert.equal(g.s.crit,before+7);
 g.gold=0;g.offers[0]={kind:'weapon',id:6,q:0};assert.equal(g.buy(0),'金币不足');
});
test('角色被动、难度伤害、无敌帧、死亡和新局状态',()=>{
 const merchant=new Game(4,0,10);merchant.start();merchant.finishWave();merchant.shop();
 assert.equal(merchant.refreshPrice,0);assert.ok(merchant.refresh());assert.ok(merchant.refreshPrice>0);
 const armor=new Game(5,0,2);armor.start();const old=armor.p.hp;armor.playerHit(20);
 assert.equal(armor.p.hp,old);assert.equal(armor.p.shield,0);
 const g=new Game(0,2,6);g.start();g.playerHit(20);const hp=g.p.hp;
 assert.ok(Math.abs(hp-(55-20*1.23))<.001);g.playerHit(20);assert.equal(g.p.hp,hp);
 g.p.ifr=0;g.playerHit(300);step(g,50);assert.equal(g.status,'lost');
 const fresh=new Game(0,2,6);fresh.start();
 assert.equal(fresh.wave,1);assert.equal(fresh.gold,14);assert.equal(fresh.weapons.length,1);assert.equal(fresh.kills,0);
});
for(let id=0;id<24;id++)test('武器实伤 · '+WEAPONS[id].name,()=>{
 const g=new Game(0,1,id);g.start();g.spawnClock=99;g.s.hp=200;g.p.hp=200;
 const e=g.spawn(13,g.p.x+45,g.p.y);e.age=1;e.clock=99;e.max=e.hp=3000;
 step(g,120);assert.ok(e.hp<3000);
});
test('六把武器独立索敌并开火',()=>{
 const g=new Game(0,1,6);g.start();g.spawnClock=99;g.weapons=[6,7,8,9,10,11].map(id=>weaponSlot(id));
 g.spawn(13,g.p.x+170,g.p.y);step(g,1);
 assert.ok(g.weapons.every(w=>w.cd>0));assert.equal(new Set(g.bullets.active.map(b=>b.w.id)).size,6);
});
test('首领三阶段、预警及超时后的胜利条件',()=>{
 const g=new Game(0,1,6);g.wave=19;g.start();const e=g.enemies.active[0];
 e.age=2;e.clock=0;g.enemyTick(e,.016);assert.equal(e.action,'fan');assert.ok(e.wind>0);
 e.wind=0;e.hp=e.max*.55;e.clock=0;g.enemyTick(e,.016);assert.equal(e.stage,2);assert.equal(e.action,'charge');
 e.wind=0;e.hp=e.max*.2;e.clock=0;g.enemyTick(e,.016);assert.equal(e.stage,3);assert.ok(['fan','ring'].includes(e.action));
 g.left=0;step(g,1);assert.equal(g.status,'fight');
 g.rawHit(e,e.hp+1,'#fff');step(g,1);assert.equal(g.status,'won');
});
test('全 20 波计时、精英和胜利，使用强化测试配置',()=>{
 const g=new Game(0,1,6);
 g.s.hp=2000;g.p.hp=2000;g.s.damage=250;g.s.regen=70;
 g.weapons=[6,7,9,13,16,23].map(id=>weaponSlot(id,2));
 for(let w=1;w<=20;w++){
  g.start();assert.equal(g.wave,w);assert.equal(g.left,waveDuration(w));
  if([5,10,15,20].includes(w))assert.ok(g.enemies.active.some(e=>e.type===(w===20?13:12)));
  let ticks=0;
  while(g.status==='fight'&&ticks++<80*60)step(g,1);
  assert.equal(g.status,w===20?'won':'upgrade','第 '+w+' 波');
  assert.ok(ticks>=waveDuration(w)*60);
  if(w<20){while(g.pending){g.upgradeOptions();g.applyUpgrade(0)}assert.ok(g.shop())}
 }
 assert.ok(g.bossDead);
});
test('180 敌人同屏的战斗更新与对象池上限',()=>{
 const g=new Game(0,1,6);g.start();g.s.hp=10000;g.p.hp=10000;
 for(let i=0;i<220;i++)g.spawn(i%12,30+i%20*60,30+Math.floor(i/20)*50);
 assert.equal(g.enemies.active.length,180);step(g,240);assert.equal(g.status,'fight');
 assert.ok(g.enemies.active.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.hp)));
});
`,{test:register,assert,Math:math,sound:()=>{}});
let failed=0;
for(const [name,run] of cases){
 const start=performance.now();
 try{run();console.log('通过',name,Math.round(performance.now()-start)+'ms')}
 catch(error){failed++;console.error('失败',name,error.message)}
}
console.log(`${cases.length-failed}/${cases.length} 项通过`);
if(failed)process.exitCode=1;