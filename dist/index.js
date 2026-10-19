(()=>{
const metro=vendetta.metro,ui=vendetta.ui,storage=vendetta.plugin.storage;
const {findByProps}=metro,{React,ReactNative,FluxDispatcher}=metro.common;
const {Forms}=ui.components||{};
const {getAssetIDByName}=ui.assets||{};
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TextInput,TouchableOpacity,StyleSheet,Switch}=ReactNative;
const FormSection=Forms&&Forms.FormSection;
const FormRow=Forms&&Forms.FormRow;
const FormSwitch=Forms&&Forms.FormSwitch;
const FormInput=Forms&&Forms.FormInput;
const FormDivider=Forms&&Forms.FormDivider;
const FormText=Forms&&Forms.FormText;
const assetManager=findByProps("getAssetIds","fetchAssetIds")||findByProps("fetchAssetIds");

const TYPES={PLAYING:0,STREAMING:1,LISTENING:2,WATCHING:3,COMPETING:5};
const TYPE_LABELS=[["Playing",0],["Streaming",1],["Listening",2],["Watching",3],["Competing",5]];
const PRESETS=[
  {label:"Custom (blank)",name:"Custom RPC",application_id:"",type:0,details:"",state:""},
  {label:"Visual Studio Code",name:"Visual Studio Code",application_id:"383226320970055681",type:0,details:"Editing a file",state:"Workspace"},
  {label:"Spotify (style)",name:"Spotify",application_id:"spotify",type:2,details:"Song Title",state:"by Artist"},
  {label:"Minecraft",name:"Minecraft",application_id:"356875221078245376",type:0,details:"Survival",state:"Overworld"},
  {label:"Roblox",name:"Roblox",application_id:"1005469186783440896",type:0,details:"Playing",state:""},
  {label:"League of Legends",name:"League of Legends",application_id:"356833827586932736",type:0,details:"In Game",state:"Summoner's Rift"},
  {label:"Valorant",name:"VALORANT",application_id:"700136079562899456",type:0,details:"Competitive",state:""},
  {label:"GTA V",name:"Grand Theft Auto V",application_id:"356875220204318720",type:0,details:"Free Roam",state:""},
  {label:"Fortnite",name:"Fortnite",application_id:"432980957394370572",type:0,details:"Battle Royale",state:""},
  {label:"Steam (generic)",name:"Steam",application_id:"356875221078245376",type:0,details:"In-Game",state:""}
];

function defaults(){
  return{
    enabled:true,
    name:"RPCCord",
    application_id:"",
    type:0,
    details:"",
    state:"",
    large_image:"",
    large_text:"",
    small_image:"",
    small_text:"",
    party_size:0,
    party_max:0,
    show_timestamp:true,
    stream_url:""
  };
}
function ensureStorage(){
  const d=defaults();
  for(const k of Object.keys(d)){
    if(storage[k]===undefined||storage[k]===null)storage[k]=d[k];
  }
}
function buildActivity(){
  const name=(storage.name||"").trim()||"RPCCord";
  const activity={
    name:name,
    type:Number(storage.type)||0,
    flags:0
  };
  const appId=(storage.application_id||"").trim();
  if(appId&&appId!=="spotify")activity.application_id=appId;
  const details=(storage.details||"").trim();
  const state=(storage.state||"").trim();
  if(details)activity.details=details;
  if(state)activity.state=state;
  if(storage.show_timestamp){
    activity.timestamps={start:Date.now()};
  }
  if(Number(storage.type)===1){
    const url=(storage.stream_url||"").trim();
    if(url)activity.url=url;
  }
  const assets={};
  if((storage.large_image||"").trim())assets.large_image=String(storage.large_image).trim();
  if((storage.large_text||"").trim())assets.large_text=String(storage.large_text).trim();
  if((storage.small_image||"").trim())assets.small_image=String(storage.small_image).trim();
  if((storage.small_text||"").trim())assets.small_text=String(storage.small_text).trim();
  if(Object.keys(assets).length)activity.assets=assets;
  const ps=Number(storage.party_size)||0;
  const pm=Number(storage.party_max)||0;
  if(ps>0||pm>0){
    activity.party={id:"rpccord",size:[Math.max(1,ps),Math.max(ps,pm||ps)]};
  }
  return activity;
}
async function resolveAssets(activity){
  if(!activity.assets||!activity.application_id||!assetManager)return activity;
  try{
    const keys=[activity.assets.large_image,activity.assets.small_image].filter(Boolean);
    if(!keys.length)return activity;
    let ids=[];
    if(assetManager.getAssetIds)ids=assetManager.getAssetIds(activity.application_id,keys);
    if((!ids||!ids.length)&&assetManager.fetchAssetIds)ids=await assetManager.fetchAssetIds(activity.application_id,keys);
    if(ids&&ids.length){
      if(activity.assets.large_image)activity.assets.large_image=ids[0]||activity.assets.large_image;
      if(activity.assets.small_image)activity.assets.small_image=ids[1]||ids[0]||activity.assets.small_image;
    }
  }catch(e){}
  return activity;
}
async function applyPresence(clear){
  try{
    if(clear||!storage.enabled){
      FluxDispatcher.dispatch({type:"LOCAL_ACTIVITY_UPDATE",activity:null,pid:1608,socketId:"RPCCord@Kettu"});
      return;
    }
    let activity=buildActivity();
    activity=await resolveAssets(activity);
    FluxDispatcher.dispatch({type:"LOCAL_ACTIVITY_UPDATE",activity:activity,pid:1608,socketId:"RPCCord@Kettu"});
  }catch(e){
    try{showToast&&showToast("RPCCord: failed to set presence")}catch(_){}
  }
}
function applyPreset(p){
  storage.name=p.name;
  storage.application_id=p.application_id||"";
  storage.type=p.type;
  storage.details=p.details||"";
  storage.state=p.state||"";
  applyPresence(false);
  try{showToast&&showToast("Preset: "+p.label)}catch(_){}
}

const styles=StyleSheet.create({
  root:{flex:1,padding:12},
  label:{fontSize:13,color:"#b5bac1",marginBottom:4,marginTop:10,fontWeight:"600"},
  input:{backgroundColor:"#1e1f22",color:"#f2f3f5",borderRadius:8,paddingHorizontal:12,paddingVertical:10,fontSize:15,marginBottom:4},
  row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginVertical:8},
  btn:{backgroundColor:"#5865f2",paddingVertical:12,borderRadius:8,alignItems:"center",marginTop:12},
  btnSecondary:{backgroundColor:"#4e5058",paddingVertical:10,borderRadius:8,alignItems:"center",marginTop:8},
  btnText:{color:"#fff",fontWeight:"600",fontSize:15},
  hint:{fontSize:12,color:"#949ba4",marginBottom:8,lineHeight:16},
  preset:{backgroundColor:"#2b2d31",paddingVertical:10,paddingHorizontal:12,borderRadius:8,marginBottom:6},
  presetText:{color:"#f2f3f5",fontSize:14},
  title:{fontSize:18,fontWeight:"700",color:"#f2f3f5",marginBottom:4}
});

