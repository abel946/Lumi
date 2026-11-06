"use client";
import { useMemo, useState } from "react";

const copy = {
 en: {
  greeting:"Your cycle, understood.", subtitle:"A clearer view of your fertility signs, one day at a time.",
  today:"TODAY'S STATUS", uncertain:"Uncertain", uncertainText:"We need more observations before estimating your fertility status confidently.",
  report:"My fertility report", reportText:"Your report uses your cycle dates and daily observations. It never assumes every cycle is the same.",
  period:"Last period started", cycle:"Usual cycle length", days:"days", update:"Update my details",
  fertile:"Fertility window status", from:"From", to:"To", note:"Lumi is not assigning fertile or lower-fertility dates yet. We are building the observation-based method; until it is validated, this report stays uncertain rather than guessing.",
  observations:"Today's observations", temp:"Basal body temperature", mucus:"Cervical mucus", symptoms:"Symptoms", save:"Save today's observations",
  choose:"Choose an observation", dry:"Dry", sticky:"Sticky", creamy:"Creamy", watery:"Watery", egg:"Egg-white / slippery",
  none:"No symptoms", cramps:"Cramps", tender:"Breast tenderness", headache:"Headache", illness:"Illness / fever", poorSleep:"Poor sleep",
  breastfeeding:"Breastfeeding or recently postpartum", yes:"Yes", no:"No", calendar:"Cycle overview", legend:"Period", fertileDays:"Potentially fertile estimate", unknown:"Uncertain",
  full:"View my full fertility report", insight:"How this report works", insightText:"Calendar dates can suggest when fertility may rise, but cannot identify infertile days on their own. Cervical mucus, temperature trends and cycle context matter.",
  disclaimer:"Lumi supports natural family-planning awareness. No calendar prediction can guarantee pregnancy prevention. If avoiding pregnancy is important, treat uncertain days as potentially fertile and consider learning a validated fertility-awareness method with a trained instructor.",
  saved:"Preview only: this observation is not stored in your account yet.", start:"Start with your cycle details", intro:"Add your recent period date and observations to build your personal report.",
  home:"Home", cycleTab:"My cycle", reportTab:"My report", profile:"Profile"
 },
 am: {
  greeting:"የወር አበባ ዑደትዎን ይረዱ።", subtitle:"የመራቢያ ምልክቶችዎን በየቀኑ በቀላሉ ይከታተሉ።",
  today:"የዛሬ ሁኔታ", uncertain:"ገና አልተረጋገጠም", uncertainText:"የመራቢያ ሁኔታዎን በጥንቃቄ ለመገመት ተጨማሪ መዝገቦች ያስፈልጋሉ።",
  report:"የመራቢያ ሪፖርቴ", reportText:"ሪፖርቱ የዑደት ቀናትዎንና ዕለታዊ ምልከታዎችዎን ይጠቀማል።",
  period:"የመጨረሻ ወር አበባ የጀመረበት ቀን", cycle:"የተለመደ የዑደት ርዝመት", days:"ቀናት", update:"መረጃዬን አዘምን",
  fertile:"የመራቢያ ሁኔታ", from:"ከ", to:"እስከ", note:"የተረጋገጠ የምልከታ ዘዴ እስኪዘጋጅ ድረስ ሉሚ የመራቢያ ወይም ዝቅተኛ የመራቢያ ቀናትን በግምት አይመድብም።",
  observations:"የዛሬ ምልከታዎች", temp:"የጠዋት የሰውነት ሙቀት", mucus:"የማህጸን ፈሳሽ", symptoms:"ምልክቶች", save:"የዛሬን ምልከታ መዝግብ",
  choose:"ምልከታ ይምረጡ", dry:"ደረቅ", sticky:"የሚጣበቅ", creamy:"ክሬም ያለ", watery:"ውሃማ", egg:"እንቁላል ነጭ የሚመስል",
  none:"ምንም የለም", cramps:"ቁርጠት", tender:"የጡት ህመም", headache:"ራስ ምታት", illness:"ህመም / ትኩሳት", poorSleep:"እንቅልፍ ማጣት",
  breastfeeding:"ጡት ማጥባት ወይም በቅርቡ ከወሊድ በኋላ", yes:"አዎ", no:"አይ",
  calendar:"የዑደት እይታ", legend:"የወር አበባ", fertileDays:"የመራቢያ ግምት", unknown:"ያልተረጋገጠ",
  full:"ሙሉ የመራቢያ ሪፖርቴን እይ", insight:"ይህ ሪፖርት እንዴት ይሰራል?", insightText:"የዑደት ቀናት መራቢያ መቼ ሊጨምር እንደሚችል ሊጠቁሙ ይችላሉ፤ ብቻቸውን ግን መራቢያ የሌለባቸውን ቀናት አያረጋግጡም።",
  disclaimer:"ሉሚ የተፈጥሮ የቤተሰብ ዕቅድ ግንዛቤን ይደግፋል። ማንኛውም የቀን ግምት እርግዝናን እንደሚከላከል ዋስትና አይሰጥም።",
  saved:"የቅድመ እይታ ብቻ ነው፤ ምልከታው ገና በመለያዎ ውስጥ አልተቀመጠም።", start:"በዑደት መረጃዎ ይጀምሩ", intro:"የመጨረሻ ወር አበባዎን ቀንና ምልከታዎችን ያስገቡ።",
  home:"መነሻ", cycleTab:"ዑደቴ", reportTab:"ሪፖርቴ", profile:"መገለጫ"
 }
};

