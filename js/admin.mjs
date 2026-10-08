/* LA INFINITÉ — admin-only Firebase operations workspace. */
const cfg = window.MAISON_FIREBASE || {};
const byId = (id) => document.getElementById(id);
const $all = (q) => Array.from(document.querySelectorAll(q));
const visible = (id, yes) => { byId(id).hidden = !yes; };
const setText = (id, text) => { byId(id).textContent = String(text ?? ""); };
const dateText = (v) => v ? new Date(v).toLocaleString(undefined, {dateStyle:"medium",timeStyle:"short"}) : "—";
let auth, functions, authSDK, call, currentEnquiry=null, nextEnquiryCursor=null, allEnquiries=[];
const element = (tag, className, content) => { const e = document.createElement(tag);if(className)e.className=className;if(content!==undefined)e.textContent=String(content);return e; };
const status = (message) => setText("server-status",message);
const configured = ["apiKey","projectId","authDomain","appId","appCheckSiteKey"].every((key) => Boolean(cfg[key]));
const safely = (error) => {console.error("Maison operations request failed",error?.code || "unknown");return error?.code==="functions/permission-denied"?"Your account is not authorized for this action.":"Unable to complete the request. Please retry.";};
const action = (name, data={}) => call(name)(data).then((response) => response.data);

function card(container, title, meta, preview, buttonText, click, label) {
  const row=element("div","record-row"),main=element("div","record-main");
  main.append(element("span","record-title",title),element("div","record-meta",meta));
  if(preview)main.append(element("div","record-preview",preview));
  row.append(main);
  if(label)row.append(element("span","status-label",label));
  if(buttonText){const button=element("button","",buttonText);button.type="button";button.addEventListener("click",click);row.append(button);}
  container.append(row);
}
function switchTab(tab) {
  $all("[data-tab]").forEach((e)=>e.classList.toggle("active",e.dataset.tab===tab));
  $all("[data-panel]").forEach((e)=>e.classList.toggle("active",e.dataset.panel===tab));
  if(tab==="enquiries")loadEnquiries(true);
  if(tab==="circle")loadInvitations();
  if(tab==="subscribers")loadSubscribers();
  if(tab==="activity")loadActivity("activity-list");
}
$all("[data-tab]").forEach((e)=>e.addEventListener("click",()=>switchTab(e.dataset.tab)));
byId("close-detail").addEventListener("click",()=>visible("enquiry-detail",false));
byId("refresh-enquiries").addEventListener("click",()=>loadEnquiries(true));
byId("more-enquiries").addEventListener("click",()=>loadEnquiries(false));
byId("copy-invite").addEventListener("click",async()=>{
  try {await navigator.clipboard.writeText(byId("invite-url").value);byId("copy-invite").textContent="Link copied";}
  catch {byId("invite-url").select();byId("copy-invite").textContent="Select and copy the link";}
});
function showEnquiry(e) {
  currentEnquiry=e;
  setText("detail-title",e.reference+" / "+e.subject);
  setText("detail-meta",e.name+" · "+e.email+" · "+dateText(e.createdAt));
  setText("detail-message",e.message);
  byId("enquiry-status").value=e.status;
  byId("enquiry-priority").value=e.priority;
  byId("enquiry-note").value="";
  byId("reply-link").href="mailto:"+encodeURIComponent(e.email)+"?subject="+encodeURIComponent("Re: "+e.subject+" / "+e.reference);
  setText("detail-status","");
  visible("enquiry-detail",true);
  byId("enquiry-detail").scrollIntoView({behavior:"smooth",block:"start"});
}
async function loadOverview() {
  try {
    const data=await action("getOperationsOverview");
    setText("stat-enquiries",data.enquiries);
    setText("stat-new",data.newEnquiries);
    setText("stat-invites",data.invitations);
    setText("stat-orders",data.orders);
    status("Connected · real Firestore data");
  } catch(error){status(safely(error));}
}
async function loadEnquiries(reset) {
  const container=byId("enquiries-list");
  if(reset){container.replaceChildren();allEnquiries=[];nextEnquiryCursor=null;}
  try {
    const result=await action("listEnquiries", nextEnquiryCursor?{cursor:nextEnquiryCursor}:{});
    allEnquiries.push(...result.items);
    if(!allEnquiries.length)container.append(element("p","quiet","No enquiries recorded."));
    result.items.forEach((e)=>card(container,e.reference+" · "+e.subject,
      e.name+" / "+e.email+" / "+dateText(e.createdAt),e.message.slice(0,170),
      "Review",()=>showEnquiry(e),e.status+(e.priority!=="Normal"?" · "+e.priority:"")));
    nextEnquiryCursor=result.nextCursor;
    visible("more-enquiries",Boolean(nextEnquiryCursor));
  } catch(error){container.append(element("p","quiet",safely(error)));}
}
byId("enquiry-update").addEventListener("submit",async(e)=>{
  e.preventDefault();if(!currentEnquiry)return;
  const button=e.currentTarget.querySelector("button[type=submit]");button.disabled=true;
  try {
    await action("updateEnquiry",{id:currentEnquiry.id,status:byId("enquiry-status").value,
      priority:byId("enquiry-priority").value,note:byId("enquiry-note").value});
    setText("detail-status","Saved securely, with an administrative audit record.");
    byId("enquiry-note").value="";
    await Promise.all([loadOverview(),loadEnquiries(true)]);
  } catch(error){setText("detail-status",safely(error));}
  finally{button.disabled=false;}
});
byId("invite-form").addEventListener("submit",async(e)=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector("button");button.disabled=true;
  try {
    const fd=new FormData(form);
    const result=await action("createMaisonInvitation",{name:String(fd.get("name")),email:String(fd.get("email"))});
    byId("invite-url").value=result.inviteUrl;
    setText("invite-address",result.email+" · Valid until "+dateText(result.expiresAt));
    byId("copy-invite").textContent="Copy invitation link";
    visible("invite-result",true);
    form.reset();
    await Promise.all([loadInvitations(),loadOverview()]);
  }catch(error){alert(safely(error));}finally{button.disabled=false;}
});
async function loadSubscribers(){
  const node=byId("subscriber-list");node.replaceChildren();
  try {
    const data=await action("listNewsletterSubscribers");
    if(!data.items.length)node.append(element("p","quiet","No newsletter requests yet."));
    data.items.forEach((record)=>card(node,record.email,dateText(record.updatedAt),
      "Consent request received · "+(record.source||"website"),"",null,record.status));
  }catch(error){node.append(element("p","quiet",safely(error)));}
}
byId("refresh-subscribers").addEventListener("click",loadSubscribers);

