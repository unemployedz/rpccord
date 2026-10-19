(()=>{
const metro=vendetta.metro,patcher=vendetta.patcher,storage=vendetta.plugin.storage,ui=vendetta.ui;
const {findByProps,findByStoreName}=metro;
const {React,ReactNative}=metro.common;
const {before}=patcher;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TouchableOpacity,StyleSheet,ActivityIndicator,TextInput}=ReactNative;

const MessageActions=findByProps("deleteMessage","sendMessage")||findByProps("deleteMessage")||findByProps("sendMessage");
const MessageStore=findByStoreName("MessageStore")||findByProps("getMessages","getMessage");
const ChannelStore=findByStoreName("ChannelStore")||findByProps("getChannel");
const UserStore=findByStoreName("UserStore")||findByProps("getCurrentUser");
const SelectedChannelStore=findByStoreName("SelectedChannelStore")||findByProps("getChannelId");
const RestAPI=findByProps("get","post","delete","put");

const PREFIX=".trace";
let running=false;
let stopFlag=false;

function ensure(){
  if(storage.delayMs===undefined)storage.delayMs=1200;
  if(storage.maxDelete===undefined)storage.maxDelete=200;
}

function meId(){
  try{const u=UserStore.getCurrentUser&&UserStore.getCurrentUser();return u&&u.id}catch(e){return null}
}
function currentChannelId(){
  try{return SelectedChannelStore.getChannelId&&SelectedChannelStore.getChannelId()}catch(e){return null}
}
function isDmChannel(channelId){
  try{
    const ch=ChannelStore.getChannel&&ChannelStore.getChannel(channelId);
    if(!ch)return false;
    return ch.type===1||ch.type===3;
  }catch(e){return false}
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}

async function fetchMessagesPage(channelId,before){
  try{
    if(RestAPI&&RestAPI.get){
      let path="/channels/"+channelId+"/messages?limit=100";
      if(before)path+="&before="+before;
      const res=await RestAPI.get({url:path});
      const body=res&&(res.body||res);
      if(Array.isArray(body))return body;
      if(body&&Array.isArray(body.messages))return body.messages;
    }
  }catch(e){}
  try{
    const bag=MessageStore.getMessages&&MessageStore.getMessages(channelId);
    let arr=[];
    if(bag&&bag.toArray)arr=bag.toArray();
    else if(bag&&bag._array)arr=bag._array;
    else if(Array.isArray(bag))arr=bag;
    else if(bag&&typeof bag==="object")arr=Object.values(bag).filter(function(m){return m&&m.id});
    return arr;
  }catch(e){return []}
}

async function deleteOne(channelId,messageId){
  if(MessageActions&&MessageActions.deleteMessage){
    try{await MessageActions.deleteMessage(channelId,messageId);return true}catch(e){}
  }
  try{
    if(RestAPI&&RestAPI.delete){
      await RestAPI.delete({url:"/channels/"+channelId+"/messages/"+messageId});
      return true;
    }
  }catch(e){}
  return false;
}

async function collectOwnMessageIds(channelId,myId,maxCount){
  const ids=[];
  const seen={};
  let before=undefined;
  let pages=0;
  while(ids.length<maxCount&&pages<30){
    pages++;
    const batch=await fetchMessagesPage(channelId,before);
    if(!batch||!batch.length)break;
    let oldest=null;
    for(const m of batch){
      if(!m||!m.id)continue;
      try{if(!oldest||BigInt(m.id)<BigInt(oldest))oldest=m.id}catch(e){oldest=m.id}
      const authorId=m.authorId||(m.author&&m.author.id)||m.author_id;
      if(String(authorId)!==String(myId))continue;
      if(seen[m.id])continue;
      seen[m.id]=true;
      ids.push(m.id);
      if(ids.length>=maxCount)break;
    }
    if(!oldest||(before&&oldest===before))break;
    before=oldest;
    await sleep(350);
  }
  return ids;
}

async function runPurge(){
  if(running){showToast&&showToast("Already running — type .trace stop");return}
  const my=meId();
  const channelId=currentChannelId();
  if(!my){showToast&&showToast("Not logged in");return}
  if(!channelId){showToast&&showToast("Open a DM first");return}
  if(!isDmChannel(channelId)){showToast&&showToast("Only works in DMs");return}

  const delay=Math.max(600,Number(storage.delayMs)||1200);
  const max=Math.min(500,Math.max(1,Number(storage.maxDelete)||200));

  running=true;stopFlag=false;
  showToast&&showToast("TraceRemover: scanning…");
  try{
    const ids=await collectOwnMessageIds(channelId,my,max);
    if(!ids.length){
      showToast&&showToast("No messages of yours found (scroll up in DM, try again)");
      running=false;return;
    }
    showToast&&showToast("Deleting "+ids.length+" of your messages…");
    let ok=0,fail=0;
    for(let i=0;i<ids.length;i++){
      if(stopFlag){showToast&&showToast("Stopped. Deleted "+ok);break}
      const success=await deleteOne(channelId,ids[i]);
      if(success)ok++;else fail++;
      if(i>0&&i%10===0)showToast&&showToast("Deleted "+ok+"/"+ids.length+"…");
      await sleep(delay);
    }
    if(!stopFlag)showToast&&showToast("Done. Deleted "+ok+(fail?" · fails "+fail:""));
  }catch(e){
    showToast&&showToast("Error: "+String(e&&e.message||e).slice(0,80));
  }
  running=false;stopFlag=false;
}

function handleCommand(content){
  const t=String(content||"").trim();
  const low=t.toLowerCase();
  if(!low.startsWith(PREFIX))return null;

  const rest=t.slice(PREFIX.length).trim().toLowerCase();

  if(rest==="stop"||rest==="cancel"){
    stopFlag=true;
    showToast&&showToast("Stopping…");
    return "";
  }
  if(rest==="yes"||rest==="confirm"||rest==="go"){
    runPurge();
    return "";
  }
  if(rest===""||rest==="help"){
    showToast&&showToast("Type .trace yes to delete YOUR messages in this DM · .trace stop to cancel");
    return "";
  }
  showToast&&showToast("Use: .trace yes  |  .trace stop");
  return "";
}

let unpatchSend;
function patchSend(){
  const sendTarget=MessageActions&&MessageActions.sendMessage?MessageActions:findByProps("sendMessage");
  if(!sendTarget||!sendTarget.sendMessage){
    console.warn("[TraceRemover] sendMessage not found");
    return;
  }
  unpatchSend=before("sendMessage",sendTarget,function(args){
    try{
      let msg=null,idx=-1;
      if(args[1]&&typeof args[1]==="object"&&args[1].content!==undefined){msg=args[1];idx=1}
      else if(args[0]&&typeof args[0]==="object"&&args[0].content!==undefined){msg=args[0];idx=0}
      if(!msg)return;
      const result=handleCommand(msg.content);
      if(result===null)return;
      msg.content="";
      args[idx]=Object.assign({},msg,{content:""});
      throw new Error("TRACEREMOVER_BLOCK");
    }catch(e){
      if(e&&e.message==="TRACEREMOVER_BLOCK")throw e;
    }
  });
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214",padding:16},
  title:{fontSize:20,fontWeight:"700",color:"#fff",marginBottom:8},
  body:{fontSize:14,color:"#b5bac1",lineHeight:20,marginBottom:10},
  label:{fontSize:12,color:"#949ba4",marginTop:12,marginBottom:6,fontWeight:"600"},
  input:{backgroundColor:"#1e1f22",color:"#f2f3f5",borderRadius:8,padding:12,fontSize:15},
  btn:{backgroundColor:"#5865f2",padding:14,borderRadius:8,alignItems:"center",marginTop:12},
  btnText:{color:"#fff",fontWeight:"700",fontSize:16}
});

