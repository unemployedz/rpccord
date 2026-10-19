(()=>{
const metro=vendetta.metro,ui=vendetta.ui,storage=vendetta.plugin.storage;
const {findByProps}=metro,{React,ReactNative,FluxDispatcher}=metro.common;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TextInput,TouchableOpacity,StyleSheet,Switch,KeyboardAvoidingView,Platform}=ReactNative;

const TYPE_LABELS=[["Playing",0],["Streaming",1],["Listening",2],["Watching",3],["Competing",5]];
const PRESETS=[
  {label:"Custom",name:"Custom RPC",application_id:"",type:0,details:"Hello from RPCCord",state:""},
  {label:"VS Code",name:"Visual Studio Code",application_id:"383226320970055681",type:0,details:"Editing a file",state:"Workspace"},
  {label:"Minecraft",name:"Minecraft",application_id:"",type:0,details:"Survival Mode",state:"Overworld"},
  {label:"Roblox",name:"Roblox",application_id:"",type:0,details:"In Experience",state:""},
  {label:"Valorant",name:"VALORANT",application_id:"",type:0,details:"Competitive",state:""},
  {label:"Listening",name:"Spotify",application_id:"",type:2,details:"My Song",state:"by Artist"}
];

const KEYS=["enabled","name","application_id","type","details","state","large_image","large_text","small_image","small_text","party_size","party_max","show_timestamp","stream_url"];
function ensure(){
  const d={enabled:true,name:"RPCCord",application_id:"",type:0,details:"Using RPCCord",state:"on Kettu",large_image:"",large_text:"",small_image:"",small_text:"",party_size:"0",party_max:"0",show_timestamp:true,stream_url:""};
  for(const k of KEYS){if(storage[k]===undefined||storage[k]===null)storage[k]=d[k]}
}

function cleanActivity(){
  const name=String(storage.name||"").trim()||"RPCCord";
  const activity={name:name,type:Number(storage.type)||0,flags:1};
  const appId=String(storage.application_id||"").trim();
  if(appId&&/^\d+$/.test(appId))activity.application_id=appId;
  const details=String(storage.details||"").trim();
  const state=String(storage.state||"").trim();
  if(details)activity.details=details;
  if(state)activity.state=state;
  if(storage.show_timestamp)activity.timestamps={start:Date.now()};
  if(Number(storage.type)===1){
    const url=String(storage.stream_url||"").trim();
    if(url)activity.url=url;
  }
  const assets={};
  const li=String(storage.large_image||"").trim();
  const lt=String(storage.large_text||"").trim();
  const si=String(storage.small_image||"").trim();
  const st=String(storage.small_text||"").trim();
  if(li)assets.large_image=li;
  if(lt)assets.large_text=lt;
  if(si&&si!=="9")assets.small_image=si;
  if(st)assets.small_text=st;
  if(Object.keys(assets).length)activity.assets=assets;
  const ps=parseInt(String(storage.party_size||"0"),10)||0;
  const pm=parseInt(String(storage.party_max||"0"),10)||0;
  if(ps>0)activity.party={id:"rpccord-party",size:[ps,Math.max(ps,pm||ps)]};
  return activity;
}

function dispatchActivity(activity){
  const payloads=[
    {type:"LOCAL_ACTIVITY_UPDATE",activity:activity,socketId:"RPCCord"},
    {type:"LOCAL_ACTIVITY_UPDATE",activity:activity,pid:1608,socketId:"RPCCord@Kettu"},
    {type:"LOCAL_ACTIVITY_UPDATE",activity:activity,socketId:"CustomRPC"}
  ];
  for(const p of payloads){
    try{FluxDispatcher.dispatch(p)}catch(e){}
  }
}

function applyPresence(clear){
  try{
    if(clear||!storage.enabled){
      dispatchActivity(null);
      try{showToast&&showToast("Presence cleared")}catch(_){}
      return;
    }
    const activity=cleanActivity();
    dispatchActivity(activity);
    try{showToast&&showToast("Applied: "+activity.name)}catch(_){}
  }catch(e){
    try{showToast&&showToast("RPCCord error: "+String(e&&e.message||e))}catch(_){}
  }
}

let keepAlive=null;
function startKeepAlive(){
  stopKeepAlive();
  keepAlive=setInterval(function(){
    if(storage.enabled){
      try{dispatchActivity(cleanActivity())}catch(e){}
    }
  },30000);
}
function stopKeepAlive(){
  if(keepAlive){clearInterval(keepAlive);keepAlive=null}
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214"},
  pad:{padding:14,paddingBottom:48},
  title:{fontSize:20,fontWeight:"700",color:"#fff",marginBottom:6},
  hint:{fontSize:13,color:"#b5bac1",marginBottom:14,lineHeight:18},
  label:{fontSize:12,color:"#949ba4",marginBottom:4,marginTop:10,fontWeight:"600"},
  input:{backgroundColor:"#1e1f22",color:"#f2f3f5",borderRadius:8,paddingHorizontal:12,paddingVertical:11,fontSize:16,borderWidth:1,borderColor:"#2b2d31"},
  row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginVertical:10},
  btn:{backgroundColor:"#5865f2",paddingVertical:14,borderRadius:8,alignItems:"center",marginTop:14},
  btn2:{backgroundColor:"#4e5058",paddingVertical:12,borderRadius:8,alignItems:"center",marginTop:8},
  btnText:{color:"#fff",fontWeight:"700",fontSize:16},
  chip:{backgroundColor:"#2b2d31",paddingVertical:12,paddingHorizontal:12,borderRadius:8,marginBottom:6},
  chipText:{color:"#f2f3f5",fontSize:15}
});

