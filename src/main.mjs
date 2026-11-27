import {createView,element} from './view.mjs';
import {validate,score,session} from './core.mjs';
const root=document.querySelector('#app');
async function json(path){
  const r=await fetch(path,{mode:'same-origin',cache:'no-store',redirect:'error'});
  if(!r.ok)throw Error('読込み失敗');
  return r.json();
}
async function boot(){
  const index=await json('./profiles/catalog.json');
  const product=new URLSearchParams(location.search).get('product')??index.default;
  if(!/^[a-z0-9-]+$/.test(product)||!Array.isArray(index.approved)||!index.approved.includes(product))throw Error('未承認品種');
  const p=validate(await json('./profiles/'+product+'.json'),product);
  let storage;
  try{storage=localStorage;}catch{}
  const run=session(p,storage), n=p.questions.length;
  let pending=false,timer;
  const event=(...args)=>run.record(...args);
  const target=()=>run.data;
  const start=()=>{target().step=0;event('start');render();};
  const choose=id=>{
    const d=target(), q=p.questions[d.step];
    if(pending||!q?.choices.some(c=>c.id===id))return;
    d.answers[d.step]=id;
    event('answer',{question:q.id});
    if(d.step===n-1){d.step=n;run.save();render();return;}
    pending=true;
    root.querySelectorAll('[aria-pressed]').forEach((b,i)=>b.setAttribute('aria-pressed',String(q.choices[i].id===id)));
    timer=setTimeout(()=>{pending=false;d.step++;run.save();render();},300);
  };
  function back(){
    clearTimeout(timer);pending=false;
    const d=target();
    if(d.step>=0){event('back',{question:p.questions[d.step]?.id});d.step--;run.save();render();}
  }
  function render(focus=true){
    const d=target(), q=p.questions[d.step];
    let model;
    if(d.step<0)model={screen:'entry',title:p.entry.title,description:p.entry.description};
    else if(q){
      event('question_view',{question:q.id},true);
      model={screen:'question',title:q.label,position:d.step+1,total:n,choices:q.choices,selected:d.answers[d.step]};
    } else {
      const r=score(p,d.answers);
      if(!r){d.step=-1;run.save();render();return;}
      event('complete',{},true);
      const evidence=x=>`${x.q.label} 「${x.c.label}」 — ${x.c.reason}`;
      const cta={title:p.cta.label,body:'LINEは未設定です。登録なしで結果と行動を確認できます。',buttons:[{label:p.cta.label,disabled:true}]};
      const last=d.events.filter(e=>e.name==='feedback_rating').at(-1)?.rating;
      const byId={
        strength:{title:'強み',body:r.strength?evidence(r.strength):'今回の回答では強みを特定していません。'},
        growth:{title:'伸びしろ',body:r.growth?evidence(r.growth):`不足はありません。次の検証候補は「${r.axis.label}」です。`},
        feedback:{title:'結果は役に立ちましたか？（任意）',buttons:[1,2,3,4,5].map(rating=>({
          label:`${rating} / 5`,pressed:rating===last,action:()=>{event('feedback_rating',{rating});render(false);root.querySelectorAll('[aria-pressed]')[rating-1]?.focus();}
        }))},
        'cta-top':cta,action:{title:'最初の一歩（5〜10分）',body:r.axis.action},'cta-bottom':cta
      };
      model={screen:'result',title:r.tier.label,summary:`${r.tier.description}（${r.total} / ${n*2} 点）`,blocks:p.resultBlocks.map(position=>{
        event('result_block',{position},true);return byId[position];
      })};
    }
    createView(root,model,{start,choose,back,reset(){run.reset();event('visit',{},true);render();}},focus);
    if(!run.available)root.append(element('p','回答を端末に保存できないため、この画面内だけで続けます。',{role:'status'}));
  }
  event('visit',{},true);
  render();
}
boot().catch(()=>root.replaceChildren(element('h1','診断を表示できません'),element('p','承認済みの品種設定を確認してください。')));