export default function Home() {
 const [lang,setLang]=useState("en");
 const t=copy[lang];
 const [lastPeriod,setLastPeriod]=useState(()=>{const d=new Date();d.setDate(d.getDate()-6);return d.toISOString().slice(0,10)});
 const [cycleLength,setCycleLength]=useState(30);
 const [temp,setTemp]=useState("");
 const [mucus,setMucus]=useState("");
 const [symptoms,setSymptoms]=useState([]);
 const [breastfeeding,setBreastfeeding]=useState(false);
 const [saved,setSaved]=useState(false);
 const [tab,setTab]=useState("home");
 const today=new Date(); today.setHours(12,0,0,0);
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
 return <main className="shell">
  <header className="topbar"><div className="brand"><span className="brandmark">✿</span><span>lumi <small>ሉሚ</small></span></div><button className="lang" onClick={()=>setLang(lang==="en"?"am":"en")}>{lang==="en"?"አማ":"EN"} ⇄</button></header>
  <section className="hero"><div className="hero-copy"><div className="eyebrow">✧ GLOW WITHIN</div><h1>{t.greeting}</h1><p>{t.subtitle}</p></div><div className="orb"><span>✿</span><i>✧</i></div></section>
  <nav className="tabs">{[["home",t.home],["cycle",t.cycleTab],["report",t.reportTab],["profile",t.profile]].map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  {tab==="home" && <>
   <section className="status-card"><div className="card-top"><span className="eyebrow">{t.today}</span><span className="date-pill">{fmt(today)}</span></div><div className="status-row"><div><div className="status-title">{t.uncertain}</div><p>{t.uncertainText}</p></div><div className="status-icon">?</div></div><div className="status-foot"><span>DAY {cycleDay} · {t.cycleTab.toUpperCase()}</span><span className="dot yellow"></span></div></section>
   <section className="panel"><div className="section-heading"><div><span className="eyebrow">✧ YOUR PERSONAL SUMMARY</span><h2>{t.report}</h2></div><span className="sparkle">✧</span></div><p className="muted">{t.reportText}</p><div className="estimate-box"><div className="estimate-label"><span className="dot red"></span>{t.fertile}</div><strong>{t.uncertain}</strong><small>{t.note}</small></div><p className="caution">{t.note}</p><button className="outline-button" onClick={()=>setTab("report")}>{t.full} <span>→</span></button></section>
   <section className="panel"><div className="section-heading"><div><span className="eyebrow">✧ DAILY CHECK-IN</span><h2>{t.observations}</h2></div><span className="sparkle">♡</span></div><label className="field-label">{t.temp} (°C)</label><input className="input" type="number" step="0.01" placeholder="e.g. 36.45" value={temp} onChange={e=>setTemp(e.target.value)}/><label className="field-label">{t.mucus}</label><select className="input" value={mucus} onChange={e=>setMucus(e.target.value)}><option value="">{t.choose}</option>{["dry","sticky","creamy","watery","egg"].map(v=><option key={v} value={v}>{t[v]}</option>)}</select><label className="field-label">{t.symptoms}</label><div className="chips">{symptomOptions.map(([s,icon])=><button key={s} onClick={()=>toggle(s)} className={symptoms.includes(s)?"chip selected":"chip"}>{icon} {t[s]}</button>)}</div><label className="field-label">{t.breastfeeding}</label><div className="switchrow"><button className={!breastfeeding?"choice selected":"choice"} onClick={()=>setBreastfeeding(false)}>{t.no}</button><button className={breastfeeding?"choice selected":"choice"} onClick={()=>setBreastfeeding(true)}>{t.yes}</button></div><button className="primary-button" onClick={()=>setSaved(true)}>{t.save} <span>✧</span></button>{saved&&<p className="success">✓ {t.saved}</p>}</section>
  </>}
  {tab==="cycle" && <section className="panel"><span className="eyebrow">✧ CYCLE SETUP</span><h2>{t.start}</h2><p className="muted">{t.intro}</p><label className="field-label">{t.period}</label><input className="input" type="date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)}/><label className="field-label">{t.cycle} · {cycleLength} {t.days}</label><input type="range" min="21" max="45" value={cycleLength} onChange={e=>setCycleLength(Number(e.target.value))}/><div className="range-labels"><span>21 {t.days}</span><span>45 {t.days}</span></div><div className="estimate-box"><div className="estimate-label"><span className="dot red"></span>{t.fertile}</div><strong>{fmt(estimate.start)} — {fmt(estimate.end)}</strong><small>{t.note}</small></div><button className="primary-button" onClick={()=>setTab("report")}>{t.full} →</button></section>}
  {tab==="report" && <section className="panel"><span className="eyebrow">✧ PERSONAL FERTILITY REPORT</span><h2>{t.report}</h2><p className="muted">{t.reportText}</p><div className="report-line"><span className="date-circle">01</span><div><b>{t.period}</b><small>{fmt(new Date(lastPeriod+"T00:00:00"))}</small></div><span className="badge pink">{t.legend}</span></div><div className="report-line"><span className="date-circle">02</span><div><b>{t.fertile}</b><small>{fmt(estimate.start)} — {fmt(estimate.end)}</small></div><span className="badge redbg">Estimate</span></div><div className="report-line"><span className="date-circle">03</span><div><b>{t.uncertain}</b><small>{t.uncertainText}</small></div><span className="badge yellowbg">!</span></div><div className="info-box"><b>{t.insight}</b><p>{t.insightText}</p></div><p className="disclaimer">{t.disclaimer}</p></section>}
  {tab==="profile" && <section className="panel"><span className="eyebrow">✧ YOUR SETTINGS</span><h2>lumi · ሉሚ</h2><label className="field-label">{t.period}</label><input className="input" type="date" value={lastPeriod} onChange={e=>setLastPeriod(e.target.value)}/><label className="field-label">{t.cycle} · {cycleLength} {t.days}</label><input type="range" min="21" max="45" value={cycleLength} onChange={e=>setCycleLength(Number(e.target.value))}/><button className="primary-button" onClick={()=>setTab("home")}>{t.update}</button><div className="info-box">{t.disclaimer}</div></section>}
  <footer><div className="legend"><span><i className="dot pinkdot"></i>{t.legend}</span><span><i className="dot red"></i>{t.fertileDays}</span><span><i className="dot yellow"></i>{t.unknown}</span></div><p>Made with care · ሉሚ</p></footer>
 </main>
}
