const fail = () => { throw new Error('品種設定が無効です。'); };
const str = x => typeof x === 'string' && x.trim().length > 0;
const id = x => str(x) && /^[a-z0-9-]+$/i.test(x);
const unique = xs => new Set(xs).size === xs.length;
export const blocks = ['strength','growth','feedback','cta-top','action','cta-bottom'];
export function validate(p, expected) {
  if (!p || p.schemaVersion !== 1 || p.productId !== expected || !id(p.productId) ||
      !id(p.questionVersion) || !id(p.copyId) || !str(p.brand?.name) ||
      !str(p.entry?.title) || !str(p.entry?.description) || !str(p.cta?.label) ||
      p.cta.url !== null || !Array.isArray(p.questions) || !p.questions.length ||
      p.resultBlocks?.join?.(',') !== blocks.join(',')) fail();
  const axes = p.scoring?.axes, tiers = p.scoring?.tiers;
  if (!Array.isArray(axes) || !axes.length || !axes.every(a => a && id(a.id) && str(a.label) && str(a.action)) || !unique(axes.map(a=>a.id))) fail();
  const maxima = new Map(axes.map(a=>[a.id,0]));
  if (!p.questions.every(q=>q && id(q.id) && maxima.has(q.axis) && str(q.label) &&
      Array.isArray(q.choices) && q.choices.length===3 &&
      q.choices.every((c,i)=>c && id(c.id) && c.points===i && str(c.label) && str(c.reason)) &&
      unique(q.choices.map(c=>c.id))) || !unique(p.questions.map(q=>q.id))) fail();
  for (const q of p.questions) maxima.set(q.axis,maxima.get(q.axis)+2);
  if ([...maxima.values()].some(n=>!n) || !Array.isArray(tiers) || !tiers.length) fail();
  let next=0;
  for (const t of tiers) {
    if (!t || t.min!==next || !Number.isInteger(t.max) || t.max<t.min || !str(t.label) || !str(t.description)) fail();
    next=t.max+1;
  }
  if (next!==p.questions.length*2+1) fail();
  return p;
}
export function score(p, answers) {
  const rows=p.questions.map((q,i)=>({q,c:q.choices.find(c=>c.id===answers[i])}));
  if(rows.some(r=>!r.c)) return null;
  const axes=p.scoring.axes.map(a=>{
    const items=rows.filter(r=>r.q.axis===a.id);
    return {...a,items,points:items.reduce((n,r)=>n+r.c.points,0),max:items.length*2};
  });
  const rate=(a,b)=>a.points*b.max-b.points*a.max;
  const total=axes.reduce((n,a)=>n+a.points,0);
  const high=total ? axes.reduce((a,b)=>rate(b,a)>0?b:a) : null;
  const low=axes.filter(a=>a.points<a.max).reduce((a,b)=>!a||rate(b,a)<0||
    (rate(b,a)===0 && a===high && b!==high)?b:a,null);
  const strength=high?.items.reduce((a,b)=>b.c.points>a.c.points?b:a)??null;
  const growth=low?.items.filter(r=>r.c.points<2).reduce((a,b)=>b.c.points<a.c.points?b:a)??null;
  return {total,strength,growth,axis:low??axes[0],tier:p.scoring.tiers.find(t=>total<=t.max)};
}
export function session(p, storage, fresh=()=>crypto.randomUUID()) {
  const key='prd003:'+p.productId;
  const events=new Set(['visit','start','question_view','answer','back','complete','result_block','feedback_rating','cta_click']);
  const initial=()=>({version:p.questionVersion,diagnosis:fresh(),step:-1,answers:[],events:[]});
  let data=initial(), available=true;
  try {
    const x=JSON.parse(storage.getItem(key));
    if(x?.version===p.questionVersion && str(x.diagnosis) && Number.isInteger(x.step) && x.step>=-1 &&
      x.step<=p.questions.length && Array.isArray(x.answers) && x.answers.length<=p.questions.length &&
      x.answers.every((id,i)=>p.questions[i].choices.some(c=>c.id===id)) &&
      x.answers.length>=x.step && Array.isArray(x.events)) {
      data={...x,events:x.events.filter(e=>e && events.has(e.name) && typeof e.time==='string')};
    }
  } catch { /* Corrupt or unavailable storage starts fresh. */ }
  const save=()=>{try{storage.setItem(key,JSON.stringify(data));available=true;}catch{available=false;}};
  function record(name,detail={},once=false) {
    if(!events.has(name))return;
    const {question,position,rating}=detail;
    if(once&&data.events.some(e=>e.name===name&&e.question===question&&e.position===position))return;
    data.events.push({name,productId:p.productId,questionVersion:p.questionVersion,copyId:p.copyId,
      diagnosis:data.diagnosis,time:new Date().toISOString(),question,position,rating});
    save();
  }
  return {get data(){return data;},get available(){return available;},record,save,
    reset(){try{storage.removeItem(key);}catch{} data=initial(); save();}};
}
