import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
class El {
 constructor(tag,textContent=null){this.tag=tag;this.attrs={};this.children=[];this.listeners={};this.textContent=textContent;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,f){this.listeners[k]=f;}
 get all(){return this.children.flatMap(n=>[n,...n.all]);}
 get text(){return [this.textContent,...this.children.map(n=>n.text)].filter(Boolean).join(' ');}
 querySelectorAll(sel){return sel==='[aria-pressed]'?this.all.filter(n=>'aria-pressed' in n.attrs):sel==='.rating button'?this.all.find(n=>n.attrs.class==='rating')?.children??[]:[];}
 focus(){}
}
test('入口→10問→結果。章・根拠・一歩・評価を表示し、LINE未設定は非表示',async()=>{
 const root=new El('main'),m=new Map();
 globalThis.location={search:''};globalThis.document={querySelector:()=>root,createElement:t=>new El(t)};
 globalThis.localStorage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 const paths=[];
 globalThis.fetch=async u=>{paths.push(u);return {ok:true,json:async()=>JSON.parse(readFileSync(new URL('../'+u,import.meta.url),'utf8'))};};
 const set=globalThis.setTimeout;globalThis.setTimeout=(f)=>{queueMicrotask(f);return 0;};
 try {
  await import('../src/main.mjs');
  for(let i=0;i<15&&!root.text.includes('診断を始める');i++) await Promise.resolve();
  assert.match(root.text,/全10問・登録不要/);
  const click=(label)=>{const n=root.all.find(n=>n.tag==='button'&&n.textContent===label);assert.ok(n,label);n.listeners.click();};
  click('診断を始める');assert.match(root.text,/第1章 · 試す/);
  for(let i=0;i<10;i++){
   assert.equal(root.attrs['data-screen'],'question');
   root.querySelectorAll('[aria-pressed]')[1].listeners.click();
   await Promise.resolve();
   if(i===0){click('戻る');assert.equal(root.querySelectorAll('[aria-pressed]')[1].attrs['aria-pressed'],'true');root.querySelectorAll('[aria-pressed]')[1].listeners.click();await Promise.resolve();}
   if(i===1)assert.match(root.text,/第2章 · 伝える/);
  }
  assert.equal(root.attrs['data-screen'],'result');assert.match(root.text,/ひらめき冒険家/);
  assert.match(root.text,/一人前.*10 \/ 20点/);assert.match(root.text,/5つの力/);
  assert.match(root.text,/伸びしろ · 伝える/);assert.match(root.text,/最初の一歩/);assert.doesNotMatch(root.text,/LINE|次の検証候補/);
  click('一部当たっている');
  assert.equal(root.querySelectorAll('.rating button')[1].attrs['aria-pressed'],'true');
  assert.deepEqual(paths,['./profiles/catalog.json','./profiles/ai-skill.json']);
 } finally { globalThis.setTimeout=set; }
});
