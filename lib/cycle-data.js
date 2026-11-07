import { getSupabaseBrowserClient } from "./supabase-browser.js";

async function signedInUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Please sign in to save your cycle data.");
  return data.user;
}

export async function saveCycleAndDailyObservation({
  observedOn,
  lastPeriodStart,
  averageCycleLength,
  cervicalMucus,
  basalTemperatureC,
  symptoms = [],
  breastfeeding = false,
  postpartumWeeks,
  irregularBleeding = false,
}) {
  const supabase = getSupabaseBrowserClient();
  const user = await signedInUser(supabase);

  const { error: preferenceError } = await supabase
    .from("cycle_preferences")
    .upsert({
      user_id: user.id,
      last_period_start: lastPeriodStart,
      average_cycle_length: averageCycleLength,
      breastfeeding,
      postpartum_weeks: postpartumWeeks === "" || postpartumWeeks === undefined ? null : Number(postpartumWeeks),
      irregular_bleeding: irregularBleeding,
    }, { onConflict: "user_id" });

  if (preferenceError) throw preferenceError;

  const normalizedSymptoms = symptoms.map((symptom) => {
    if (symptom === "poorSleep") return "poor-sleep";
    if (symptom === "tender") return "breast-tenderness";
    return symptom;
  });

  const { data, error } = await supabase
    .from("fertility_observations")
    .upsert({
      user_id: user.id,
      observed_on: observedOn,
      cervical_mucus: cervicalMucus === "egg" ? "egg-white" : (cervicalMucus || null),
      basal_temperature_c: basalTemperatureC === "" ? null : Number(basalTemperatureC),
      symptoms: normalizedSymptoms,
    }, { onConflict: "user_id,observed_on" })
    .select("id,observed_on")
    .single();

  if (error) throw error;
  return data;
}

export async function loadMyCycleData() {
  const supabase = getSupabaseBrowserClient();
  const user = await signedInUser(supabase);
  const [preferences, observations] = await Promise.all([
    supabase.from("cycle_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("fertility_observations").select("*").eq("user_id", user.id).order("observed_on", { ascending: false }).limit(180),
  ]);
  if (preferences.error) throw preferences.error;
  if (observations.error) throw observations.error;
  return { preferences: preferences.data, observations: observations.data ?? [] };
}
