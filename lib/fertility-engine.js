/**
 * Lumi fertility-awareness decision support engine.
 *
 * IMPORTANT: This is a conservative signal interpreter, not a validated
 * contraceptive algorithm. It never labels a day "infertile" or "safe".
 * A method-specific, clinically reviewed protocol and user training are
 * required before Lumi can classify post-ovulation days as lower fertility.
 */

const FERTILE_MUCUS = new Set(["watery", "egg-white", "slippery", "stretchy"]);
const POSSIBLY_FERTILE_MUCUS = new Set(["creamy", "sticky"]);
const TEMP_DISRUPTORS = new Set(["illness", "fever", "poor-sleep", "alcohol", "shift-work"]);

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function dayDifference(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hasTemperatureShift(observations) {
  const sorted = [...observations]
    .filter((item) => { const value = item.basalTemperatureC ?? item.basal_temperature_c; return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)); })
    .filter((item) => validDate(item.date ?? item.observed_on))
    .sort((a, b) => validDate(a.date ?? a.observed_on) - validDate(b.date ?? b.observed_on));

  // Require 6 usable baseline readings followed by 3 consecutive higher readings.
  // This is only a possible thermal shift signal, not a contraceptive rule.
  for (let i = 6; i <= sorted.length - 3; i += 1) {
    const baseline = sorted.slice(i - 6, i).map((x) => Number(x.basalTemperatureC ?? x.basal_temperature_c));
    const window = sorted.slice(i - 6, i + 3);
    const baselineRows = window.slice(0, 6);
    const later = window.slice(6);
    const dates = window.map((x) => validDate(x.date ?? x.observed_on));
    const consecutive = dates.every((date, index) => index === 0 || dayDifference(date, dates[index - 1]) === 1);
    if (!consecutive) continue;
    const disrupted = window.some((x) => {
      const symptoms = (x.symptoms ?? []).map((s) => String(s).toLowerCase());
      return symptoms.some((s) => TEMP_DISRUPTORS.has(s)) || x.temperatureDisrupted === true;
    });
    if (disrupted) continue;
    const threshold = average(baseline) + 0.2;
    const raised = later.every((x) => Number(x.basalTemperatureC ?? x.basal_temperature_c) > threshold);
    if (raised) {
      return {
        detected: true,
        firstHigherTemperatureDate: later[0].date ?? later[0].observed_on,
        baselineAverageC: Number(average(baseline).toFixed(2)),
        thresholdC: Number(threshold.toFixed(2)),
      };
    }
  }
  return { detected: false };
}