async function loadInvitations(){
  const node=byId("invite-list");node.replaceChildren();
  try {
    const d=await action("listMaisonInvitations");
    if(!d.items.length)node.append(element("p","quiet","No invitations yet."));
    d.items.forEach((i)=>card(node,i.name,i.email+" · "+dateText(i.createdAt),"Expires "+dateText(i.expiresAt),"",null,i.status));
  }catch(error){node.append(element("p","quiet",safely(error)));}
}
async function loadActivity(id){
  const node=byId(id);node.replaceChildren();
  try {
    const d=await action("listOperationsEvents");
    if(!d.items.length)node.append(element("p","quiet","No operational alerts yet."));
    d.items.forEach((i)=>card(node,i.title||"Operation",dateText(i.createdAt),i.reference||"","",""));
  }catch(error){node.append(element("p","quiet",safely(error)));}
}
function decodeVapid(base64){
  const padding="=".repeat((4-base64.length%4)%4),raw=atob((base64+padding).replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from(raw,(c)=>c.charCodeAt(0));
}
byId("enable-push").addEventListener("click",async()=>{
  if(!cfg.vapidPublicKey){setText("push-status","Web push has not been activated by the Firebase project owner.");return;}
  if(!("PushManager" in window)||!("serviceWorker" in navigator)){
    setText("push-status","Push notifications are not supported in this browser context.");return;
  }
  try{
    const permission=await Notification.requestPermission();
    if(permission!=="granted"){setText("push-status","Notification permission not granted.");return;}
    const registration=await navigator.serviceWorker.register("/sw.js",{scope:"/"});
    const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,
      applicationServerKey:decodeVapid(cfg.vapidPublicKey)});
    await action("registerAdminPush",{subscription:subscription.toJSON()});
    setText("push-status","This device is registered to receive operational alerts.");
  }catch(error){setText("push-status",safely(error));}
});
async function checkSession(user) {
  if(!user){visible("login",true);visible("workspace",false);visible("setup",false);visible("logout",false);return;}
  const token=await user.getIdTokenResult(true);
  if(token.claims.admin!==true||!user.emailVerified){
    visible("workspace",false);visible("login",true);visible("logout",true);
    setText("login-status","This account is not a verified Maison administrator.");return;
  }
  visible("login",false);visible("setup",false);visible("workspace",true);visible("logout",true);
  setText("user-email",user.email);setText("admin-identity","Signed in: "+user.email+" · Authorized administrator");
  await Promise.all([loadOverview(),loadActivity("overview-activity")]);
}
byId("login-form").addEventListener("submit",async(e)=>{
  e.preventDefault();setText("login-status","Authenticating securely…");
  try{await authSDK.signInWithEmailAndPassword(auth,byId("login-email").value,byId("login-password").value);byId("login-password").value="";setText("login-status","");}
  catch(error){setText("login-status","Sign-in failed. Check the credentials and administrator authorization.");}
});
byId("logout").addEventListener("click",async()=>{if(auth)await authSDK.signOut(auth);setText("user-email","");});
async function main(){
  if(!configured){visible("setup",true);return;}
  try{
    const [appMod,authMod,fnMod,checkMod]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js")
    ]);
    const app=appMod.initializeApp(cfg);
    checkMod.initializeAppCheck(app,{provider:new checkMod.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
    auth=authMod.getAuth(app);authSDK=authMod;
    functions=fnMod.getFunctions(app,cfg.functionsRegion||"europe-west1");
    call=(name)=>fnMod.httpsCallable(functions,name);
    authMod.onAuthStateChanged(auth,(user)=>{checkSession(user).catch(()=>{visible("workspace",false);visible("login",true);setText("login-status","Unable to verify administrator access.");});});
  }catch(error){visible("setup",true);setText("server-status","Firebase initialization failed");}
}
main();
