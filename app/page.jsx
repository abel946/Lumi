"use client";
import { useEffect, useMemo, useState } from "react";
import { analyzeFertility } from "../lib/fertility-engine.js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser.js";
import { getActiveShopCategories, getMyProductSubmissions, submitProductForReview } from "../lib/shop-submissions.js";
import { saveCycleAndDailyObservation } from "../lib/cycle-data.js";

const copy = {
 en: {
  greeting:"Your cycle, understood.", subtitle:"A clearer view of your fertility signs, one day at a time.", postpartumWeeks:"Weeks since childbirth", irregularBleeding:"Unusual or irregular bleeding",
  today:"TODAY'S STATUS", potentiallyFertile:"Potentially fertile", uncertain:"Uncertain", uncertainText:"We need more observations before estimating your fertility status confidently.",
  report:"My fertility report", reportText:"Your report uses your cycle dates and daily observations. It never assumes every cycle is the same.",
  period:"Last period started", cycle:"Usual cycle length", days:"days", update:"Update my details",
  fertile:"Fertility window status", from:"From", to:"To", note:"Lumi is not assigning fertile or lower-fertility dates yet. We are building the observation-based method; until it is validated, this report stays uncertain rather than guessing.",
  observations:"Today's observations", temp:"Basal body temperature", mucus:"Cervical mucus", symptoms:"Symptoms", save:"Save today's observations",
  choose:"Choose an observation", dry:"Dry", sticky:"Sticky", creamy:"Creamy", watery:"Watery", egg:"Egg-white / slippery",
  none:"No symptoms", cramps:"Cramps", tender:"Breast tenderness", headache:"Headache", illness:"Illness / fever", poorSleep:"Poor sleep",
  breastfeeding:"Breastfeeding or recently postpartum", yes:"Yes", no:"No", calendar:"Cycle overview", legend:"Period", fertileDays:"Potentially fertile estimate", unknown:"Uncertain",
  full:"View my full fertility report", insight:"How this report works", insightText:"Calendar dates can suggest when fertility may rise, but cannot identify infertile days on their own. Cervical mucus, temperature trends and cycle context matter.",
  disclaimer:"Understand your cycle and fertility patterns with insights based on your personal observations.",
  saved:"Today’s observation has been saved to your Lumi account.", saveFailed:"Could not save. Please sign in and try again.", start:"Start with your cycle details", intro:"Add your recent period date and observations to build your personal report.",
  home:"Home", cycleTab:"My cycle", reportTab:"My report", profile:"Profile", shop:"Women’s shop",
  sellItem:"Sell an item", shopIntro:"Share your products with the Lumi community. Every listing is reviewed before it appears in the shop.",
  productName:"Product name", category:"Category", selectCategory:"Choose a category", description:"Description",
  price:"Price (ETB)", stock:"Available stock", photos:"Product photos (up to 6)", deliveryNotes:"Delivery information",
  submitProduct:"Submit for review", myListings:"My submissions", pending:"Pending review", approved:"Approved", rejected:"Not approved",
  noListings:"You have not submitted any products yet.", signInRequired:"Please sign in to submit and manage products.",
  loading:"Loading your shop…", uploadHint:"JPG, PNG or WebP · max 10 MB per photo", submissionSuccess:"Your product was sent to the Lumi admin team for review.",
  fixForm:"Please check the highlighted details.", shopError:"We could not complete that action. Please try again.",
  en:"English"
 },
 am: {
  greeting:"የወር አበባ ዑደትዎን ይረዱ።", subtitle:"የመራቢያ ምልክቶችዎን በየቀኑ በቀላሉ ይከታተሉ።", postpartumWeeks:"ከወሊድ በኋላ ያለፉ ሳምንታት", irregularBleeding:"ያልተለመደ ወይም ያልተስተካከለ ደም መፍሰስ",
  today:"የዛሬ ሁኔታ", potentiallyFertile:"ሊሆን የሚችል የመራቢያ ጊዜ", uncertain:"ገና አልተረጋገጠም", uncertainText:"የመራቢያ ሁኔታዎን በጥንቃቄ ለመገመት ተጨማሪ መዝገቦች ያስፈልጋሉ።",
  report:"የመራቢያ ሪፖርቴ", reportText:"ሪፖርቱ የዑደት ቀናትዎንና ዕለታዊ ምልከታዎችዎን ይጠቀማል።",
  period:"የመጨረሻ ወር አበባ የጀመረበት ቀን", cycle:"የተለመደ የዑደት ርዝመት", days:"ቀናት", update:"መረጃዬን አዘምን",
  fertile:"የመራቢያ ሁኔታ", from:"ከ", to:"እስከ", note:"የተረጋገጠ የምልከታ ዘዴ እስኪዘጋጅ ድረስ ሉሚ የመራቢያ ወይም ዝቅተኛ የመራቢያ ቀናትን በግምት አይመድብም።",
  observations:"የዛሬ ምልከታዎች", temp:"የጠዋት የሰውነት ሙቀት", mucus:"የማህጸን ፈሳሽ", symptoms:"ምልክቶች", save:"የዛሬን ምልከታ መዝግብ",
  choose:"ምልከታ ይምረጡ", dry:"ደረቅ", sticky:"የሚጣበቅ", creamy:"ክሬም ያለ", watery:"ውሃማ", egg:"እንቁላል ነጭ የሚመስል",
  none:"ምንም የለም", cramps:"ቁርጠት", tender:"የጡት ህመም", headache:"ራስ ምታት", illness:"ህመም / ትኩሳት", poorSleep:"እንቅልፍ ማጣት",
  breastfeeding:"ጡት ማጥባት ወይም በቅርቡ ከወሊድ በኋላ", yes:"አዎ", no:"አይ",
  calendar:"የዑደት እይታ", legend:"የወር አበባ", fertileDays:"የመራቢያ ግምት", unknown:"ያልተረጋገጠ",
  full:"ሙሉ የመራቢያ ሪፖርቴን እይ", insight:"ይህ ሪፖርት እንዴት ይሰራል?", insightText:"የዑደት ቀናት መራቢያ መቼ ሊጨምር እንደሚችል ሊጠቁሙ ይችላሉ፤ ብቻቸውን ግን መራቢያ የሌለባቸውን ቀናት አያረጋግጡም።",
  disclaimer:"በግል ምልከታዎችዎ ላይ በተመሠረቱ ግንዛቤዎች የወር አበባ ዑደትዎንና የመራቢያ ቅጦችዎን ይረዱ።",
  saved:"የዛሬ ምልከታዎ በሉሚ መለያዎ ውስጥ ተቀምጧል።", saveFailed:"መረጃውን ማስቀመጥ አልተቻለም። እባክዎ ይግቡና እንደገና ይሞክሩ።", start:"በዑደት መረጃዎ ይጀምሩ", intro:"የመጨረሻ ወር አበባዎን ቀንና ምልከታዎችን ያስገቡ።",
  home:"መነሻ", cycleTab:"ዑደቴ", reportTab:"ሪፖርቴ", profile:"መገለጫ", shop:"የሴቶች ሱቅ",
  sellItem:"ዕቃ ይሽጡ", shopIntro:"ምርቶችዎን ለሉሚ ማህበረሰብ ያቅርቡ። በሱቁ ከመታየታቸው በፊት በአስተዳዳሪ ይገመገማሉ።",
  productName:"የምርት ስም", category:"ምድብ", selectCategory:"ምድብ ይምረጡ", description:"መግለጫ",
  price:"ዋጋ (ብር)", stock:"ያለ ክምችት", photos:"የምርት ፎቶዎች (እስከ 6)", deliveryNotes:"የማድረሻ መረጃ",
  submitProduct:"ለግምገማ አስገባ", myListings:"ያስገባኋቸው ምርቶች", pending:"ግምገማ በመጠባበቅ ላይ", approved:"ጸድቋል", rejected:"አልጸደቀም",
  noListings:"እስካሁን ምንም ምርት አላስገቡም።", signInRequired:"ምርት ለማስገባትና ለማስተዳደር እባክዎ ይግቡ።",
  loading:"ሱቁ በመጫን ላይ…", uploadHint:"JPG፣ PNG ወይም WebP · እያንዳንዱ ፎቶ እስከ 10 MB",
  submissionSuccess:"ምርትዎ ለሉሚ አስተዳዳሪ ግምገማ ተልኳል።", fixForm:"እባክዎ የተሳሳቱ መረጃዎችን ያስተካክሉ።",
  shopError:"ይህን ማጠናቀቅ አልተቻለም። እባክዎ እንደገና ይሞክሩ።"
 }
};