export function analyzeFertility({
  today = new Date().toISOString().slice(0, 10),
  lastPeriodStart,
  cycleLengths = [],
  averageCycleLength,
  observations = [],
  breastfeeding = false,
  postpartumWeeks,
  irregularBleeding = false,
} = {}) {
  const flags = [];
  const day = validDate(today);
  const period = validDate(lastPeriodStart);
  const cleanCycles = cycleLengths.filter((n) => Number.isInteger(n) && n >= 15 && n <= 60);
  const spread = cleanCycles.length >= 2 ? Math.max(...cleanCycles) - Math.min(...cleanCycles) : null;
  const irregular = irregularBleeding || (spread !== null && spread > 7);
  const earlyPostpartum = Number.isFinite(Number(postpartumWeeks)) && postpartumWeeks !== "" && Number(postpartumWeeks) < 6;

  if (!day || !period || day < period) {
    return {
      status: "uncertain",
      label: "Uncertain",
      explanation: "Add a valid last period start date to begin interpreting your cycle.",
      cycleDay: null,
      potentialFertileWindow: null,
      possibleOvulationShift: { detected: false },
      flags: ["missing-cycle-start"],
      lowerFertilityConfirmed: false,
    };
  }

  const cycleDay = dayDifference(day, period) + 1;
  const allObs = observations.filter((item) => { const observed = validDate(item.date ?? item.observed_on); return observed && observed <= day; });
  const recent = allObs.filter((item) => dayDifference(day, validDate(item.date ?? item.observed_on)) >= 0 &&
    dayDifference(day, validDate(item.date ?? item.observed_on)) <= 1);

  if (breastfeeding) flags.push("breastfeeding");
  if (earlyPostpartum) flags.push("early-postpartum");
  if (irregular) flags.push("irregular-cycle-or-bleeding");

  const mucusValues = recent.map((x) => String(x.cervicalMucus ?? x.cervical_mucus ?? "").toLowerCase());
  const fertileMucus = mucusValues.some((x) => FERTILE_MUCUS.has(x));
  const possiblyFertileMucus = mucusValues.some((x) => POSSIBLY_FERTILE_MUCUS.has(x));
  const disruptedTemperature = recent.some((x) => {
    const symptoms = (x.symptoms ?? []).map((s) => String(s).toLowerCase());
    return symptoms.some((s) => TEMP_DISRUPTORS.has(s)) || x.temperatureDisrupted === true;
  });
  if (disruptedTemperature) flags.push("temperature-may-be-unreliable");

  const cycleBasis = cleanCycles.length ? cleanCycles : (Number.isInteger(averageCycleLength) ? [averageCycleLength] : []);
  let potentialFertileWindow = null;
  if (cycleBasis.length && !irregular && !earlyPostpartum) {
    const shortest = Math.min(...cycleBasis);
    const longest = Math.max(...cycleBasis);
    // Broad calendar caution only. This is not an approved safe/infertile-day rule.
    const startDay = Math.max(1, shortest - 19);
    const endDay = Math.min(longest, longest - 10);
    if (startDay <= endDay) {
      const start = new Date(period);
      start.setDate(start.getDate() + startDay - 1);
      const end = new Date(period);
      end.setDate(end.getDate() + endDay - 1);
      potentialFertileWindow = {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
        basis: "broad-calendar-caution",
      };
    }
  } else {
    flags.push("calendar-estimate-unavailable");
  }

  if (fertileMucus) flags.push("fertile-type-mucus-observed");
  else if (possiblyFertileMucus) flags.push("mucus-pattern-needs-observation");

  const thermal = hasTemperatureShift(allObs);
  if (thermal.detected) flags.push("possible-post-ovulation-temperature-shift");

  let explanation = "There is not enough reliable, method-specific evidence to classify this day. Treat it as potentially fertile while avoiding pregnancy.";
  if (fertileMucus) {
    explanation = "Fertile-type cervical mucus has been recorded. This may indicate a fertile phase; treat today as potentially fertile.";
  } else if (possiblyFertileMucus) {
    explanation = "The mucus observation may be associated with changing fertility. Continue daily observations and treat the status as uncertain.";
  } else if (thermal.detected) {
    explanation = "A possible sustained temperature rise was detected. Temperature rises can help confirm ovulation retrospectively, but this alone does not establish a safe day.";
  } else if (potentialFertileWindow && day >= validDate(potentialFertileWindow.start) && day <= validDate(potentialFertileWindow.end)) {
    explanation = "Today falls within a broad calendar-based caution window. Calendar estimates cannot identify infertile days; treat today as potentially fertile.";
  }

  if (breastfeeding || flags.includes("early-postpartum")) {
    explanation += " Breastfeeding or recent childbirth can make cycle patterns unpredictable; a standard calendar estimate is not reliable in this situation.";
  }
  if (irregular) {
    explanation += " Irregular cycles or bleeding make calendar-based estimates unsuitable.";
  }
  if (disruptedTemperature) {
    explanation += " Illness, fever or disrupted sleep may make temperature readings unreliable.";
  }

  return {
    status: fertileMucus || (potentialFertileWindow && day >= validDate(potentialFertileWindow.start) && day <= validDate(potentialFertileWindow.end))
      ? "potentially-fertile"
      : "uncertain",
    label: fertileMucus || (potentialFertileWindow && day >= validDate(potentialFertileWindow.start) && day <= validDate(potentialFertileWindow.end)) ? "Potentially fertile" : "Uncertain",
    explanation,
    cycleDay,
    potentialFertileWindow,
    possibleOvulationShift: thermal,
    flags,
    lowerFertilityConfirmed: false,
  };
}

export { hasTemperatureShift };
