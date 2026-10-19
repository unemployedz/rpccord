(()=>{
const metro=vendetta.metro,patcher=vendetta.patcher,storage=vendetta.plugin.storage,ui=vendetta.ui;
const {findByProps,findByStoreName,findByName}=metro;
const {React,ReactNative}=metro.common;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TouchableOpacity,StyleSheet,ActivityIndicator,TextInput,Switch}=ReactNative;

const MessageActions=findByProps("deleteMessage","sendMessage")||findByProps("deleteMessage");
const MessageStore=findByStoreName("MessageStore")||findByProps("getMessages","getMessage");
const ChannelStore=findByStoreName("ChannelStore")||findByProps("getChannel");
const UserStore=findByStoreName("UserStore")||findByProps("getCurrentUser");
const SelectedChannelStore=findByStoreName("SelectedChannelStore")||findByProps("getChannelId");
const RestAPI=findByProps("get","post","delete","put")||findByProps("getAPIBaseURL");

function ensure(){
  if(storage.delayMs===undefined)storage.delayMs="1200";
  if(storage.maxDelete===undefined)storage.maxDelete="200";
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

async function fetchMessagesPage(channelId, before){
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
    else if(bag&&typeof bag==="object"){
      arr=Object.values(bag).filter(function(m){return m&&m.id});
    }
    return arr;
  }catch(e){return []}
}

async function deleteOne(channelId,messageId){
  if(MessageActions&&MessageActions.deleteMessage){
    try{
      await MessageActions.deleteMessage(channelId,messageId);
      return true;
    }catch(e){}
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
      if(!oldest||BigInt(m.id)<BigInt(oldest))oldest=m.id;
      const authorId=m.authorId||(m.author&&m.author.id)||m.author_id;
      if(String(authorId)!==String(myId))continue;
      if(seen[m.id])continue;
      seen[m.id]=true;
      ids.push(m.id);
      if(ids.length>=maxCount)break;
    }
    if(!oldest||(before&&oldest===before))break;
    before=oldest;
    await sleep(400);
  }
  return ids;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214"},
  pad:{padding:16,paddingBottom:48},
  title:{fontSize:20,fontWeight:"700",color:"#fff",marginBottom:8},
  warn:{fontSize:13,color:"#f0b232",lineHeight:18,marginBottom:12},
  hint:{fontSize:13,color:"#b5bac1",lineHeight:18,marginBottom:12},
  label:{fontSize:12,color:"#949ba4",marginBottom:6,marginTop:10,fontWeight:"600"},
  body:{fontSize:15,color:"#f2f3f5",lineHeight:22},
  input:{backgroundColor:"#1e1f22",color:"#f2f3f5",borderRadius:8,padding:12,fontSize:15,borderWidth:1,borderColor:"#2b2d31"},
  btn:{backgroundColor:"#5865f2",paddingVertical:14,borderRadius:8,alignItems:"center",marginTop:12},
  btnDanger:{backgroundColor:"#da373c",paddingVertical:14,borderRadius:8,alignItems:"center",marginTop:12},
  btn2:{backgroundColor:"#4e5058",paddingVertical:12,borderRadius:8,alignItems:"center",marginTop:8},
  btnText:{color:"#fff",fontWeight:"700",fontSize:16},
  status:{fontSize:14,color:"#b5bac1",marginTop:12,lineHeight:20}
});

