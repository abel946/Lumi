import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { analyzeFertility } from "../../../../lib/fertility-engine.js";
import { buildDailyFertilityNotification, countLearningDays } from "../../../../lib/fertility-notification.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localClock(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      date: values.year + "-" + values.month + "-" + values.day,
      hour: Number(values.hour),
    };
  } catch {
    return localClock("Africa/Addis_Ababa");
  }
}

function cycleLengthsFromEntries(entries = []) {
  const dates = entries.map((entry) => entry.period_start).filter(Boolean).sort();
  const lengths = [];
  for (let index = 1; index < dates.length; index += 1) {
    const days = Math.round((Date.parse(dates[index] + "T00:00:00Z") - Date.parse(dates[index - 1] + "T00:00:00Z")) / 86400000);
    if (Number.isInteger(days) && days >= 15 && days <= 60) lengths.push(days);
  }
  return lengths.slice(-8);
}

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== "Bearer " + cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    return Response.json({ error: "Daily notifications are not configured.", missing }, { status: 503 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,timezone,preferred_hour,language")
    .eq("enabled", true);

  if (subscriptionError) {
    return Response.json({ error: "Could not load push subscriptions." }, { status: 500 });
  }

  const dueByUserDay = new Map();
  for (const subscription of subscriptions ?? []) {
    const clock = localClock(subscription.timezone || "Africa/Addis_Ababa");
    if (clock.hour < Number(subscription.preferred_hour ?? 8)) continue;
    const key = subscription.user_id + ":" + clock.date;
    if (!dueByUserDay.has(key)) dueByUserDay.set(key, { userId: subscription.user_id, date: clock.date, subscriptions: [] });
    dueByUserDay.get(key).subscriptions.push(subscription);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const group of dueByUserDay.values()) {
    const { data: existing } = await supabase
      .from("daily_fertility_reports")
      .select("sent_at")
      .eq("user_id", group.userId)
      .eq("report_date", group.date)
      .maybeSingle();
    if (existing?.sent_at) {
      skipped += group.subscriptions.length;
      continue;
    }

    const [preferencesResult, observationsResult, entriesResult, profileResult] = await Promise.all([
      supabase.from("cycle_preferences").select("*").eq("user_id", group.userId).maybeSingle(),
      supabase.from("fertility_observations").select("observed_on,cervical_mucus,basal_temperature_c,symptoms").eq("user_id", group.userId).order("observed_on", { ascending: true }).limit(240),
      supabase.from("cycle_entries").select("period_start").eq("user_id", group.userId).not("period_start", "is", null).order("period_start", { ascending: true }).limit(12),
      supabase.from("profiles").select("preferred_language").eq("id", group.userId).maybeSingle(),
    ]);

    const preferences = preferencesResult.data ?? {};
    const observations = observationsResult.data ?? [];
    const entries = entriesResult.data ?? [];
    const learningDays = countLearningDays(observations);
    const cycleLengths = cycleLengthsFromEntries(entries);
    const lastPeriodStart = preferences.last_period_start || entries.at(-1)?.period_start || null;
    const fertilityResult = analyzeFertility({
      today: group.date,
      lastPeriodStart,
      averageCycleLength: preferences.average_cycle_length,
      cycleLengths,
      observations,
      breastfeeding: preferences.breastfeeding ?? false,
      postpartumWeeks: preferences.postpartum_weeks,
      irregularBleeding: preferences.irregular_bleeding ?? false,
    });

    const primaryLanguage = group.subscriptions[0]?.language || profileResult.data?.preferred_language || "en";
    const report = buildDailyFertilityNotification({
      fertilityResult,
      learningDays,
      today: group.date,
      language: primaryLanguage,
    });

    let groupSent = 0;
    for (const subscription of group.subscriptions) {
      const language = subscription.language || primaryLanguage;
      const localized = language === primaryLanguage ? report : buildDailyFertilityNotification({
        fertilityResult,
        learningDays,
        today: group.date,
        language,
      });
      const payload = {
        title: language === "am" ? "ሉሚ · የዕለት ሪፖርት" : "Lumi · Daily report",
        body: localized.emoji + " " + localized.label + ". " + localized.explanation,
        icon: "/icons/lumi.svg",
        badge: "/icons/lumi.svg",
        tag: "lumi-daily-" + group.date,
        data: { url: "/?tab=report", status: localized.status },
      };

      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify(payload), { TTL: 86400, urgency: "normal" });
        sent += 1;
        groupSent += 1;
      } catch (error) {
        failed += 1;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await supabase.from("push_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", subscription.id);
        }
      }
    }

    await supabase.from("daily_fertility_reports").upsert({
      user_id: group.userId,
      report_date: group.date,
      status: report.status,
      label: report.label,
      explanation: report.explanation,
      learning_days: report.learningDays,
      learning_complete: report.learningComplete,
      sent_at: groupSent > 0 ? new Date().toISOString() : null,
    }, { onConflict: "user_id,report_date" });
  }

  return Response.json({ ok: true, sent, failed, skipped, checkedUsers: dueByUserDay.size });
}
