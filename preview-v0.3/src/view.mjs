export function element(tag, label, attrs = {}) {
  const node = document.createElement(tag);
  if (label != null) node.textContent = label;
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value));
  return node;
}
function button(label, action, attrs) {
  const node = element('button',label,{type:'button', ...attrs});
  node.addEventListener('click',action);
  return node;
}
export function createView(root, model, actions, focus = true) {
  const heading = element('h1',model.title,{tabindex:-1});
  root.setAttribute('data-screen',model.screen);
  root.replaceChildren(heading);
  const add = (...nodes) => root.append(...nodes);
  if (model.screen === 'entry') {
    add(element('p',model.description),element('p',`全${model.total}問・登録不要`,{class:'meta'}),button('診断を始める',actions.start,{class:'primary'}));
  } else if (model.screen === 'question') {
    const progress = element('progress',null,{value:model.position,max:model.total,'aria-label':`進捗 ${model.position}／${model.total}`});
    const choices = element('div',null,{class:'choices',role:'group','aria-label':'選択肢'});
    for (const item of model.choices) {
      choices.append(button(item.label,() => actions.choose(item.id),{'aria-pressed':item.id === model.selected}));
    }
    const meter=element('div',null,{class:'meter'});
    meter.append(element('p',`Q${String(model.position).padStart(2,'0')} / ${model.total}`,{class:'meta'}),progress);
    root.replaceChildren(meter,heading,choices,button('戻る',actions.back,{class:'quiet'}));
  } else if (model.screen === 'result') {
    add(element('p',model.summary),element('p',model.points,{class:'meta'}));
    for (const block of model.blocks) {
      const section = element('section',null,{class:'result-block'});
      section.append(element('h2',block.title));
      if (block.body) section.append(element('p',block.body));
      if (block.buttons?.length) {
        const group = element('div',null,{class:'rating',role:'group','aria-label':block.title});
        for (const item of block.buttons) {
          group.append(button(item.label,item.action,item.disabled ? {disabled:''} :
            item.pressed === undefined ? {} : {'aria-pressed':item.pressed}));
        }
        section.append(group);
      }
      add(section);
    }
    add(button('回答に戻る',actions.back,{class:'quiet'}),button('最初から',actions.reset,{class:'quiet'}));
  }
  if (focus) heading.focus();
}
