import fs from 'node:fs/promises';

const fromHere=name=>new URL(name,import.meta.url);
const files=['data.js','engine.js','render.js','ui.js'];
const keys=['cover','sprites','arena','icons'];
const art=Object.fromEntries(await Promise.all(keys.map(async key=>[
 key,'data:image/png;base64,'+(await fs.readFile(fromHere('assets/'+key+'.png'))).toString('base64')
])));
const style=await fs.readFile(fromHere('style.css'),'utf8');
let html=await fs.readFile(fromHere('index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>\n'+style+'\n</style>');
html=html.replace('<script src="data.js"></script>','<script>window.SIEGE_ASSETS='+JSON.stringify(art)+'</script>\n<script src="data.js"></script>');
for(const name of files){
 const js=await fs.readFile(fromHere(name),'utf8');
 html=html.replace('<script src="'+name+'"></script>',()=>'<script>\n'+js.replace(/<\/script/gi,'<\\/script')+'\n</script>');
}
const output=process.argv[2]??'怪物围城.html';
await fs.writeFile(output,html);
console.log('已生成 '+output+' · '+Buffer.byteLength(html)+' 字节');