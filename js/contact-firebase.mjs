/* Progressive Firebase submission adapter: preserves the original storefront until configured. */
(() => {
  const cfg = window.MAISON_FIREBASE || {};
  if (!["apiKey","authDomain","projectId","appId","appCheckSiteKey"].every((key)=>Boolean(cfg[key]))) return;

  // Stop the original mailto action immediately, even before Firebase finishes loading.
  let send=null;
  const attach = (form, kind) => {
    if (!form)return;
    const button=form.querySelector('[type="submit"]');
    const status=form.querySelector('[data-form-status]');
    if(kind==="contact"){
      const note=form.querySelector(".form-note");
      if(note)note.textContent="Your message is sent securely to the Maison Client Services dashboard.";
      if(button)button.textContent="Send enquiry";
      const fallback=form.querySelector("[data-email-fallback]");
      if(fallback)fallback.hidden=true;
    }
    form.addEventListener("submit",async(event)=>{
      event.preventDefault();event.stopImmediatePropagation();
      if(!form.reportValidity())return;
      if(!send){status.textContent="Secure enquiry service is connecting. Please try again.";return;}
      const data=new FormData(form);
      button.disabled=true;
      status.textContent="Sending securely…";
      try {
        let result;
        if(kind==="contact"){
          result=await send("submitEnquiry",{name:String(data.get("name")||""),email:String(data.get("email")||""),
            subject:String(data.get("subject")||""),message:String(data.get("message")||""),website:""});
          status.textContent="Enquiry received by Client Services. Reference: "+result.reference;
        }else{
          result=await send("subscribeNewsletter",{email:String(data.get("email")||""),consent:data.get("consent")==="on"});
          status.textContent="Thank you. Your request is recorded pending email verification.";
        }
        form.reset();
      }catch(error){
        console.error("Maison form failed",error?.code || "unknown");
        status.textContent="We could not submit your request. Please try again shortly, or contact us using the email address shown on this page.";
      }finally{button.disabled=false;}
    },{capture:true});
  };
  attach(document.querySelector("[data-contact]"),"contact");
  document.querySelectorAll("[data-newsletter]").forEach((f)=>attach(f,"newsletter"));
  Promise.all([
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js"),
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js")
  ]).then(([appSDK,functionsSDK,checkSDK])=>{
    const app=appSDK.initializeApp(cfg);
    checkSDK.initializeAppCheck(app,{provider:new checkSDK.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
    const funcs=functionsSDK.getFunctions(app,cfg.functionsRegion||"europe-west1");
    send=(name,data)=>functionsSDK.httpsCallable(funcs,name)(data).then((response)=>response.data);
  }).catch((error)=>console.error("Firebase adapter unavailable",error?.code || "init-failed"));
})();
