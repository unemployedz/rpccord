(()=>{
const metro=vendetta.metro,patcher=vendetta.patcher,storage=vendetta.plugin.storage,ui=vendetta.ui;
const {findByProps,findByName,findByStoreName}=metro;
const {React,ReactNative}=metro.common;
const {before}=patcher;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TextInput,TouchableOpacity,StyleSheet,ActivityIndicator,Switch,KeyboardAvoidingView,Platform}=ReactNative;
const Navigation=findByProps("push","pushLazy","pop")||findByProps("push","pop");
const Navigator=findByName("Navigator")||(findByProps("Navigator")||{}).Navigator;
const modalClose=(findByProps("getRenderCloseButton")||{}).getRenderCloseButton||(findByProps("getHeaderCloseButton")||{}).getHeaderCloseButton;
const MessageActions=findByProps("sendMessage","receiveMessage")||findByProps("sendMessage");
const SelectedChannelStore=findByStoreName("SelectedChannelStore")||findByProps("getChannelId");
const PREFIX=".research";
const GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

function ensure(){
  if(storage.apiKey===undefined)storage.apiKey="";
  if(storage.enabled===undefined)storage.enabled=true;
}

async function askGemini(question){
  const key=String(storage.apiKey||"").trim();
  if(!key)return{ok:false,error:"No API key. Open ResearchCord settings and paste a Gemini API key from aistudio.google.com/apikey"};
  const q=String(question||"").trim();
  if(!q)return{ok:false,error:"Empty question."};
  const url=GEMINI_URL+"?key="+encodeURIComponent(key);
  const body={
    contents:[{role:"user",parts:[{text:"You are a helpful research assistant inside Discord. Answer clearly and concisely. If unsure, say so.\n\nQuestion: "+q}]}],
    generationConfig:{temperature:0.7,maxOutputTokens:1024}
  };
  try{
    const ctrl=new AbortController();
    const t=setTimeout(function(){ctrl.abort()},25000);
    const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:ctrl.signal});
    clearTimeout(t);
    const data=await res.json().catch(function(){return null});
    if(!res.ok){
      const msg=(data&&data.error&&data.error.message)||("HTTP "+res.status);
      return{ok:false,error:String(msg)};
    }
    const parts=data&&data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts;
    let text="";
    if(Array.isArray(parts)){
      for(const p of parts){if(p&&typeof p.text==="string")text+=p.text}
    }
    text=text.trim();
    if(!text)return{ok:false,error:"Empty response from Gemini."};
    return{ok:true,text:text};
  }catch(e){
    if(e&&e.name==="AbortError")return{ok:false,error:"Request timed out."};
    return{ok:false,error:String(e&&e.message||e)};
  }
}

function sendToChat(text){
  try{
    const channelId=SelectedChannelStore&&SelectedChannelStore.getChannelId&&SelectedChannelStore.getChannelId();
    if(!channelId||!MessageActions||!MessageActions.sendMessage){
      showToast&&showToast("Could not send — no channel");
      return false;
    }
    MessageActions.sendMessage(channelId,{content:String(text).slice(0,2000)});
    showToast&&showToast("Sent to chat");
    return true;
  }catch(e){
    try{showToast&&showToast("Send failed")}catch(_){}
    return false;
  }
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214"},
  pad:{padding:16,paddingBottom:40},
  title:{fontSize:18,fontWeight:"700",color:"#fff",marginBottom:8},
  label:{fontSize:12,color:"#949ba4",marginBottom:6,marginTop:10,fontWeight:"600"},
  body:{fontSize:16,lineHeight:24,color:"#f2f3f5"},
  err:{fontSize:15,lineHeight:22,color:"#f23f43"},
  input:{backgroundColor:"#1e1f22",color:"#f2f3f5",borderRadius:8,padding:12,fontSize:15,borderWidth:1,borderColor:"#2b2d31"},
  btn:{backgroundColor:"#5865f2",paddingVertical:14,borderRadius:8,alignItems:"center",marginTop:12},
  btn2:{backgroundColor:"#4e5058",paddingVertical:12,borderRadius:8,alignItems:"center",marginTop:8},
  btnOk:{backgroundColor:"#248046",paddingVertical:14,borderRadius:8,alignItems:"center",marginTop:12},
  btnText:{color:"#fff",fontWeight:"700",fontSize:16},
  hint:{fontSize:13,color:"#b5bac1",lineHeight:18,marginBottom:12},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:24,backgroundColor:"#111214"},
  row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginVertical:10}
});