function Settings(){
  ensure();
  const[delayMs,setDelayMs]=React.useState(String(storage.delayMs||1200));
  const[maxDelete,setMaxDelete]=React.useState(String(storage.maxDelete||200));
  return React.createElement(ScrollView,{style:styles.root},
    React.createElement(Text,{style:styles.title},"TraceRemover"),
    React.createElement(Text,{style:styles.body},
      "In a DM, type:\n\n.trace yes\n\n→ deletes YOUR messages in that DM.\n\n.trace stop\n→ cancel.\n\n.trace\n→ shows help toast."
    ),
    React.createElement(Text,{style:styles.label},"Delay ms (min 600)"),
    React.createElement(TextInput,{style:styles.input,value:delayMs,onChangeText:function(t){setDelayMs(t);storage.delayMs=parseInt(t,10)||1200},keyboardType:"number-pad"}),
    React.createElement(Text,{style:styles.label},"Max delete (max 500)"),
    React.createElement(TextInput,{style:styles.input,value:maxDelete,onChangeText:function(t){setMaxDelete(t);storage.maxDelete=parseInt(t,10)||200},keyboardType:"number-pad"}),
    React.createElement(TouchableOpacity,{style:styles.btn,onPress:function(){
      storage.delayMs=Math.max(600,parseInt(delayMs,10)||1200);
      storage.maxDelete=Math.min(500,Math.max(1,parseInt(maxDelete,10)||200));
      showToast&&showToast("Saved");
    }},React.createElement(Text,{style:styles.btnText},"Save"))
  );
}

return{
  onLoad:function(){ensure();patchSend()},
  onUnload:function(){stopFlag=true;if(unpatchSend)unpatchSend();unpatchSend=undefined},
  settings:Settings
};
})()
