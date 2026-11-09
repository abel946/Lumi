"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser.js";
import { countLearningDays } from "../../lib/fertility-notification.js";

function decodeVapidKey(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

const copy = {
  en: {
    title: "Daily phone updates",
    intro: "Lumi can send a simple fertility update even when you close the app.",
    enable: "Turn on daily notifications",
    disable: "Turn off notifications",
    time: "Daily delivery is set for 8:00 AM East Africa Time. In other countries, the local clock time may be different.",
    permission: "Allow notifications when your phone asks.",
    unsupported: "This browser does not support push notifications. Install Lumi from Chrome on Android and try again.",
    notReady: "Push delivery is being prepared. Please try again later.",
    enabled: "Daily notifications are enabled on this phone.",
    disabled: "Notifications are off on this phone.",
    failed: "Could not update notifications. Please try again.",
    history: "Recent reports",
    noHistory: "Your daily reports will appear here.",
    progress: "Learning your cycle",
    days: "days recorded",
    preview: "Notification colors",
    higher: "Higher chance",
    possible: "Pregnancy is possible",
    lower: "Lower chance (not currently assigned)",
    uncertain: "Not enough information",
    safety: "A green or lower-chance day is not being assigned yet. Lumi will not promise that a day is safe.",
  },
  am: {
    title: "የዕለት ማሳወቂያዎች",
    intro: "መተግበሪያውን ቢዘጉም ሉሚ በየቀኑ ቀላል የመራቢያ መረጃ ሊልክልዎ ይችላል።",
    enable: "የዕለት ማሳወቂያዎችን አብራ",
    disable: "ማሳወቂያዎችን አጥፋ",
    time: "ማሳወቂያው በምስራቅ አፍሪካ ሰዓት ጠዋት 8:00 ይደርሳል። በሌሎች አገሮች የአካባቢ ሰዓቱ ሊለያይ ይችላል።",
    permission: "ስልክዎ ሲጠይቅ ማሳወቂያዎችን ይፍቀዱ።",
    unsupported: "ይህ አሳሽ ማሳወቂያዎችን አይደግፍም። Lumiን ከAndroid Chrome ይጫኑና እንደገና ይሞክሩ።",
    notReady: "የማሳወቂያ አገልግሎቱ ገና እየተዘጋጀ ነው። እባክዎ ቆይተው ይሞክሩ።",
    enabled: "በዚህ ስልክ የዕለት ማሳወቂያዎች ተከፍተዋል።",
    disabled: "በዚህ ስልክ ማሳወቂያዎች ጠፍተዋል።",
    failed: "ማሳወቂያዎችን ማዘመን አልተቻለም። እንደገና ይሞክሩ።",
    history: "የቅርብ ሪፖርቶች",
    noHistory: "የዕለት ሪፖርቶችዎ እዚህ ይታያሉ።",
    progress: "ዑደትዎን በመማር ላይ",
    days: "የተመዘገቡ ቀናት",
    preview: "የማሳወቂያ ቀለሞች",
    higher: "ዕድሉ ከፍ ያለ ሊሆን ይችላል",
    possible: "እርግዝና ሊኖር ይችላል",
    lower: "ዕድሉ ዝቅ ያለ (አሁን አይመደብም)",
    uncertain: "በቂ መረጃ የለም",
    safety: "አሁን አረንጓዴ ወይም ዝቅተኛ ዕድል ያለው ቀን አንመድብም። ሉሚ ቀን ደህና ነው ብሎ አያረጋግጥም።",
  },
};

const colors = {
  higher: { background: "#fff0f1", border: "#d94b65", dot: "#d94b65" },
  possible: { background: "#fff5e7", border: "#d98a27", dot: "#d98a27" },
  lower: { background: "#edf8ef", border: "#399b61", dot: "#399b61" },
  uncertain: { background: "#f2f1f4", border: "#85818c", dot: "#85818c" },
};

export default function FertilityNotificationCenter({ language = "en", observations = [] }) {
  const lang = language === "am" ? "am" : "en";
  const t = copy[lang];
  const [userId, setUserId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [support, setSupport] = useState(false);
  const learningDays = Math.min(30, countLearningDays(observations));

  useEffect(() => {
    let active = true;
    setSupport(typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    const load = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        setUserId(user.id);
        const [subscriptions, history] = await Promise.all([
          supabase.from("push_subscriptions").select("preferred_hour,enabled").eq("user_id", user.id).eq("enabled", true).order("created_at", { ascending: false }).limit(1),
          supabase.from("daily_fertility_reports").select("report_date,status,label,explanation,learning_days").eq("user_id", user.id).order("report_date", { ascending: false }).limit(7),
        ]);
        if (!active) return;
        if (subscriptions.data?.[0]) {
          setEnabled(true);
        }
        if (history.data) setReports(history.data);
      } catch {
        if (active) setMessage(t.failed);
      }
    };
    load();
    return () => { active = false; };
  }, [t.failed]);

  const saveSubscription = async (subscription) => {
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("The phone did not return a valid push subscription.");
    const supabase = getSupabaseBrowserClient();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Addis_Ababa";
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      timezone,
      preferred_hour: 8,
      language: lang,
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
  };

  const enable = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (!userId) throw new Error("Please sign in first.");
      if (!support) throw new Error(t.unsupported);
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error(t.notReady);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(t.permission);
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const ready = await navigator.serviceWorker.ready;
      const subscription = await (ready || registration).pushManager.getSubscription()
        || await (ready || registration).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey),
        });
      await saveSubscription(subscription);
      setEnabled(true);
      setMessage(t.enabled);
    } catch (error) {
      setMessage(error?.message || t.failed);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
      const { error } = await supabase.from("push_subscriptions").update({
        enabled: false,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
      if (error) throw error;
      setEnabled(false);
      setMessage(t.disabled);
    } catch (error) {
      setMessage(error?.message || t.failed);
    } finally {
      setBusy(false);
    }
  };

  const saveTime = async () => {
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Addis_Ababa";
      const { error } = await supabase.from("push_subscriptions").update({
        preferred_hour: 8,
        timezone,
        language: lang,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("enabled", true);
      if (error) throw error;
      setMessage(t.enabled);
    } catch (error) {
      setMessage(error?.message || t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <span className="eyebrow">✧ LUMI DAILY CARE</span>
      <h2>{t.title}</h2>
      <p className="muted">{t.intro}</p>
      <div className="info-box">
        <b>{t.progress}: {learningDays}/30</b>
        <div style={{ height: 8, background: "#f1e7ed", borderRadius: 99, margin: "10px 0 6px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: (learningDays / 30 * 100) + "%", background: "linear-gradient(90deg,#f2a5c7,#d94b91)", borderRadius: 99 }} />
        </div>
        <small>{learningDays} / 30 {t.days}</small>
      </div>
      <div className="info-box">{t.time}</div>
      <button className="primary-button" disabled={busy || !support || !userId} onClick={enabled ? disable : enable}>
        {busy ? "…" : enabled ? t.disable : t.enable}
      </button>
      {!support && <p className="shop-error">{t.unsupported}</p>}
      {message && <p className="muted" role="status">{message}</p>}
      <div className="shop-divider" />
      <b>{t.preview}</b>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {["higher","possible","uncertain"].map((status) => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, background: colors[status].background, border: "1px solid " + colors[status].border }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: colors[status].dot }} />
            <span>{t[status]}</span>
          </div>
        ))}
      </div>
      <p className="shop-hint">{t.safety}</p>
      <div className="shop-divider" />
      <h3>{t.history}</h3>
      {reports.length === 0 && <p className="muted">{t.noHistory}</p>}
      {reports.map((report) => {
        const style = colors[report.status] || colors.uncertain;
        return (
          <article key={report.report_date} style={{ marginTop: 10, padding: 12, borderRadius: 12, background: style.background, borderLeft: "4px solid " + style.border }}>
            <b>{new Date(report.report_date + "T12:00:00").toLocaleDateString(lang === "am" ? "am-ET" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</b>
            <div>{report.label}</div>
            <small>{report.explanation}</small>
          </article>
        );
      })}
    </section>
  );
}
