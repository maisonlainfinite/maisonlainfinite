/* Secure, email-verified Circle acceptance. The secret stays in the URL fragment. */
const cfg=window.MAISON_FIREBASE||{};
const $=(id)=>document.getElementById(id);
const visible=(id,on)=>{$(id).hidden=!on;};
const feedback=(s)=>{$("feedback").textContent=s;};
const params=new URLSearchParams(location.hash.slice(1));
const invitationId=params.get("i"), token=params.get("t");
let auth,authSDK,functionsSDK,functions,mode="register",busy=false;
function configureMode(next){mode=next;$("auth-submit").textContent=mode==="register"?"Create secure account":"Sign in";}
function hideAll(){["gate","verify","accept","success","pending"].forEach((id)=>visible(id,false));}
async function refresh(user){
  if(!user){hideAll();visible("gate",true);return;}
  await authSDK.reload(user);
  const current=auth.currentUser;
  if(!current?.emailVerified){hideAll();visible("verify",true);return;}
  await current.getIdToken(true);
  hideAll();visible("accept",true);
}
async function initialize(){
  if(!invitationId||!token||invitationId.length>100||token.length>200){visible("missing",true);return;}
  if(!["apiKey","projectId","appId","authDomain","appCheckSiteKey"].every((k)=>Boolean(cfg[k]))){
    visible("missing",true);feedback("Client invitations are not yet activated. Please contact the Maison.");return;
  }
  try{
    const [app,authM,fn,check]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js")]);
    const fb=app.initializeApp(cfg);
    check.initializeAppCheck(fb,{provider:new check.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
    authSDK=authM;auth=authM.getAuth(fb);functionsSDK=fn;functions=fn.getFunctions(fb,cfg.functionsRegion||"europe-west1");
    visible("pending",true);
    authM.onAuthStateChanged(auth,(user)=>refresh(user).catch(()=>feedback("Unable to check membership eligibility.")));
  }catch(error){feedback("Secure client accounts are temporarily unavailable.");}
}
$("mode-register").addEventListener("click",()=>configureMode("register"));
$("mode-signin").addEventListener("click",()=>configureMode("signin"));
$("customer-auth").addEventListener("submit",async(event)=>{
  event.preventDefault();if(busy)return;busy=true;
  const email=$("email").value.trim(),password=$("password").value;
  feedback("Securing your account…");
  try{
    if(mode==="register"){
      const created=await authSDK.createUserWithEmailAndPassword(auth,email,password);
      await authSDK.sendEmailVerification(created.user);
      feedback("Verification sent. Check your email before accepting.");
    }else{
      await authSDK.signInWithEmailAndPassword(auth,email,password);
      feedback("");
    }
  }catch(error){feedback("Could not continue. Check your details, or sign in if you already have an account.");}
  finally{busy=false;$("password").value="";}
});
$("resend").addEventListener("click",async()=>{try{await authSDK.sendEmailVerification(auth.currentUser);feedback("Verification email requested.");}catch{feedback("Please try again later.");}});
$("check-verified").addEventListener("click",async()=>{try{await refresh(auth.currentUser);if(!auth.currentUser.emailVerified)feedback("Email verification has not been completed yet.");}catch{feedback("Please try again.");}});
$("accept-button").addEventListener("click",async()=>{
  if(busy)return;busy=true;$("accept-button").disabled=true;
  try{
    const call=functionsSDK.httpsCallable(functions,"acceptMaisonInvitation");
    const result=await call({invitationId,token});
    if(!result.data.joined)throw Error("unconfirmed");
    history.replaceState(null,"",location.pathname);
    hideAll();visible("success",true);feedback("");
  }catch(error){feedback("Unable to accept. Check that the invitation is still valid and the signed-in email matches its recipient.");}
  finally{busy=false;$("accept-button").disabled=false;}
});
initialize();
