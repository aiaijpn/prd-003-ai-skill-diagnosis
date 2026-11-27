import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate,score,session,workAdvice} from '../src/core.mjs';
const load=id=>validate(JSON.parse(readFileSync(new URL('../profiles/'+id+'.json',import.meta.url))),id);
const p=load('ai-skill');
const result=(...n)=>score(p,n.map(x=>'c'+x));
const sum=n=>result(...Array.from({length:10},(_,i)=>Math.min(2,Math.max(0,n-i*2))));
test('5章×2問、3択、レベル境界、未完了',()=>{
 assert.deepEqual(p.scoring.axes.map(a=>[a.label,p.questions.filter(q=>q.axis===a.id).length]),['試す','伝える','守る','残す','測る'].map(x=>[x,2]));
 assert.equal(score(p,['c1']),null);
 for(const [n,l] of [[0,'見習い'],[6,'見習い'],[7,'一人前'],[13,'一人前'],[14,'達人級'],[20,'達人級']]) assert.equal(sum(n).tier.label,l);
});
test('7タイプ、原石境界、達人の全軸条件',()=>{
 const names=['ひらめき冒険家','言葉の職人','信頼の番人','仕組みの建築家','成果の分析官'];
 for(let a=0;a<5;a++) assert.equal(result(...Array.from({length:10},(_,i)=>Math.floor(i/2)===a?2:0)).type.name,names[a]);
 assert.equal(sum(3).kind,'starter');assert.equal(sum(4).kind,'standard');
 assert.equal(result(2,2,2,2,2,1,2,1,2,1).type.name,'AI仕事術の達人');
 assert.equal(result(2,2,2,2,2,2,2,1,1,1).kind,'standard');
 assert.equal(result(2,2,2,1,2,1,2,1,2,1).kind,'standard');
});
test('同点の固定順と伸びしろ、満点、回答ごとの一歩',()=>{
 const x=result(1,1,1,1,1,1,1,1,1,1);
 assert.equal(x.high.label,'試す');assert.equal(x.low.label,'伝える');assert.match(workAdvice(x).action,/前の依頼/);
 assert.match(workAdvice(result(...Array(10).fill(0))).action,/下書き/);
 assert.match(workAdvice(result(...Array(10).fill(2))).growth,/すべて満点/);
 const onlyChecking=result(2,2,2,2,2,0,2,2,2,2);
 assert.match(workAdvice(onlyChecking).action,/利用ルール/);
});
test('旧版回答を混ぜない、回答復元、別題材の後方互換',()=>{
 const m=new Map();const storage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
 const a=session(p,storage,()=> 'one');a.data.step=1;a.data.answers=['c2'];a.save();
 assert.deepEqual(session(p,storage,()=> 'two').data.answers,['c2']);
 assert.deepEqual(session({...p,questionVersion:'v1'},storage,()=> 'three').data.answers,[]);
 const demo=load('demo-variant');const scored=score(demo,demo.questions.map(q=>q.choices[2].id));assert.equal(scored.total,6);assert.equal(scored.kind,'legacy');
});