function ResultScreen(props){
  const question=props.question||"";
  const[status,setStatus]=React.useState("loading");
  const[answer,setAnswer]=React.useState("");
  const[error,setError]=React.useState("");
  React.useEffect(function(){
    let cancelled=false;
    (async function(){
      const r=await askGemini(question);
      if(cancelled)return;
      if(r.ok){setAnswer(r.text);setStatus("ok")}
      else{setError(r.error);setStatus("err")}
    })();
    return function(){cancelled=true};
  },[question]);

  if(status==="loading"){
    return React.createElement(View,{style:styles.center},
      React.createElement(ActivityIndicator,{size:"large",color:"#5865f2"}),
      React.createElement(Text,{style:{color:"#b5bac1",marginTop:12}},"Researching with Gemini…")
    );
  }
  if(status==="err"){
    return React.createElement(ScrollView,{style:styles.root,contentContainerStyle:styles.pad},
      React.createElement(Text,{style:styles.label},"Error"),
      React.createElement(Text,{style:styles.err,selectable:true},error),
      React.createElement(Text,{style:styles.label},"Question"),
      React.createElement(Text,{style:styles.body,selectable:true},question)
    );
  }
  return React.createElement(ScrollView,{style:styles.root,contentContainerStyle:styles.pad},
    React.createElement(Text,{style:styles.label},"Question"),
    React.createElement(Text,{style:styles.body,selectable:true},question),
    React.createElement(Text,{style:styles.label},"Answer (Gemini)"),
    React.createElement(Text,{style:styles.body,selectable:true},answer),
    React.createElement(TouchableOpacity,{style:styles.btnOk,onPress:function(){
      sendToChat("**Research:** "+question+"\n\n"+answer);
    }},React.createElement(Text,{style:styles.btnText},"Send to chat")),
    React.createElement(TouchableOpacity,{style:styles.btn2,onPress:function(){
      try{
        const Clipboard=findByProps("setString","getString");
        if(Clipboard&&Clipboard.setString){Clipboard.setString(answer);showToast&&showToast("Copied answer")}
        else showToast&&showToast("Copy not available");
      }catch(e){showToast&&showToast("Copy failed")}
    }},React.createElement(Text,{style:styles.btnText},"Copy answer only")),
    React.createElement(Text,{style:[styles.hint,{marginTop:16}]},"Send posts to this channel. Copy or close = nothing is sent.")
  );
}

function openResult(question){
  if(!Navigator||!Navigation){
    (async function(){
      showToast&&showToast("Researching…");
      const r=await askGemini(question);
      if(!r.ok){showToast&&showToast(r.error.slice(0,120));return}
      showToast&&showToast(r.text.slice(0,140));
    })();
    return;
  }
  const screen=function(){
    return React.createElement(Navigator,{
      initialRouteName:"ResearchResult",
      goBackOnBackPress:true,
      screens:{
        ResearchResult:{
          title:"Research",
          headerLeft:modalClose?modalClose(function(){Navigation.pop()}):undefined,
          render:function(){return React.createElement(ResultScreen,{question:question})}
        }
      }
    });
  };
  try{Navigation.push(screen)}catch(e){showToast&&showToast("Could not open result screen")}
}

function handleOutgoing(content){
  if(!storage.enabled)return null;
  const trimmed=String(content||"").trim();
  if(!trimmed.toLowerCase().startsWith(PREFIX))return null;
  const question=trimmed.slice(PREFIX.length).trim();
  if(!question){showToast&&showToast("Usage: .research your question");return ""}
  openResult(question);
  return "";
}

let unpatchSend;
function patchSend(){
  if(!MessageActions||!MessageActions.sendMessage){console.warn("[ResearchCord] sendMessage not found");return}
  unpatchSend=before("sendMessage",MessageActions,function(args){
    try{
      let msg=null,idx=-1;
      if(args[1]&&typeof args[1]==="object"&&args[1].content!==undefined){msg=args[1];idx=1}
      else if(args[0]&&typeof args[0]==="object"&&args[0].content!==undefined){msg=args[0];idx=0}
      if(!msg)return;
      const result=handleOutgoing(msg.content);
      if(result===null)return;
      msg.content="";
      args[idx]=Object.assign({},msg,{content:""});
      throw new Error("RESEARCHCORD_BLOCK");
    }catch(e){
      if(e&&e.message==="RESEARCHCORD_BLOCK")throw e;
    }
  });
}

function Settings(){
  ensure();
  const[key,setKey]=React.useState(String(storage.apiKey||""));
  const[enabled,setEnabled]=React.useState(!!storage.enabled);
  return React.createElement(KeyboardAvoidingView,{style:styles.root,behavior:Platform.OS==="ios"?"padding":undefined},
    React.createElement(ScrollView,{contentContainerStyle:styles.pad,keyboardShouldPersistTaps:"handled"},
      React.createElement(Text,{style:styles.title},"ResearchCord"),
      React.createElement(Text,{style:styles.hint},"Type in any chat:\n.research your question\n\nThen read, copy, or send to chat."),
      React.createElement(View,{style:styles.row},
        React.createElement(Text,{style:{color:"#fff",fontSize:16}},"Enabled"),
        React.createElement(Switch,{value:enabled,onValueChange:function(v){setEnabled(v);storage.enabled=v}})
      ),
      React.createElement(Text,{style:styles.label},"Gemini API key"),
      React.createElement(TextInput,{
        style:styles.input,value:key,
        onChangeText:function(t){setKey(t);storage.apiKey=t},
        placeholder:"Paste key from aistudio.google.com/apikey",
        placeholderTextColor:"#6d6f78",autoCapitalize:"none",autoCorrect:false,secureTextEntry:true
      }),
      React.createElement(Text,{style:styles.hint},"Free key: aistudio.google.com/apikey — stays on your device."),
      React.createElement(TouchableOpacity,{style:styles.btn,onPress:function(){
        storage.apiKey=key;showToast&&showToast(key.trim()?"Key saved":"Key cleared");
      }},React.createElement(Text,{style:styles.btnText},"Save key")),
      React.createElement(TouchableOpacity,{style:styles.btn2,onPress:function(){
        openResult("Say hello in one short sentence.");
      }},React.createElement(Text,{style:styles.btnText},"Test research"))
    )
  );
}

return{
  onLoad:function(){ensure();patchSend()},
  onUnload:function(){if(unpatchSend)unpatchSend();unpatchSend=undefined},
  settings:Settings
};
})()