function Settings(){
  ensure();
  const[status,setStatus]=React.useState("idle");
  const[log,setLog]=React.useState("");
  const[delayMs,setDelayMs]=React.useState(String(storage.delayMs||"1200"));
  const[maxDelete,setMaxDelete]=React.useState(String(storage.maxDelete||"200"));
  const[confirm,setConfirm]=React.useState(false);
  const running=React.useRef(false);

  function append(line){
    setLog(function(prev){return line+"\n"+prev});
  }

  async function runPurge(){
    if(running.current)return;
    const my=meId();
    const channelId=currentChannelId();
    if(!my){showToast&&showToast("Not logged in");return}
    if(!channelId){showToast&&showToast("Open a DM first");return}
    if(!isDmChannel(channelId)){
      showToast&&showToast("Open a DM (not a server channel)");
      setLog("Blocked: current chat is not a DM/group DM.");
      return;
    }
    if(!confirm){
      showToast&&showToast("Turn on the confirm switch first");
      return;
    }
    const delay=Math.max(600,parseInt(delayMs,10)||1200);
    const max=Math.min(500,Math.max(1,parseInt(maxDelete,10)||200));
    storage.delayMs=String(delay);
    storage.maxDelete=String(max);
    running.current=true;
    setStatus("running");
    setLog("Scanning your messages in this DM…");
    try{
      const ids=await collectOwnMessageIds(channelId,my,max);
      if(!ids.length){
        setLog("No messages of yours found in loaded history.");
        setStatus("idle");
        running.current=false;
        return;
      }
      append("Found "+ids.length+" of your messages. Deleting…");
      let ok=0,fail=0;
      for(let i=0;i<ids.length;i++){
        if(!running.current){append("Stopped by user.");break}
        const id=ids[i];
        const success=await deleteOne(channelId,id);
        if(success)ok++;else fail++;
        if(i%5===0||i===ids.length-1){
          setLog("Deleted "+ok+"/"+ids.length+(fail?" (fails: "+fail+")":"")+"…");
        }
        await sleep(delay);
      }
      setLog("Done. Deleted ~"+ok+" message(s)."+(fail?" Failed: "+fail:""));
      showToast&&showToast("Trace remove finished: "+ok);
    }catch(e){
      setLog("Error: "+String(e&&e.message||e));
    }
    setStatus("idle");
    running.current=false;
    setConfirm(false);
  }

  function stop(){
    running.current=false;
    setStatus("idle");
    append("Stopping…");
  }

  const ch=currentChannelId();
  const dm=ch&&isDmChannel(ch);

  return React.createElement(ScrollView,{style:styles.root,contentContainerStyle:styles.pad},
    React.createElement(Text,{style:styles.title},"TraceRemover"),
    React.createElement(Text,{style:styles.warn},"Deletes ONLY messages you sent. Only works in DMs / group DMs you currently have open. Cannot be undone."),
    React.createElement(Text,{style:styles.hint},"1) Open the DM with the person\n2) Set delay & max\n3) Enable confirm\n4) Tap Start"),
    React.createElement(Text,{style:styles.label},"Current chat"),
    React.createElement(Text,{style:styles.body},ch?(dm?"DM/Group open ✓  ("+ch+")":"Not a DM — open a private chat"):"No channel selected"),
    React.createElement(Text,{style:styles.label},"Delay between deletes (ms)"),
    React.createElement(TextInput,{style:styles.input,value:delayMs,onChangeText:setDelayMs,keyboardType:"number-pad"}),
    React.createElement(Text,{style:styles.label},"Max messages to delete (cap 500)"),
    React.createElement(TextInput,{style:styles.input,value:maxDelete,onChangeText:setMaxDelete,keyboardType:"number-pad"}),
    React.createElement(View,{style:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:12}},
      React.createElement(Text,{style:{color:"#fff",fontSize:15,flex:1}},"I understand this deletes my messages"),
      React.createElement(Switch,{value:confirm,onValueChange:setConfirm})
    ),
    status==="running"
      ? React.createElement(TouchableOpacity,{style:styles.btn2,onPress:stop},React.createElement(Text,{style:styles.btnText},"Stop"))
      : React.createElement(TouchableOpacity,{style:styles.btnDanger,onPress:runPurge},React.createElement(Text,{style:styles.btnText},"Start trace remove")),
    status==="running"?React.createElement(ActivityIndicator,{color:"#5865f2",style:{marginTop:12}}):null,
    React.createElement(Text,{style:styles.status,selectable:true},log||"Ready.")
  );
}

return{
  onLoad:function(){ensure()},
  onUnload:function(){},
  settings:Settings
};
})()
