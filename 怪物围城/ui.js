'use strict';
const $=s=>document.querySelector(s);
const screen=$('#screen'), arena=$('#arena'), hud=$('#hud'), footer=$('#combat-footer'), bossHud=$('#boss'), notice=$('#wave-notice'), toast=$('#toast');
const STORE='monster-siege-v1';
const defaults={best:0,kills:0,wins:0,unlocked:[0,1,2,3,4,5,6,7],difficulties:[0,1],badges:[],settings:{music:.37,sfx:.64,shake:true,numbers:true}};
function readSave(){
 try{const d=JSON.parse(localStorage.getItem(STORE)||'null');if(!d)return structuredClone(defaults);return {...structuredClone(defaults),...d,settings:{...defaults.settings,...d.settings}}}
 catch{return structuredClone(defaults)}
}
let save=readSave(),prefs=save.settings,g=null,page='home',role=0,difficulty=1,initial=ROLES[0][3],shopTab='shop',chosenSlot=0,backPage='home',oldStatus='',toastTimer;
const keys=new Set;
const touchControls=$('#touch-controls'), joystick=$('#joystick'), knob=$('#stick-knob');
const stick={pointer:null,x:0,y:0,cx:0,cy:0,radius:1};
function updateStick(e){
 const x=e.clientX-stick.cx, y=e.clientY-stick.cy, distance=Math.hypot(x,y);
 const limit=Math.min(distance,stick.radius), direction=distance||1;
 const strength=clamp((limit/stick.radius-.13)/.87,0,1);
 stick.x=x/direction*strength;stick.y=y/direction*strength;
 knob.style.transform='translate('+x/direction*limit+'px,'+y/direction*limit+'px)';
}
function releaseStick(){
 const pointer=stick.pointer;
 stick.pointer=null;stick.x=0;stick.y=0;
 joystick.classList.remove('engaged');knob.style.transform='';
 if(pointer!==null&&joystick.hasPointerCapture(pointer))joystick.releasePointerCapture(pointer);
}
joystick.addEventListener('pointerdown',e=>{
 if(page!=='fight'||g.status!=='fight'||stick.pointer!==null||e.button!==0)return;
 const bounds=joystick.getBoundingClientRect();
 stick.cx=bounds.left+bounds.width/2;stick.cy=bounds.top+bounds.height/2;stick.radius=bounds.width*.32;
 joystick.setPointerCapture(e.pointerId);
 stick.pointer=e.pointerId;joystick.classList.add('engaged');updateStick(e);
});
joystick.addEventListener('pointermove',e=>{if(e.pointerId===stick.pointer)updateStick(e)});
for(const event of ['pointerup','pointercancel','lostpointercapture']){
 joystick.addEventListener(event,e=>{if(e.pointerId===stick.pointer)releaseStick()});
}
function clearInput(){keys.clear();releaseStick()}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(save))}catch{}}
function updateRecord(){
 if(!g)return;
 save.best=Math.max(save.best,g.bestWave);save.kills=Math.max(save.kills,g.kills);
 const record={first:g.kills>=30,five:g.bestWave>=5,ten:g.bestWave>=10,fifteen:g.bestWave>=15,win:g.status==='won',normal:g.status==='won'&&g.diff>=1,hard:g.status==='won'&&g.diff===2,fusion:g.fusions>0,six:g.gotSix,legend:g.legend};
 for(const [k,v] of Object.entries(record))if(v&&!save.badges.includes(k))save.badges.push(k);
 if(record.normal&&!save.difficulties.includes(2))save.difficulties.push(2);
 if(record.win&&!g.winSaved){save.wins++;g.winSaved=true}
 persist();
}
const asset=s=>ASSET[s]||'';
for(const [key,property,width] of [['cover','--cover',1440],['sprites','--sprite-atlas',640],['icons','--item-atlas',768]]){
 const src=asset(key),img=art[key];
 if(!src||!img)continue;
 const setBackground=url=>document.documentElement.style.setProperty(property,'url("'+url+'")');
 if(!src.startsWith('data:')){setBackground(src);continue}
 const resize=()=>{
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=Math.round(width*img.naturalHeight/img.naturalWidth);
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  setBackground(canvas.toDataURL('image/webp',.9));
 };
 if(ready(img))resize();else img.addEventListener('load',resize,{once:true});
}
function icon(i,fallback,color){
 return '<span aria-hidden="true" class="icon" style="--ic:'+color+';--col:'+(i%6)*20+'%;--row:'+Math.floor(i/6)*25+'%"><i>'+fallback+'</i></span>';
}
function roleArt(i){return '<span aria-hidden="true" class="portrait" style="--col:'+(i%4)*100/3+'%;--row:'+Math.floor(i/4)*100/3+'%"></span>'}
function btn(action,label,cls='',disabled=false){return '<button type="button" data-act="'+action+'" class="'+cls+'" '+(disabled?'disabled':'')+'>'+label+'</button>'}
const money=(value)=>'<span class="money"><b>◈</b> '+fmt(value)+'</span>';
const section=(title,sub,body,actions='')=>'<div class="panel"><header class="panel-head"><div><h1>'+title+'</h1><p>'+sub+'</p></div>'+actions+'</header>'+body+'</div>';
const back=(target='home')=>btn(target,'← 返回','ghost');
const pad=n=>String(n).padStart(2,'0');
const clock=n=>pad(Math.floor(Math.ceil(n)/60))+':'+pad(Math.ceil(n)%60);
const getItem=id=>ITEMS.find(x=>x.id===id);
function attrPanel(){
 return '<aside class="stats"><h3>当前属性</h3><div class="stat-list">'+Object.keys(STATS).map(k=>'<div><span>'+label(k)+'</span><strong>'+statText(k,g.s[k])+'</strong></div>').join('')+'</div></aside>';
}
function slots(interactive=false){
 return '<div class="slots">'+Array.from({length:6},(_,i)=>{
  const w=g.weapons[i],d=w&&WEAPONS[w.id];
  const info=d?d.name+' · '+Q[w.q]:'空槽';
  const inside='<small>'+pad(i+1)+'</small>'+(d?icon(d.id,d.icon,d.color):'<span class="empty">＋</span>')+(interactive?'<span class="slot-name">'+info+'</span>':'');
  const style=w?'--quality:'+QC[w.q]:'';
  return interactive?'<button type="button" title="'+info+'" data-act="slot:'+i+'" class="slot '+(chosenSlot===i?'selected':'')+'" style="'+style+'" '+(!w?'disabled':'')+'>'+inside+'</button>':'<div title="'+info+'" class="slot" style="'+style+'">'+inside+'</div>';
 }).join('')+'</div>';
}
function weaponStats(d,q){
 const category=label(d.type);
 return '<span class="meta">'+category+' · 基础伤害 '+fmt(d.damage*MULT[q])+' · '+fmt(d.cd/(1+q*.09))+' 秒 · 射程 '+d.reach+'</span>';
}
function itemChanges(item,q){return Object.entries(item.mods).map(([k,v])=>[k,Math.round(v*(1+q*.28)*100)/100])}
function itemPreview(item,q){return itemChanges(item,q).map(([k,v])=>'<span>'+label(k)+' <b>'+statText(k,g.s[k])+' → '+statText(k,k==='hp'?Math.max(10,g.s[k]+v):g.s[k]+v)+'</b></span>').join('')}
function offers(){
 return '<div class="offers">'+g.offers.map((o,i)=>{
  if(!o)return '<div class="offer sold"><span>✓</span>已售出</div>';
  const w=o.kind==='weapon',d=w?WEAPONS[o.id]:getItem(o.id),price=g.price(o),at=ITEM_GROUPS.findIndex(x=>x[0]===d.group);
  return '<article class="offer" style="--quality:'+QC[o.q]+'"><div class="offer-top"><span class="quality">'+Q[o.q]+'</span>'+btn('lock:'+i,o.locked?'已锁定':'锁定','lock '+(o.locked?'locked':''))+'</div>'+
  '<div class="offer-art">'+icon(w?d.id:24+at,d.icon,d.color)+'</div><h3>'+d.name+'</h3><p>'+ (w?d.desc:d.group+' · 同名效果可叠加')+'</p>'+
  (w?weaponStats(d,o.q):'<div class="preview">'+itemPreview(d,o.q)+'</div>')+
  '<div class="offer-actions">'+btn('detail:'+i,'详情','ghost')+btn('buy:'+i,'购买 '+money(price),'primary',g.gold<price)+'</div></article>';
 }).join('')+'</div>';
}
function shopView(){
 const w=g.weapons[chosenSlot],d=w&&WEAPONS[w.id];
 const equipped='<section class="equip"><div class="section-title"><h3>当前装备 <span>'+g.weapons.length+'/6</span></h3>'+btn(shopTab==='shop'?'gear':'shopview',shopTab==='shop'?'装备管理':'返回商品','ghost')+'</div>'+slots(true)+'</section>';
 const main=shopTab==='shop'?offers():'<div class="gear-body"><div class="gear-card">'+(d?'<div class="gear-icon">'+icon(d.id,d.icon,d.color)+'</div><div><span style="color:'+QC[w.q]+'">'+Q[w.q]+'</span><h2>'+d.name+'</h2><p>'+d.desc+'</p>'+weaponStats(d,w.q)+'<div class="row">'+btn('sell','出售 '+money(g.salePrice(w)),'ghost',g.weapons.length===1)+btn('merge','合成至 '+(Q[w.q+1]||'最高品质'),'primary',g.match(w,chosenSlot)<0)+'</div></div>':'请选择武器')+'</div><div class="owned"><h3>持有道具</h3>'+(Object.keys(g.items).length?Object.entries(g.items).map(([id,n])=>'<span title="'+effects(getItem(+id).mods)+'">'+getItem(+id).name+' ×'+n+'</span>').join(''):'<p>暂未购买道具</p>')+'</div></div>';
 return section('补给商店','第 '+pad(g.wave)+' 波已完成', '<div class="shop-layout"><div>'+main+equipped+'</div>'+attrPanel()+'</div><div class="panel-bottom"><div>'+btn('refresh','⟳ 刷新 · '+(g.refreshPrice?money(g.refreshPrice):'免费'),'ghost',g.gold<g.refreshPrice||g.offers.every(o=>o?.locked))+'<p class="odds">'+g.odds().map((n,i)=>'<span style="color:'+QC[i]+'">'+Q[i]+' '+n.toFixed(1)+'%</span>').join('')+'</p></div>'+btn('next','进入第 '+pad(g.wave+1)+' 波　→','primary large')+'</div>',money(g.gold));
}
function menu(){
 return '<div class="home"><header class="brand"><span class="emblem"><i></i></span><span>怪物围城</span><div class="brand-best">最高防线 <b>'+pad(save.best)+' / 20</b></div></header><div class="home-body"><div class="title-mark"><span></span><span></span><span></span></div><h1>怪物<span>围城</span></h1><p class="home-sub">废土竞技场 · 波次生存</p><p class="pitch">收集材料，拼装六把武器。<br>在废铁堆里守住二十波攻势。</p><div class="menu">'+btn('roles','<span>▶</span> 开始游戏 <b>→</b>','primary large')+'<div class="menu-secondary">'+btn('ach','◈　成就','ghost')+btn('settings','⚙　设置','ghost')+'</div></div></div><footer class="home-footer"><div class="keyboard-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动</span><kbd>ESC</kbd><span>暂停</span></div><div class="touch-help">拖动摇杆移动 · 点击右上角暂停</div><span>自动攻击</span></footer></div>';
}
function roleView(){
 const r=ROLES[role];
 return section('选择角色','决定本局的属性与专属能力','<div class="role-grid">'+ROLES.map(([name,job,_,__,___,color],i)=>btn('role:'+i,roleArt(i)+'<strong>'+name+'</strong><small>'+job+'</small>','role '+(role===i?'selected':''),!save.unlocked.includes(i)).replace('type="button"','type="button" style="--role:'+color+'"')).join('')+'</div><div class="role-info"><div><h2>'+r[0]+'</h2><p>'+effects(r[2])+'</p><p class="accent">'+r[4]+'</p></div><label>初始武器<select id="starter">'+[...new Set([r[3],0,3,6,7,15,20])].map(i=>'<option value="'+i+'" '+(initial===i?'selected':'')+'>'+WEAPONS[i].name+(i===r[3]?' · 推荐':'')+'</option>').join('')+'</select><small>'+WEAPONS[initial].desc+'</small></label></div><div class="panel-bottom">'+back()+btn('difficulty','选择难度　→','primary large')+'</div>');
}
function diffView(){
 const descriptions=['敌人生命和伤害较低，适合熟悉武器构筑。','标准围城强度。通关后解锁困难难度。','更密集的敌群，更高的敌人生命和伤害。'];
 return section('选择难度',ROLES[role][0]+' · 初始武器 '+WEAPONS[initial].name,'<div class="diff-grid">'+DIFF.map(([name,rate,hp,dmg],i)=>btn('diff:'+i,'<span class="diff-symbol">'+['◈','◈ ◈','◈ ◈ ◈'][i]+'</span><strong>'+name+'</strong><p>'+descriptions[i]+'</p><small>生命 '+Math.round(hp*100)+'% · 伤害 '+Math.round(dmg*100)+'%'+(save.difficulties.includes(i)?'':' · 未解锁')+'</small>','diff '+(i===difficulty?'selected':''),!save.difficulties.includes(i))).join('')+'</div><div class="panel-bottom">'+back('roles')+btn('start','进入竞技场　→','primary large')+'</div>');
}
function upgradeView(){
 const options=g.pending?g.upgradeOptions():[];
 return section(g.pending?'属性强化':'守住了防线','第 '+pad(g.wave)+' 波完成 · 等级 '+g.level+' · 剩余强化 '+g.pending,
 '<div class="shop-layout"><div><div class="offers">'+options.map((o,i)=>'<div class="offer upgrade" style="--quality:'+QC[o.q]+'"><span class="quality">'+Q[o.q]+'</span><div class="upgrade-mark">✚</div><h3>'+label(o.key)+'</h3><p class="gain">+'+statText(o.key,o.amount)+'</p><p>'+statText(o.key,g.s[o.key])+' → '+statText(o.key,g.s[o.key]+o.amount)+'</p>'+btn('upgrade:'+i,'选择强化','primary')+'</div>').join('')+'</div>'+(options.length?'':'<div class="wave-clear"><b>✓</b><h2>第 '+pad(g.wave)+' 波完成</h2><p>前往商店补给，为下一波做好准备。</p></div>')+'</div>'+attrPanel()+'</div><div class="panel-bottom"><span></span>'+btn('shop','前往补给商店　→','primary large',g.pending>0)+'</div>',money(g.gold));
}
function result(win){
 return section(win?'围城终结':'防线失守',win?'失控机械核心已摧毁':'下一次，带上更强的装备。','<div class="result"><span class="result-icon">'+(win?'✦':'⬡')+'</span><div class="result-grid"><div><strong>'+pad(g.bestWave)+' / 20</strong><span>完成波次</span></div><div><strong>'+g.kills+'</strong><span>击杀数量</span></div><div><strong>'+g.level+'</strong><span>最终等级</span></div><div><strong>'+DIFF[g.diff][0]+'</strong><span>挑战难度</span></div></div><div class="row">'+btn('home','返回主菜单','ghost')+btn('retry','再次挑战　→','primary large')+'</div></div>');
}
function view(){
 arena.hidden=!(g&&['fight','paused','dying'].includes(g.status));
 touchControls.hidden=page!=='fight'||g.status!=='fight';
 if(touchControls.hidden)releaseStick();
 screen.className=page==='home'?'home-screen':page==='fight'?'no-screen':g?.status==='paused'?'overlay':'intermission';
 if(page==='home')screen.innerHTML=menu();
 if(page==='roles')screen.innerHTML=roleView();
 if(page==='difficulty')screen.innerHTML=diffView();
 if(page==='fight')screen.innerHTML='';
 if(page==='upgrade')screen.innerHTML=upgradeView();
 if(page==='shop')screen.innerHTML=shopView();
 if(page==='pause')screen.innerHTML='<div class="modal"><h1>战斗暂停</h1><p>第 '+pad(g.wave)+' 波 · 剩余 '+clock(g.left)+'</p>'+btn('resume','继续游戏','primary large')+btn('settings','设置','ghost')+btn('retry','重新开始','ghost')+btn('home','退出至主菜单','ghost')+'</div>';
 if(page==='settings')screen.innerHTML=section('设置','设置会自动保存在此浏览器','<div class="setting-list">'+[['music','背景音乐'],['sfx','游戏音效']].map(([k,name])=>'<label><span>'+name+'</span><input type="range" name="'+k+'" min="0" max="100" value="'+Math.round(prefs[k]*100)+'"><output>'+Math.round(prefs[k]*100)+'%</output></label>').join('')+[['shake','屏幕震动'],['numbers','伤害数字']].map(([k,name])=>'<label><span>'+name+'</span><input type="checkbox" name="'+k+'" '+(prefs[k]?'checked':'')+'></label>').join('')+'</div><div class="panel-bottom">'+back('backsettings')+'</div>');
 if(page==='ach')screen.innerHTML=section('成就','已完成 '+save.badges.length+' / '+ACH.length+' · 最高通关波次 '+save.best+' · 单局最高击杀 '+save.kills+' · 通关 '+save.wins+' 次','<div class="ach-list">'+ACH.map(([k,title,desc])=>'<article class="'+(save.badges.includes(k)?'earned':'')+'"><span>'+(save.badges.includes(k)?'✦':'◇')+'</span><div><h3>'+title+'</h3><p>'+desc+'</p></div></article>').join('')+'</div><div class="panel-bottom">'+back()+'</div>');
 if(page==='lost'||page==='won')screen.innerHTML=result(page==='won');
 if(page==='fight')updateHud(true);
}
function change(pageName){page=pageName;view()}
function notify(msg){toast.textContent=msg;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2400)}
function detail(i){
 const o=g.offers[i];if(!o)return;
 const w=o.kind==='weapon',d=w?WEAPONS[o.id]:getItem(o.id);
 screen.insertAdjacentHTML('beforeend','<div class="detail-overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="商品详情"><span style="color:'+QC[o.q]+'">'+Q[o.q]+'</span><h2>'+d.name+'</h2><p>'+(w?d.desc:d.group+' · 可重复购买，效果叠加')+'</p>'+(w?weaponStats(d,o.q)+'<p>弹丸 '+d.count+' · 穿透 '+d.pierce+' · 击退 '+d.kick+' · 额外暴击 '+d.crit+'%</p>':'<div class="preview">'+itemPreview(d,o.q)+'</div>')+btn('close-detail','关闭详情','primary')+'</div></div>');screen.querySelector('.detail-overlay button').focus();
}
function launch(retry=false){
 if(retry&&g){role=g.role;difficulty=g.diff;initial=g.initial}
 updateRecord();clearInput();g=new Game(role,difficulty,initial);g.initial=initial;g.start();oldStatus='fight';chosenSlot=0;shopTab='shop';change('fight');
}
function pause(){
 if(!g)return;
 if(page==='fight'&&g.status==='fight'){clearInput();g.status='paused';oldStatus='paused';change('pause')}
 else if(page==='pause'){g.status='fight';oldStatus='fight';change('fight')}
}
function updateHud(full=false){
 if(full){
  hud.innerHTML='<div class="hud-life">'+roleArt(g.role)+'<div><span>生命 <b id="hptext"></b></span><div class="meter health"><i id="hpbar"></i></div></div></div><div class="wave-label">波次 <strong>'+pad(g.wave)+'</strong><small> / 20</small><span id="timer"></span></div><div class="hud-right"><span id="coins"></span>'+btn('pause','Ⅱ','pause-btn').replace('type="button"','type="button" aria-label="暂停"')+'</div>';
  footer.innerHTML='<div class="hud-xp"><span>等级 <b id="level"></b><small id="xptext"></small></span><div class="meter"><i id="xpbar"></i></div></div>'+slots();
 }
 $('#hptext').textContent=Math.ceil(g.p.hp)+' / '+g.s.hp+(g.p.shield?' ◈ '+g.p.shield:'');$('#hpbar').style.width=clamp(g.p.hp/g.s.hp*100,0,100)+'%';
 $('#timer').textContent=g.wave===20&&g.left===0?'歼灭核心':clock(g.left);
 $('#coins').textContent='◈ '+fmt(g.gold);$('#level').textContent=pad(g.level);
 $('#xptext').textContent=g.xp+' / '+g.threshold+(g.pending?' · '+g.pending+' 次待强化':'');
 $('#xpbar').style.width=g.xp/g.threshold*100+'%';
 const boss=g.enemies.active.find(e=>e.type===13&&e.hp>0);
 bossHud.innerHTML=boss?'<span>失控机械核心 · 阶段 '+boss.stage+'</span><div class="meter health"><i style="width:'+boss.hp/boss.max*100+'%"></i></div>':'';
 const headline=g.wave===20?'失控机械核心':[5,10,15].includes(g.wave)?'精英来袭':'第 '+pad(g.wave)+' 波';
 notice.textContent=g.elapsed<1.8?headline:'';notice.style.opacity=Math.min(1,Math.max(0,(1.8-g.elapsed)*2));
}
document.addEventListener('click',e=>{
 const button=e.target.closest('button[data-act]');if(!button||button.disabled)return;
 const [action,arg]=button.dataset.act.split(':'),i=Number(arg);initAudio();sound('click');
 switch(action){
  case 'home':updateRecord();g=null;clearInput();change('home');break;
  case 'roles':case 'difficulty':case 'ach':change(action);break;
  case 'role':role=i;initial=ROLES[i][3];view();break;
  case 'diff':difficulty=i;view();break;
  case 'settings':backPage=page;change('settings');break;
  case 'backsettings':change(backPage);break;
  case 'start':launch();break;
  case 'retry':launch(true);break;
  case 'pause':case 'resume':pause();break;
  case 'upgrade':if(g.applyUpgrade(i))view();break;
  case 'shop':if(g.shop()){shopTab='shop';chosenSlot=0;change('shop')}break;
  case 'shopview':shopTab='shop';view();break;
  case 'gear':shopTab='gear';view();break;
  case 'slot':chosenSlot=i;shopTab='gear';view();break;
  case 'lock':if(g.offers[i]){g.offers[i].locked=!g.offers[i].locked;view()}break;
  case 'refresh':if(g.refresh()){shopTab='shop';view()}break;
  case 'detail':detail(i);break;
  case 'close-detail':screen.querySelector('.detail-overlay')?.remove();break;
  case 'buy':{const error=g.buy(i);if(error)notify(error);else{updateRecord();view()}break}
  case 'sell':if(g.sell(chosenSlot)){chosenSlot=Math.min(chosenSlot,g.weapons.length-1);view()}break;
  case 'merge':if(g.merge(chosenSlot)){chosenSlot=Math.min(chosenSlot,g.weapons.length-1);updateRecord();notify('武器合成成功');view()}break;
  case 'next':if(g.status==='shop'){clearInput();g.start();oldStatus='fight';change('fight')}break;
 }
});
document.addEventListener('change',e=>{if(e.target.id==='starter'){initial=Number(e.target.value);view();$('#starter')?.focus()}});
document.addEventListener('input',e=>{
 const t=e.target;if(!Object.hasOwn(prefs,t.name))return;
 if(t.type==='range'){prefs[t.name]=+t.value/100;t.nextElementSibling.value=t.value+'%'}else prefs[t.name]=t.checked;
 audioSettings();persist();
});
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'&&!e.repeat){
  const modal=screen.querySelector('.detail-overlay');
  if(modal)modal.remove();else if(page==='settings')change(backPage);else pause();
 }
 if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)&&page==='fight'){e.preventDefault();keys.add(e.code)}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',clearInput);
window.addEventListener('resize',releaseStick);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&page==='fight')pause()});
let last=0,acc=0,uiWait=0;
function frame(now){
 const real=last?Math.min(.06,(now-last)/1000):0;last=now;
 if(g){
  if(page==='fight'){
   acc+=real;while(acc>=1/60){g.tick(1/60,keys,stick.x,stick.y);acc-=1/60}
   if(oldStatus!==g.status){oldStatus=g.status;if(g.status==='dying'){touchControls.hidden=true;clearInput()}if(['upgrade','lost','won'].includes(oldStatus)){updateRecord();if(oldStatus!=='lost')sound('clear');change(oldStatus)}}
   if(page==='fight'){uiWait-=real;if(uiWait<=0){updateHud();uiWait=.11}}
  }else acc=0;
  if(!arena.hidden)drawGame(g);
 }
 music(page==='fight'||page==='shop'||page==='upgrade');
 requestAnimationFrame(frame);
}
const iconsLoaded=()=>document.documentElement.classList.add('icons-loaded');
if(ready(art.icons))iconsLoaded();else art.icons?.addEventListener('load',iconsLoaded);
view();requestAnimationFrame(frame);