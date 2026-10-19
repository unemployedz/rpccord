(()=>{
const metro=vendetta.metro,patcher=vendetta.patcher,storage=vendetta.plugin.storage,ui=vendetta.ui;
const {findByProps,findByStoreName}=metro;
const {React,ReactNative}=metro.common;
const {after,before}=patcher;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,Switch,StyleSheet}=ReactNative;

const FLAG={
  BUG_HUNTER_LEVEL_1:1<<3,
  BUG_HUNTER_LEVEL_2:1<<14,
  EARLY_SUPPORTER:1<<9,
  VERIFIED_DEVELOPER:1<<17,
  ACTIVE_DEVELOPER:1<<22
};

function ensure(){
  if(storage.bugHunterGold===undefined)storage.bugHunterGold=true;
  if(storage.earlyDeveloper===undefined)storage.earlyDeveloper=true;
  if(storage.earlySupporter===undefined)storage.earlySupporter=false;
  if(storage.activeDeveloper===undefined)storage.activeDeveloper=false;
}

function wantedFlags(){
  let f=0;
  if(storage.bugHunterGold)f|=FLAG.BUG_HUNTER_LEVEL_2;
  if(storage.earlyDeveloper)f|=FLAG.VERIFIED_DEVELOPER;
  if(storage.earlySupporter)f|=FLAG.EARLY_SUPPORTER;
  if(storage.activeDeveloper)f|=FLAG.ACTIVE_DEVELOPER;
  return f;
}

function applyFlagsToUser(user){
  if(!user)return user;
  try{
    const extra=wantedFlags();
    if(!extra)return user;
    const current=typeof user.publicFlags==="number"?user.publicFlags:(typeof user.flags==="number"?user.flags:0);
    const next=current|extra;
    if(user.publicFlags!==undefined)user.publicFlags=next;
    if(user.flags!==undefined)user.flags=next;
    try{if(user._flags!==undefined)user._flags=next}catch(e){}
  }catch(e){}
  return user;
}

let unpatches=[];
function patch(){
  unpatches.forEach(function(u){try{u()}catch(e){}});
  unpatches=[];

  const UserStore=findByStoreName("UserStore")||findByProps("getCurrentUser","getUser");
  if(UserStore){
    if(UserStore.getCurrentUser){
      unpatches.push(after("getCurrentUser",UserStore,function(_a,user){
        return applyFlagsToUser(user);
      }));
    }
    if(UserStore.getUser){
      unpatches.push(after("getUser",UserStore,function(args,user){
        try{
          const me=UserStore.getCurrentUser&&UserStore.getCurrentUser();
          if(me&&user&&user.id===me.id)return applyFlagsToUser(user);
        }catch(e){}
        return user;
      }));
    }
  }

  const ProfileStore=findByStoreName("UserProfileStore")||findByProps("getUserProfile");
  if(ProfileStore&&ProfileStore.getUserProfile){
    unpatches.push(after("getUserProfile",ProfileStore,function(args,profile){
      try{
        const me=UserStore&&UserStore.getCurrentUser&&UserStore.getCurrentUser();
        if(!me||!profile)return profile;
        const uid=profile.userId||profile.id||(args&&args[0]);
        if(String(uid)===String(me.id)){
          applyFlagsToUser(profile);
        }
      }catch(e){}
      return profile;
    }));
  }
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214",padding:16},
  title:{fontSize:20,fontWeight:"700",color:"#fff",marginBottom:8},
  hint:{fontSize:13,color:"#b5bac1",marginBottom:16,lineHeight:18},
  row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#2b2d31"},
  label:{color:"#f2f3f5",fontSize:16,flex:1,paddingRight:12},
  sub:{color:"#949ba4",fontSize:12,marginTop:2}
});

function Row(props){
  return React.createElement(View,{style:styles.row},
    React.createElement(View,{style:{flex:1}},
      React.createElement(Text,{style:styles.label},props.label),
      props.sub?React.createElement(Text,{style:styles.sub},props.sub):null
    ),
    React.createElement(Switch,{
      value:!!storage[props.k],
      onValueChange:function(v){
        storage[props.k]=v;
        props.refresh();
        try{showToast&&showToast("Updated — reopen your profile")}catch(e){}
      }
    })
  );
}

function Settings(){
  ensure();
  const[,setTick]=React.useState(0);
  const refresh=function(){setTick(function(x){return x+1})};
  return React.createElement(ScrollView,{style:styles.root},
    React.createElement(Text,{style:styles.title},"BadgeCord"),
    React.createElement(Text,{style:styles.hint},"Client-side only. Only YOU see these badges on your profile. Nobody else does."),
    React.createElement(Row,{k:"bugHunterGold",label:"Bug Hunter (gold / yellow)",sub:"Discord Bug Hunter level 2",refresh:refresh}),
    React.createElement(Row,{k:"earlyDeveloper",label:"Early Verified Bot Developer",sub:"Early developer badge",refresh:refresh}),
    React.createElement(Row,{k:"earlySupporter",label:"Early Supporter",sub:"Optional",refresh:refresh}),
    React.createElement(Row,{k:"activeDeveloper",label:"Active Developer",sub:"Optional",refresh:refresh}),
    React.createElement(Text,{style:[styles.hint,{marginTop:20}]},"After toggling: close your profile and open it again (or reload Discord).")
  );
}

return{
  onLoad:function(){
    ensure();
    patch();
  },
  onUnload:function(){
    unpatches.forEach(function(u){try{u()}catch(e){}});
    unpatches=[];
  },
  settings:Settings
};
})()
