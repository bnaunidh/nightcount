import { releaseLock } from '../core/input.js';

export async function talkToCustomer(g,c){
  if(!c||c.dead||g.choices.open||g.ui.focused)return;
  const delivery=c===g.delivery.driver,phase=delivery?g.delivery.phase:'counter';
  const order=(c.def.wants||[]).map(x=>x.name).join(' and ')||'Fuel, please.';
  let options;
  if(delivery&&phase==='cargo') options=[
    {id:'stock',text:'What do I do next?',reply:(()=>{const step=g.delivery.guidance();return step?`${step.action} ${step.route} ${step.control}`:'Thanks for your help.';})()},
    {id:'progress',text:'How much is left?',reply:`${g.delivery.received.filter(x=>!x).length} full boxes still need to go INSIDE to the receiving pallet. ${g.delivery.loaded.filter(x=>!x).length} empty wooden crates need to come OUTSIDE onto my rear platform. Use E to place them.`},
    {id:'work',text:'I’ll get started.',reply:'Thanks. I’ll wait beside the truck until you finish.'}];
  else if(delivery&&phase==='offer') options=[
    {id:'snack',text:'Want a snack before you go?',action:()=>g.delivery.offerSnack()},
    {id:'road',text:'How was the road tonight?',reply:'Empty. Something was standing out past the last mile marker. Probably a deer.'},
    {id:'wait',text:'Give me a minute.',reply:'Sure. I’m not leaving yet.'}];
  else if(delivery) options=[
    {id:'which',text:'What did you want again?',reply:'A bag of jerky. There’s one labelled for me beside the coffee machine.'},
    {id:'okay',text:'Are you all right out here?',reply:'Just tired. I’ll wait by the truck.'},
    {id:'fetch',text:'I’ll bring it straight out.',reply:'Thanks. See you in a minute.'}];
  else options=[
    {id:'order',text:'What can I get you?',reply:order+'. I’ll wait while you ring it up.'},
    {id:'road',text:c.id==='A6'?'Long drive tonight?':'How’s your night going?',reply:c.def.lines?.[1]||'Quiet. Quieter than usual.'},
    {id:'checkout',text:'I’ll ring that up now.',reply:'Thanks.',action:()=>g.register.open()}];
  const frozen=g.player.frozen,enabled=g.interact.enabled,gen=g.gen;
  g.player.frozen=true;g.interact.enabled=false;releaseLock();
  g.ui.say(delivery?'What is it?':order+'.',{who:c.def.name,secs:5});
  g.audio.humanReaction(c.id==='A2'?(g.minutes%1440>=1080?'female_evening':'female_hello'):'male_hello');
  const answer=await g.choices.ask(`conversation_${g.state.night}_${c.id}_${phase}`,options,{secs:0});
  if(gen!==g.gen)return;
  g.player.frozen=frozen;g.interact.enabled=enabled;
  if(c.dead||!c.group.parent||answer===null)return;
  const choice=options.find(x=>x.id===answer);
  if(choice?.reply){g.ui.say(choice.reply,{who:c.def.name,secs:5});g.customers.play(c,choice.id==='checkout'?'NC_Nod':'Idle_Talking_Loop',.15);setTimeout(()=>{if(!c.dead&&c.state==='counter')g.customers.play(c,'Idle_Loop',.2)},1800);}
  choice?.action?.();
}
