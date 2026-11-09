const FERTILE_FLAG = "fertile-type-mucus-observed";
const POSSIBLE_FLAG = "mucus-pattern-needs-observation";

export function countLearningDays(observations = []) {
  const days = new Set();
  for (const row of observations) {
    const date = row.observed_on ?? row.date;
    if (!date) continue;
    const mucus = row.cervical_mucus ?? row.cervicalMucus;
    const temperature = row.basal_temperature_c ?? row.basalTemperatureC;
    const symptoms = Array.isArray(row.symptoms) ? row.symptoms : [];
    const hasEntry = Boolean(mucus) || (temperature !== null && temperature !== undefined && temperature !== "") || symptoms.length > 0;
    if (hasEntry) days.add(String(date).slice(0, 10));
  }
  return days.size;
}

function isInsideWindow(result, today) {
  const window = result?.potentialFertileWindow;
  return Boolean(window?.start && window?.end && today >= window.start && today <= window.end);
}

export function buildDailyFertilityNotification({
  fertilityResult = {},
  learningDays = 0,
  today = new Date().toISOString().slice(0, 10),
  language = "en",
} = {}) {
  const lang = language === "am" ? "am" : "en";
  const flags = new Set(fertilityResult.flags ?? []);
  const learningComplete = learningDays >= 30;

  if (!learningComplete) {
    return {
      status: "uncertain",
      label: lang === "am" ? "ገና በመማር ላይ ነኝ" : "Still learning",
      emoji: "⚪",
      color: "#85818c",
      learningDays: Math.min(30, learningDays),
      learningComplete: false,
      explanation: lang === "am"
        ? "ሉሚ የዑደትዎን ሁኔታ ለመረዳት ተጨማሪ ዕለታዊ መረጃ ይፈልጋል። በየቀኑ ምልክቶችዎን ይመዝግቡ። እስከዚያ ድረስ የእርግዝና እድልን ማስቀረት አይቻልም።"
        : "Lumi is still learning your cycle. Keep recording your signs each day. For now, pregnancy cannot be ruled out.",
    };
  }

  if (flags.has(FERTILE_FLAG)) {
    return {
      status: "higher",
      label: lang === "am" ? "የእርግዝና ዕድል ከፍ ያለ ሊሆን ይችላል" : "Higher chance",
      emoji: "🔴",
      color: "#d94b65",
      learningDays: 30,
      learningComplete: true,
      explanation: lang === "am"
        ? "የማህፀን ንፍጥዎ የመራቢያ ጊዜ ምልክት ያሳያል። እርግዝናን ማስቀረት ከፈለጉ መከላከያ ይጠቀሙ።"
        : "Your cervical mucus shows a fertility sign. If you want to avoid pregnancy, use protection.",
    };
  }

  if (flags.has(POSSIBLE_FLAG) || isInsideWindow(fertilityResult, today)) {
    return {
      status: "possible",
      label: lang === "am" ? "እርግዝና ሊኖር ይችላል" : "Pregnancy is possible",
      emoji: "🟠",
      color: "#d98a27",
      learningDays: 30,
      learningComplete: true,
      explanation: lang === "am"
        ? "የዛሬው ምልክቶች የመራቢያ ጊዜ ሊሆን እንደሚችል ያሳያሉ። እርግዝናን ማስቀረት ከፈለጉ መከላከያ ይጠቀሙ።"
        : "Your cycle or mucus signs suggest this could be a fertile time. If you want to avoid pregnancy, use protection.",
    };
  }

  return {
    status: "uncertain",
    label: lang === "am" ? "በቂ መረጃ የለም" : "Not enough information",
    emoji: "⚪",
    color: "#85818c",
    learningDays: 30,
    learningComplete: true,
    explanation: lang === "am"
      ? "ዛሬ ያለው መረጃ የእርግዝና እድልን በእርግጠኝነት ለመገመት በቂ አይደለም። እርግዝናን ማስቀረት ከፈለጉ መከላከያ ይጠቀሙ።"
      : "There are not enough clear signs to estimate fertility today. If you want to avoid pregnancy, use protection.",
  };
}