function Settings(){
  ensure();
  const[name,setName]=React.useState(String(storage.name||""));
  const[appId,setAppId]=React.useState(String(storage.application_id||""));
  const[details,setDetails]=React.useState(String(storage.details||""));
  const[state,setState]=React.useState(String(storage.state||""));
  const[type,setType]=React.useState(Number(storage.type)||0);
  const[enabled,setEnabled]=React.useState(!!storage.enabled);
  const[showTs,setShowTs]=React.useState(!!storage.show_timestamp);
  const[largeImage,setLargeImage]=React.useState(String(storage.large_image||""));
  const[partySize,setPartySize]=React.useState(String(storage.party_size||"0"));
  const[partyMax,setPartyMax]=React.useState(String(storage.party_max||"0"));

  function saveAll(){
    storage.name=name;
    storage.application_id=appId;
    storage.details=details;
    storage.state=state;
    storage.type=type;
    storage.enabled=enabled;
    storage.show_timestamp=showTs;
    storage.large_image=largeImage;
    storage.small_image="";
    storage.party_size=partySize;
    storage.party_max=partyMax;
  }

  const typeLabel=(TYPE_LABELS.find(function(x){return x[1]===type})||["Playing"])[0];

  return React.createElement(KeyboardAvoidingView,{style:styles.root,behavior:Platform.OS==="ios"?"padding":undefined},
    React.createElement(ScrollView,{contentContainerStyle:styles.pad,keyboardShouldPersistTaps:"handled"},
      React.createElement(Text,{style:styles.title},"RPCCord"),
      React.createElement(Text,{style:styles.hint},"Edit the fields below (they are editable). Then tap Apply. Check your profile — not the Developer Portal website."),
      React.createElement(View,{style:styles.row},
        React.createElement(Text,{style:{color:"#fff",fontSize:16}},"Enable"),
        React.createElement(Switch,{value:enabled,onValueChange:function(v){setEnabled(v);storage.enabled=v;if(!v){applyPresence(true);stopKeepAlive()}else{saveAll();applyPresence(false);startKeepAlive()}}})
      ),
      React.createElement(Text,{style:styles.label},"Activity type — tap to change"),
      React.createElement(TouchableOpacity,{style:styles.chip,onPress:function(){
        const i=TYPE_LABELS.findIndex(function(x){return x[1]===type});
        const n=TYPE_LABELS[(i+1)%TYPE_LABELS.length];
        setType(n[1]);storage.type=n[1];
      }},React.createElement(Text,{style:styles.chipText},typeLabel)),
      React.createElement(Text,{style:styles.label},"Application name"),
      React.createElement(TextInput,{style:styles.input,value:name,onChangeText:setName,placeholder:"e.g. Visual Studio Code",placeholderTextColor:"#6d6f78"}),
      React.createElement(Text,{style:styles.label},"Application ID (optional number)"),
      React.createElement(TextInput,{style:styles.input,value:appId,onChangeText:setAppId,placeholder:"leave empty if unsure",placeholderTextColor:"#6d6f78",keyboardType:"number-pad"}),
      React.createElement(Text,{style:styles.label},"Details (line 1)"),
      React.createElement(TextInput,{style:styles.input,value:details,onChangeText:setDetails,placeholder:"What you are doing",placeholderTextColor:"#6d6f78"}),
      React.createElement(Text,{style:styles.label},"State (line 2)"),
      React.createElement(TextInput,{style:styles.input,value:state,onChangeText:setState,placeholder:"Extra line",placeholderTextColor:"#6d6f78"}),
      React.createElement(Text,{style:styles.label},"Large image key (optional)"),
      React.createElement(TextInput,{style:styles.input,value:largeImage,onChangeText:setLargeImage,placeholder:"only if you uploaded assets",placeholderTextColor:"#6d6f78"}),
      React.createElement(Text,{style:styles.label},"Party size"),
      React.createElement(TextInput,{style:styles.input,value:partySize,onChangeText:setPartySize,keyboardType:"number-pad"}),
      React.createElement(Text,{style:styles.label},"Party max"),
      React.createElement(TextInput,{style:styles.input,value:partyMax,onChangeText:setPartyMax,keyboardType:"number-pad"}),
      React.createElement(View,{style:styles.row},
        React.createElement(Text,{style:{color:"#fff",fontSize:16}},"Elapsed timer"),
        React.createElement(Switch,{value:showTs,onValueChange:function(v){setShowTs(v);storage.show_timestamp=v}})
      ),
      React.createElement(TouchableOpacity,{style:styles.btn,onPress:function(){saveAll();applyPresence(false);startKeepAlive()}},
        React.createElement(Text,{style:styles.btnText},"Apply presence")),
      React.createElement(TouchableOpacity,{style:styles.btn2,onPress:function(){storage.enabled=false;setEnabled(false);applyPresence(true);stopKeepAlive()}},
        React.createElement(Text,{style:styles.btnText},"Clear presence")),
      React.createElement(Text,{style:[styles.label,{marginTop:18}]},"Presets (tap one, then Apply)"),
      PRESETS.map(function(p){
        return React.createElement(TouchableOpacity,{key:p.label,style:styles.chip,onPress:function(){
          setName(p.name);setAppId(p.application_id||"");setDetails(p.details||"");setState(p.state||"");setType(p.type);
          storage.name=p.name;storage.application_id=p.application_id||"";storage.details=p.details||"";storage.state=p.state||"";storage.type=p.type;storage.small_image="";
          try{showToast&&showToast("Loaded "+p.label+" — now tap Apply")}catch(_){}
        }},React.createElement(Text,{style:styles.chipText},p.label));
      }),
      React.createElement(Text,{style:[styles.hint,{marginTop:16}]},"If nothing shows on your profile: set status to Online (not Invisible), open your profile from a server member list, and wait a few seconds after Apply.")
    )
  );
}

return{
  onLoad:function(){
    ensure();
    if(storage.enabled){applyPresence(false);startKeepAlive()}
  },
  onUnload:function(){
    stopKeepAlive();
    try{dispatchActivity(null)}catch(e){}
  },
  settings:Settings
};
})()