export default function Home() {
 const [lang,setLang]=useState("en");
 const [authReady,setAuthReady]=useState(false);
 const [session,setSession]=useState(null);
 const [authMode,setAuthMode]=useState("login");
 const [authName,setAuthName]=useState("");
 const [authPassword,setAuthPassword]=useState("");
 const [authBusy,setAuthBusy]=useState(false);
 const [authError,setAuthError]=useState("");
 useEffect(()=>{
  try { const saved=window.localStorage.getItem("lumi-language"); if(saved==="en"||saved==="am") setLang(saved); } catch {}
  const supabase=getSupabaseBrowserClient();
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);setAuthReady(true);});
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{try{window.localStorage.setItem("lumi-language",lang);}catch{}},[lang]);
 const authEmail=authName.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"")+"@lumi.app";
 const submitAuth=async()=>{
  setAuthError("");
  const cleanName=authName.trim();
  if(cleanName.length<2){setAuthError(lang==="am"?"እባክዎ ስምዎን ያስገቡ።":"Please enter your name (at least 2 characters).");return;}
  if(authPassword.length<8){setAuthError(lang==="am"?"የይለፍ ቃሉ ቢያንስ 8 ቁምፊዎች ይኑሩት።":"Password must be at least 8 characters.");return;}
  if(!authEmail.startsWith(cleanName.toLowerCase().replace(/[^a-z0-9._-]/g,""))){setAuthError("Please use a name with English letters or numbers for account sign-in.");return;}
  setAuthBusy(true);
  try{
   const supabase=getSupabaseBrowserClient();
   if(authMode==="register"){
    const {data,error}=await supabase.auth.signUp({email:authEmail,password:authPassword,options:{data:{display_name:cleanName,full_name:cleanName}}});
    if(error) throw error;
    if(!data.session) setAuthError(lang==="am"?"መለያው ተፈጥሯል። ለማጠናቀቅ የኢሜይል ማረጋገጫ ያስፈልጋል፤ ይህ የመለያ ቅንብር በአስተዳዳሪ መዘጋጀት አለበት።":"Account created. Email confirmation is currently required by the Supabase project settings; disable confirmation for Lumi's name-and-password flow before public launch.");
   }else{
    const {error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPassword});
    if(error) throw error;
   }
  }catch(error){setAuthError(error?.message||"Could not sign in. Check your details and try again.");}
  finally{setAuthBusy(false);}
 };
 const t=copy[lang];
 const [lastPeriod,setLastPeriod]=useState(()=>{const d=new Date();d.setDate(d.getDate()-6);return d.toISOString().slice(0,10)});
 const [cycleLength,setCycleLength]=useState(30);
 const [temp,setTemp]=useState("");
 const [mucus,setMucus]=useState("");
 const [symptoms,setSymptoms]=useState([]);
 const [breastfeeding,setBreastfeeding]=useState(false);
 const [postpartumWeeks,setPostpartumWeeks]=useState("");
 const [irregularBleeding,setIrregularBleeding]=useState(false);
 const [saved,setSaved]=useState(false);
 const [saveError,setSaveError]=useState("");
 const [tab,setTab]=useState("home");
 const [shopUser,setShopUser]=useState(null);
 const [shopCategories,setShopCategories]=useState([]);
 const [shopSubmissions,setShopSubmissions]=useState([]);
 const [shopLoading,setShopLoading]=useState(false);
 const [shopBusy,setShopBusy]=useState(false);
 const [shopMessage,setShopMessage]=useState("");
 const [shopError,setShopError]=useState("");
 const [productName,setProductName]=useState("");
 const [productCategory,setProductCategory]=useState("");
 const [productDescription,setProductDescription]=useState("");
 const [productPrice,setProductPrice]=useState("");
 const [productStock,setProductStock]=useState("1");
 const [productDelivery,setProductDelivery]=useState("");
 const [productPhotos,setProductPhotos]=useState([]);
 const [productErrors,setProductErrors]=useState({});

 useEffect(() => {
  if (tab !== "shop") return;
  let active = true;
  setShopLoading(true);
  setShopError("");
  const loadShop = async () => {
   try {
    const supabase = getSupabaseBrowserClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!active) return;
    setShopUser(user ?? null);
    const categories = await getActiveShopCategories();
    if (!active) return;
    setShopCategories(categories);
    if (user) {
     const listings = await getMyProductSubmissions();
     if (!active) return;
     setShopSubmissions(listings);
    } else {
     setShopSubmissions([]);
    }
   } catch (error) {
    if (active) setShopError(error?.message || t.shopError);
   } finally {
    if (active) setShopLoading(false);
   }
  };
  loadShop();
  return () => { active = false; };
 }, [tab, lang]);
 const today=new Date(); today.setHours(12,0,0,0);
 const todayISO = [today.getFullYear(), String(today.getMonth()+1).padStart(2,"0"), String(today.getDate()).padStart(2,"0")].join("-");
 const fertilityResult = useMemo(() => analyzeFertility({
  today: todayISO,
  lastPeriodStart: lastPeriod,
  averageCycleLength: cycleLength,
  observations: [{
   observed_on: todayISO,
   cervical_mucus: mucus === "egg" ? "egg-white" : mucus,
   basal_temperature_c: temp === "" ? null : Number(temp),
   symptoms: symptoms.map(s => s === "poorSleep" ? "poor-sleep" : s)
  }],
  breastfeeding,
  postpartumWeeks: postpartumWeeks === "" ? undefined : Number(postpartumWeeks),
  irregularBleeding
 }), [todayISO,lastPeriod,cycleLength,mucus,temp,symptoms,breastfeeding,postpartumWeeks,irregularBleeding]);
 const statusLabel = fertilityResult.status === "potentially-fertile" ? t.potentiallyFertile : t.uncertain;
 const statusExplanation = lang === "am"
  ? (fertilityResult.status === "potentially-fertile" ? "የመራቢያ ምልክት ታይቷል። ይህን ቀን ሊሆን እንደሚችል የመራቢያ ቀን ይቁጠሩ።" : "በቂ እና የተረጋገጠ መረጃ የለም። ይህን ቀን እንደ ያልተረጋገጠ ይቁጠሩ።")
  : fertilityResult.explanation;
 const cycleDay= Math.max(1,Math.floor((today-new Date(lastPeriod+"T00:00:00"))/86400000)+1);
 const estimate=useMemo(()=>{
  const ovulation=cycleLength-14;
  const start=Math.max(1,ovulation-5);
  const end=Math.min(cycleLength,ovulation+1);
  const d=new Date(lastPeriod+"T00:00:00");
  const a=new Date(d); a.setDate(d.getDate()+start-1);
  const b=new Date(d); b.setDate(d.getDate()+end-1);
  return {start:a,end:b,startDay:start,endDay:end};
 },[lastPeriod,cycleLength]);
 const fmt=d=>d.toLocaleDateString(lang==="am"?"am-ET":"en-US",{month:"short",day:"numeric"});
 const toggle=s=>setSymptoms(v=>v.includes(s)?v.filter(x=>x!==s):[...v,s]);
 const symptomOptions=[["cramps","♧"],["tender","♡"],["headache","☼"],["illness","＋"],["poorSleep","☾"]];
 if(!authReady) return <main className="auth-loading"><div className="auth-brand">✿ <span>lumi <small>ሉሚ</small></span></div><div className="auth-loader"></div></main>;
 if(!session) return <main className="login-shell">
  <div className="login-top"><div className="auth-brand"><span className="auth-mark">✿</span><span>lumi <small>ሉሚ</small></span></div><button className="lang" onClick={()=>setLang(lang==="en"?"am":"en")}>{lang==="en"?"አማ":"EN"} ⇄</button></div>
  <section className="login-art"><div className="login-glow"></div><div className="login-orb"><span>✿︎</span><i>✧</i></div><div className="login-art-caption">✧ &nbsp; LUMI</div></section>
  <section className="login-card">
   <div className="login-welcome">{lang==="am"?"እንኳን ወደ ሉሚ በደህና መጡ":"Welcome to Lumi"}</div>
   <div className="login-tabs"><button className={authMode==="login"?"chosen":""} onClick={()=>{setAuthMode("login");setAuthError("");}}>{lang==="am"?"ግባ":"Log in"}</button><button className={authMode==="register"?"chosen":""} onClick={()=>{setAuthMode("register");setAuthError("");}}>{lang==="am"?"መለያ ፍጠር":"Create account"}</button></div>
   <label className="field-label">{lang==="am"?"ስም":"Your name"}</label><input className="input" autoComplete="username" value={authName} onChange={e=>setAuthName(e.target.value)} placeholder={lang==="am"?"ስምዎን ያስገቡ":"Enter your name"}/>
   <label className="field-label">{lang==="am"?"የይለፍ ቃል":"Password"}</label><input className="input" type="password" autoComplete={authMode==="login"?"current-password":"new-password"} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder={lang==="am"?"የይለፍ ቃል":"At least 8 characters"}/>
   {authError&&<p className="auth-error">{authError}</p>}
   <button className="primary-button login-submit" disabled={authBusy} onClick={submitAuth}>{authBusy?"…":authMode==="login"?(lang==="am"?"ግባ":"Log in"):(lang==="am"?"መለያ ፍጠር":"Create account")} <span>✧</span></button>
  </section><p className="login-foot">Made with care · ሉሚ</p>
 </main>;
 return <main className="shell">
  <header className="topbar"><div className="brand"><span className="brandmark">✿</span><span>lumi <small>ሉሚ</small></span></div><button className="lang" onClick={()=>setLang(lang==="en"?"am":"en")}>{lang==="en"?"አማ":"EN"} ⇄</button></header>
  <section className="hero"><div className="hero-copy"><div className="eyebrow">✧ GLOW WITHIN</div><h1>{t.greeting}</h1><p>{t.subtitle}</p></div><div className="orb"><span>✿︎</span><i>✧</i></div></section>
  <nav className="tabs">{[["home",t.home],["cycle",t.cycleTab],["report",t.reportTab],["shop",t.shop],["profile",t.profile]].map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  {tab==="home" && <>
   <section className="status-card"><div className="card-top"><span className="eyebrow">{t.today}</span><span className="date-pill">{fmt(today)}</span></div><div className="status-row"><div><div className="status-title">{statusLabel}</div><p>{statusExplanation}</p></div><div className="status-icon">?</div></div><div className="status-foot"><span>DAY {cycleDay} · {t.cycleTab.toUpperCase()}</span><span className="dot yellow"></span></div></section>
   <section className="panel"><div className="section-heading"><div><span className="eyebrow">✧ YOUR PERSONAL SUMMARY</span><h2>{t.report}</h2></div><span className="sparkle">✧</span></div><p className="muted">{t.reportText}</p><div className="estimate-box"><div className="estimate-label"><span className="dot red"></span>{t.fertile}</div><strong>{statusLabel}</strong><small>{statusExplanation}</small></div><p className="caution">{t.note}</p><button className="outline-button" onClick={()=>setTab("report")}>{t.full} <span>→</span></button></section>
   <section className="panel"><div className="section-heading"><div><span className="eyebrow">✧ DAILY CHECK-IN</span><h2>{t.observations}</h2></div><span className="sparkle">♡</span></div><label className="field-label">{t.temp} (°C)</label><input className="input" type="number" step="0.01" placeholder="e.g. 36.45" value={temp} onChange={e=>setTemp(e.target.value)}/><label className="field-label">{t.mucus}</label><select className="input" value={mucus} onChange={e=>setMucus(e.target.value)}><option value="">{t.choose}</option>{["dry","sticky","creamy","watery","egg"].map(v=><option key={v} value={v}>{t[v]}</option>)}</select><label className="field-label">{t.symptoms}</label><div className="chips">{symptomOptions.map(([s,icon])=><button key={s} onClick={()=>toggle(s)} className={symptoms.includes(s)?"chip selected":"chip"}>{icon} {t[s]}</button>)}</div><label className="field-label">{t.breastfeeding}</label><div className="switchrow"><button className={!breastfeeding?"choice selected":"choice"} onClick={()=>setBreastfeeding(false)}>{t.no}</button><button className={breastfeeding?"choice selected":"choice"} onClick={()=>setBreastfeeding(true)}>{t.yes}</button></div><label className="field-label">{t.postpartumWeeks}</label><input className="input" type="number" min="0" max="104" placeholder="e.g. 8" value={postpartumWeeks} onChange={e=>setPostpartumWeeks(e.target.value)}/><label className="field-label">{t.irregularBleeding}</label><div className="switchrow"><button className={!irregularBleeding?"choice selected":"choice"} onClick={()=>setIrregularBleeding(false)}>{t.no}</button><button className={irregularBleeding?"choice selected":"choice"} onClick={()=>setIrregularBleeding(true)}>{t.yes}</button></div><button className="primary-button" onClick={async()=>{
  setSaved(false);setSaveError("");
  try {
   await saveCycleAndDailyObservation({
    observedOn:todayISO,lastPeriodStart:lastPeriod,averageCycleLength:cycleLength,
    cervicalMucus:mucus,basalTemperatureC:temp,symptoms,
    breastfeeding,postpartumWeeks,irregularBleeding
   });
   setSaved(true);
  } catch(error) { setSaveError(error?.message || t.saveFailed); }
 }}>{t.save} <span>✧</span></button>{saved&&<p className="success">✓ {t.saved}</p>}{saveError&&<p className="shop-error">{saveError}</p>}</section>
  </>}
  {tab==="cycle" && <section className="panel"><span className="eyebrow">✧ CYCLE SETUP</span><h2>{t.start}</h2><p className="muted">{t.intro}</p><label className="field-label">{t.period}</label><input className="input" type="date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)}/><label className="field-label">{t.cycle} · {cycleLength} {t.days}</label><input type="range" min="21" max="45" value={cycleLength} onChange={e=>setCycleLength(Number(e.target.value))}/><div className="range-labels"><span>21 {t.days}</span><span>45 {t.days}</span></div><div className="estimate-box"><div className="estimate-label"><span className="dot red"></span>{t.fertile}</div><strong>{t.uncertain}</strong><small>{t.note}</small></div><button className="primary-button" onClick={()=>setTab("report")}>{t.full} →</button></section>}
  {tab==="report" && <section className="panel"><span className="eyebrow">✧ PERSONAL FERTILITY REPORT</span><h2>{t.report}</h2><p className="muted">{t.reportText}</p><div className="report-line"><span className="date-circle">01</span><div><b>{t.period}</b><small>{fmt(new Date(lastPeriod+"T00:00:00"))}</small></div><span className="badge pink">{t.legend}</span></div><div className="report-line"><span className="date-circle">02</span><div><b>{t.fertile}</b><small>{statusExplanation}</small></div><span className="badge redbg">{statusLabel}</span></div><div className="report-line"><span className="date-circle">03</span><div><b>{t.uncertain}</b><small>{t.uncertainText}</small></div><span className="badge yellowbg">!</span></div><div className="info-box"><b>{t.insight}</b><p>{t.insightText}</p></div><p className="disclaimer">{t.disclaimer}</p></section>}

  {tab==="shop" && <section className="panel shop-panel">
   <span className="eyebrow">✧ LUMI WOMEN’S SHOP</span><h2>{t.sellItem}</h2><p className="muted">{t.shopIntro}</p>
   {shopLoading && <p className="muted">{t.loading}</p>}
   {!shopLoading && !shopUser && <div className="info-box"><b>{t.signInRequired}</b><p>Sign in to your Lumi account first. Your product listings are private until you submit them.</p></div>}
   {shopError && <p className="shop-error">{shopError}</p>}
   {shopUser && <>
    <label className="field-label">{t.productName}</label><input className="input" maxLength="120" value={productName} onChange={e=>setProductName(e.target.value)} placeholder={t.productName}/>
    {productErrors.productName && <small className="shop-error">{productErrors.productName}</small>}
    <label className="field-label">{t.category}</label><select className="input" value={productCategory} onChange={e=>setProductCategory(e.target.value)}><option value="">{t.selectCategory}</option>{shopCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <label className="field-label">{t.description}</label><textarea className="input shop-textarea" maxLength="3000" value={productDescription} onChange={e=>setProductDescription(e.target.value)} placeholder={t.description}/>
    {productErrors.description && <small className="shop-error">{productErrors.description}</small>}
    <div className="shop-grid"><div><label className="field-label">{t.price}</label><input className="input" type="number" min="0.01" step="0.01" value={productPrice} onChange={e=>setProductPrice(e.target.value)}/>{productErrors.price && <small className="shop-error">{productErrors.price}</small>}</div><div><label className="field-label">{t.stock}</label><input className="input" type="number" min="0" step="1" value={productStock} onChange={e=>setProductStock(e.target.value)}/>{productErrors.stockQuantity && <small className="shop-error">{productErrors.stockQuantity}</small>}</div></div>
    <label className="field-label">{t.photos}</label><input className="input shop-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setProductPhotos(Array.from(e.target.files || []).slice(0,6))}/><small className="shop-hint">{t.uploadHint}</small>{productErrors.images && <small className="shop-error">{productErrors.images}</small>}
    {productPhotos.length>0 && <div className="shop-hint">{productPhotos.length} photo(s) selected</div>}
    <label className="field-label">{t.deliveryNotes}</label><textarea className="input shop-textarea" maxLength="1000" value={productDelivery} onChange={e=>setProductDelivery(e.target.value)} placeholder={t.deliveryNotes}/>
    <button className="primary-button" disabled={shopBusy} onClick={async()=>{
     setShopBusy(true);setShopMessage("");setShopError("");setProductErrors({});
     try {
      const result=await submitProductForReview({productName,categoryId:productCategory,description:productDescription,price:productPrice,stockQuantity:productStock,deliveryNotes:productDelivery},productPhotos);
      setShopMessage(t.submissionSuccess+" ("+result.id.slice(0,8)+")");
      setProductName("");setProductCategory("");setProductDescription("");setProductPrice("");setProductStock("1");setProductDelivery("");setProductPhotos([]);
      const listings=await getMyProductSubmissions();setShopSubmissions(listings);
     } catch(error) {
      if(error.validationErrors) setProductErrors(error.validationErrors);
      else setShopError(error?.message || t.shopError);
     } finally {setShopBusy(false);}
    }}>{shopBusy?"…":t.submitProduct} <span>✧</span></button>
    {shopMessage && <p className="success">✓ {shopMessage}</p>}
    <div className="shop-divider"></div><h2>{t.myListings}</h2>
    {shopSubmissions.length===0 && <p className="muted">{t.noListings}</p>}
    {shopSubmissions.map(item=><div className="shop-listing" key={item.id}><div><b>{item.product_name}</b><small>{Number(item.price).toLocaleString()} ETB · {item.stock_quantity} in stock</small>{item.admin_note && <small>{item.admin_note}</small>}</div><span className={"badge "+(item.status==="approved"?"pink":item.status==="rejected"?"redbg":"yellowbg")}>{item.status==="approved"?t.approved:item.status==="rejected"?t.rejected:t.pending}</span></div>)}
   </>}
  </section>}
  {tab==="profile" && <section className="panel"><span className="eyebrow">✧ YOUR SETTINGS</span><h2>lumi · ሉሚ</h2><label className="field-label">{t.period}</label><input className="input" type="date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)}/><label className="field-label">{t.cycle} · {cycleLength} {t.days}</label><input type="range" min="21" max="45" value={cycleLength} onChange={e=>setCycleLength(Number(e.target.value))}/><button className="primary-button" onClick={()=>setTab("home")}>{t.update}</button><div className="info-box">{t.disclaimer}</div></section>}
  <footer><div className="legend"><span><i className="dot pinkdot"></i>{t.legend}</span><span><i className="dot red"></i>{t.fertileDays}</span><span><i className="dot yellow"></i>{t.unknown}</span></div><p>Made with care · ሉሚ</p></footer>
 </main>
}
