(()=>{
const metro=vendetta.metro,patcher=vendetta.patcher,storage=vendetta.plugin.storage,ui=vendetta.ui;
const {findByProps,findByStoreName}=metro;
const {React,ReactNative,FluxDispatcher}=metro.common;
const {before,after}=patcher;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TouchableOpacity,StyleSheet,TextInput}=ReactNative;

function findSend(){
  return findByProps("sendMessage","editMessage")
    ||findByProps("sendMessage","deleteMessage")
    ||findByProps("sendMessage");
}
function findDelete(){
  return findByProps("deleteMessage","sendMessage")
    ||findByProps("deleteMessage");
}
function findRest(){
  return findByProps("get","post","put","patch","del")
    ||findByProps("get","post","put","delete")
    ||findByProps("getAPIBaseURL");
}

const MessageStore=findByStoreName("MessageStore")||findByProps("getMessages");
const ChannelStore=findByStoreName("ChannelStore")||findByProps("getChannel");
const UserStore=findByStoreName("UserStore")||findByProps("getCurrentUser");
const SelectedChannelStore=findByStoreName("SelectedChannelStore")||findByProps("getChannelId");

const PREFIX=".trace";
let running=false;
let stopFlag=false;
let lastHandled="";
const unpatches=[];

function ensure(){
  if(storage.delayMs==null)storage.delayMs=1100;
  if(storage.maxDelete==null)storage.maxDelete=150;
}
function toast(m){try{showToast&&showToast(String(m).slice(0,140))}catch(e){}}
function meId(){try{const u=UserStore.getCurrentUser();return u&&String(u.id)}catch(e){return null}}
function channelId(){try{return SelectedChannelStore.getChannelId()}catch(e){return null}}
function isDm(id){
  try{const c=ChannelStore.getChannel(id);return!!c&&(c.type===1||c.type===3)}catch(e){return false}
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}

async function apiGetMessages(ch,before){
  const Rest=findRest();
  if(!Rest||!Rest.get)return null;
  try{
    let url="/channels/"+ch+"/messages?limit=100";
    if(before)url+="&before="+before;
    const res=await Rest.get({url:url});
    const body=res&&(res.body!==undefined?res.body:res);
    if(Array.isArray(body))return body;
  }catch(e){}
  return null;
}

function storeMessages(ch){
  try{
    const bag=MessageStore.getMessages(ch);
    if(!bag)return[];
    if(typeof bag.toArray==="function")return bag.toArray();
    if(Array.isArray(bag._array))return bag._array.slice();
    if(Array.isArray(bag))return bag.slice();
    const out=[];
    if(bag.forEach){bag.forEach(function(m){out.push(m)});return out}
    return Object.values(bag).filter(function(m){return m&&m.id&&(m.content!==undefined||m.author)});
  }catch(e){return[]}
}

function authorId(m){
  if(!m)return"";
  if(m.authorId)return String(m.authorId);
  if(m.author&&m.author.id)return String(m.author.id);
  if(m.author_id)return String(m.author_id);
  return"";
}

async function collectOwn(ch,my,max){
  const ids=[];
  const seen={};
  let before=null;
  for(let page=0;page<25&&ids.length<max;page++){
    let batch=await apiGetMessages(ch,before);
    if(!batch||!batch.length){
      batch=storeMessages(ch);
      if(before&&batch.length){
        batch=batch.filter(function(m){return m.id&&String(m.id)<String(before)});
      }
    }
    if(!batch||!batch.length)break;
    let oldest=null;
    for(let i=0;i<batch.length;i++){
      const m=batch[i];
      if(!m||!m.id)continue;
      const id=String(m.id);
      if(!oldest||id<oldest)oldest=id;
      if(authorId(m)!==my)continue;
      if(seen[id])continue;
      seen[id]=1;
      ids.push(id);
      if(ids.length>=max)break;
    }
    if(!oldest||oldest===before)break;
    before=oldest;
    await sleep(300);
  }
  return ids;
}

async function deleteOne(ch,id){
  const Del=findDelete();
  if(Del&&Del.deleteMessage){
    try{
      const r=Del.deleteMessage(ch,id);
      if(r&&typeof r.then==="function")await r;
      return true;
    }catch(e){}
    try{
      const r=Del.deleteMessage(ch,id,undefined);
      if(r&&typeof r.then==="function")await r;
      return true;
    }catch(e){}
  }
  const Rest=findRest();
  if(Rest){
    try{
      if(Rest.del){await Rest.del({url:"/channels/"+ch+"/messages/"+id});return true}
      if(Rest.delete){await Rest.delete({url:"/channels/"+ch+"/messages/"+id});return true}
    }catch(e){}
  }
  return false;
}

async function runPurge(){
  if(running){toast("Already running. Type .trace stop");return}
  const my=meId();
  const ch=channelId();
  if(!my){toast("No user");return}
  if(!ch){toast("Open a DM first");return}
  if(!isDm(ch)){toast("Not a DM — open private chat");return}

  const delay=Math.max(700,Number(storage.delayMs)||1100);
  const max=Math.min(400,Math.max(1,Number(storage.maxDelete)||150));
  running=true;stopFlag=false;
  toast("Scanning your messages…");
  try{
    const ids=await collectOwn(ch,my,max);
    if(!ids.length){
      toast("None found — scroll up in DM, then .trace yes again");
      running=false;return;
    }
    toast("Deleting "+ids.length+"…");
    let ok=0,fail=0;
    for(let i=0;i<ids.length;i++){
      if(stopFlag){toast("Stopped at "+ok);break}
      if(await deleteOne(ch,ids[i]))ok++;else fail++;
      if((i+1)%8===0)toast(ok+"/"+ids.length+" deleted");
      await sleep(delay);
    }
    if(!stopFlag)toast("Finished: "+ok+" deleted"+(fail?" · "+fail+" failed":""));
  }catch(e){
    toast("Error "+String(e&&e.message||e).slice(0,60));
  }
  running=false;stopFlag=false;
}

function handleText(raw){
  const t=String(raw||"").trim();
  if(!t.toLowerCase().startsWith(PREFIX))return false;
  const key=t+"@"+channelId();
  if(key===lastHandled)return true;
  lastHandled=key;
  setTimeout(function(){if(lastHandled===key)lastHandled=""},3000);

  const rest=t.slice(PREFIX.length).trim().toLowerCase();
  if(rest==="stop"||rest==="cancel"){
    stopFlag=true;toast("Stopping…");return true;
  }
  if(rest==="yes"||rest==="confirm"||rest==="go"||rest==="start"){
    runPurge();return true;
  }
  toast(".trace yes = delete your msgs · .trace stop = cancel");
  return true;
}

function patchSendMessage(){
  const mod=findSend();
  if(!mod||!mod.sendMessage){toast("TraceRemover: sendMessage missing");return}
  unpatches.push(before("sendMessage",mod,function(args){
    try{
      let content=null;
      if(typeof args[0]==="string"&&args[1]&&typeof args[1]==="object")content=args[1].content;
      else if(args[0]&&typeof args[0]==="object")content=args[0].content;
      else if(args[1]&&typeof args[1]==="object")content=args[1].content;
      if(content==null)return;
      if(!handleText(content))return;
      if(args[1]&&typeof args[1]==="object"&&args[1].content!==undefined){
        args[1]=Object.assign({},args[1],{content:""});
      }else if(args[0]&&typeof args[0]==="object"&&args[0].content!==undefined){
        args[0]=Object.assign({},args[0],{content:""});
      }
    }catch(e){}
  }));
}

function patchFlux(){
  if(!FluxDispatcher||!FluxDispatcher.subscribe)return;
  const handler=function(ev){
    try{
      const msg=ev&&(ev.message||ev);
      if(!msg||!msg.content)return;
      const my=meId();
      if(!my||authorId(msg)!==my)return;
      if(!String(msg.content).trim().toLowerCase().startsWith(PREFIX))return;
      handleText(msg.content);
      const ch=msg.channel_id||msg.channelId||channelId();
      if(ch&&msg.id)deleteOne(ch,String(msg.id));
    }catch(e){}
  };
  try{
    FluxDispatcher.subscribe("MESSAGE_CREATE",handler);
    unpatches.push(function(){try{FluxDispatcher.unsubscribe("MESSAGE_CREATE",handler)}catch(e){}});
  }catch(e){}
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214",padding:16},
  title:{fontSize:20,fontWeight:"700",color:"#fff",marginBottom:8},
  body:{fontSize:14,color:"#b5bac1",lineHeight:20,marginBottom:12},
  label:{fontSize:12,color:"#949ba4",marginTop:10,marginBottom:4},
  input:{backgroundColor:"#1e1f22",color:"#fff",borderRadius:8,padding:12,fontSize:15},
  btn:{backgroundColor:"#5865f2",padding:14,borderRadius:8,alignItems:"center",marginTop:14},
  btnText:{color:"#fff",fontWeight:"700",fontSize:16}
});