function Field(props){
  return React.createElement(View,null,
    React.createElement(Text,{style:styles.label},props.label),
    React.createElement(TextInput,{
      style:styles.input,
      value:String(storage[props.k]??""),
      placeholder:props.placeholder||"",
      placeholderTextColor:"#6d6f78",
      onChangeText:function(t){storage[props.k]=t},
      autoCapitalize:"none",
      autoCorrect:false
    })
  );
}

function Settings(){
  const[,tick]=React.useState(0);
  const refresh=function(){tick(function(x){return x+1})};
  React.useEffect(function(){ensureStorage()},[]);

  const typeLabel=(TYPE_LABELS.find(function(x){return x[1]===Number(storage.type)})||["Playing"])[0];

  return React.createElement(ScrollView,{style:styles.root,contentContainerStyle:{paddingBottom:40}},
    React.createElement(Text,{style:styles.title},"RPCCord"),
    React.createElement(Text,{style:styles.hint},"Custom Rich Presence for Kettu (iOS/Android). Uses Discord's local activity API — same approach as other mobile RPC plugins. Not a desktop IPC bridge."),
    React.createElement(View,{style:styles.row},
      React.createElement(Text,{style:{color:"#f2f3f5",fontSize:16}},"Enable presence"),
      React.createElement(Switch,{
        value:!!storage.enabled,
        onValueChange:function(v){storage.enabled=v;applyPresence(!v);refresh()}
      })
    ),
    React.createElement(Text,{style:styles.label},"Activity type (tap to cycle)"),
    React.createElement(TouchableOpacity,{
      style:styles.preset,
      onPress:function(){
        const idx=TYPE_LABELS.findIndex(function(x){return x[1]===Number(storage.type)});
        const next=TYPE_LABELS[(idx+1)%TYPE_LABELS.length];
        storage.type=next[1];
        refresh();
      }
    },React.createElement(Text,{style:styles.presetText},typeLabel)),
    React.createElement(Field,{label:"Application name (shows after type)",k:"name",placeholder:"e.g. Visual Studio Code"}),
    React.createElement(Field,{label:"Application ID (from Discord Developer Portal)",k:"application_id",placeholder:"optional numeric app id"}),
    React.createElement(Field,{label:"Details (line 1)",k:"details",placeholder:"What you're doing"}),
    React.createElement(Field,{label:"State (line 2)",k:"state",placeholder:"Party status / extra line"}),
    Number(storage.type)===1?React.createElement(Field,{label:"Stream URL (Twitch/YouTube)",k:"stream_url",placeholder:"https://twitch.tv/..."}):null,
    React.createElement(Field,{label:"Large image key",k:"large_image",placeholder:"asset key from your app"}),
    React.createElement(Field,{label:"Large image tooltip",k:"large_text"}),
    React.createElement(Field,{label:"Small image key",k:"small_image"}),
    React.createElement(Field,{label:"Small image tooltip",k:"small_text"}),
    React.createElement(Field,{label:"Party size",k:"party_size",placeholder:"0"}),
    React.createElement(Field,{label:"Party max",k:"party_max",placeholder:"0"}),
    React.createElement(View,{style:styles.row},
      React.createElement(Text,{style:{color:"#f2f3f5",fontSize:16}},"Show elapsed timer"),
      React.createElement(Switch,{
        value:!!storage.show_timestamp,
        onValueChange:function(v){storage.show_timestamp=v;refresh()}
      })
    ),
    React.createElement(TouchableOpacity,{
      style:styles.btn,
      onPress:function(){applyPresence(false);try{showToast&&showToast("Presence updated")}catch(_){}}
    },React.createElement(Text,{style:styles.btnText},"Apply presence")),
    React.createElement(TouchableOpacity,{
      style:styles.btnSecondary,
      onPress:function(){applyPresence(true);try{showToast&&showToast("Presence cleared")}catch(_){}}
    },React.createElement(Text,{style:styles.btnText},"Clear presence")),
    React.createElement(Text,{style:[styles.label,{marginTop:20}]},"Quick presets (game-style)"),
    React.createElement(Text,{style:styles.hint},"Presets fill name/details. For real game icons, create an app at discord.com/developers/applications and paste its Application ID + asset keys."),
    PRESETS.map(function(p){
      return React.createElement(TouchableOpacity,{
        key:p.label,
        style:styles.preset,
        onPress:function(){applyPreset(p);refresh()}
      },React.createElement(Text,{style:styles.presetText},p.label));
    })
  );
}

return{
  onLoad:function(){
    ensureStorage();
    if(storage.enabled)applyPresence(false);
  },
  onUnload:function(){
    applyPresence(true);
  },
  settings:Settings
};
})()