function Settings(){
  ensure();
  const[d,setD]=React.useState(String(storage.delayMs||1100));
  const[m,setM]=React.useState(String(storage.maxDelete||150));
  return React.createElement(ScrollView,{style:styles.root},
    React.createElement(Text,{style:styles.title},"TraceRemover"),
    React.createElement(Text,{style:styles.body},"Open a DM, then type:\n\n.trace yes\n\nOptional: .trace stop\n\nOnly deletes YOUR messages."),
    React.createElement(Text,{style:styles.label},"Delay ms"),
    React.createElement(TextInput,{style:styles.input,value:d,onChangeText:setD,keyboardType:"number-pad"}),
    React.createElement(Text,{style:styles.label},"Max messages"),
    React.createElement(TextInput,{style:styles.input,value:m,onChangeText:setM,keyboardType:"number-pad"}),
    React.createElement(TouchableOpacity,{style:styles.btn,onPress:function(){
      storage.delayMs=Math.max(700,parseInt(d,10)||1100);
      storage.maxDelete=Math.min(400,Math.max(1,parseInt(m,10)||150));
      toast("Saved");
    }},React.createElement(Text,{style:styles.btnText},"Save")),
    React.createElement(TouchableOpacity,{style:[styles.btn,{backgroundColor:"#da373c"}],onPress:function(){runPurge()}},
      React.createElement(Text,{style:styles.btnText},"Start now (current DM)"))
  );
}

return{
  onLoad:function(){
    ensure();
    patchSendMessage();
    patchFlux();
    toast("TraceRemover ready — in DM type .trace yes");
  },
  onUnload:function(){
    stopFlag=true;
    while(unpatches.length){try{unpatches.pop()()}catch(e){}}
  },
  settings:Settings
};
})()
