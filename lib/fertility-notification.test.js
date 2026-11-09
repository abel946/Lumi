import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyFertilityNotification, countLearningDays } from "./fertility-notification.js";

const thirtyDays = Array.from({ length: 30 }, (_, index) => ({
  observed_on: new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10),
  cervical_mucus: "dry",
}));

test("counts only days with a real observation", () => {
  assert.equal(countLearningDays([...thirtyDays, { observed_on: "2026-11-01" }]), 30);
});

test("keeps the report uncertain during the 30-day learning period", () => {
  const report = buildDailyFertilityNotification({
    fertilityResult: { flags: ["fertile-type-mucus-observed"] },
    learningDays: 12,
    language: "en",
  });
  assert.equal(report.status, "uncertain");
  assert.equal(report.learningComplete, false);
});

test("uses red higher-chance status for fertile-type mucus after learning", () => {
  const report = buildDailyFertilityNotification({
    fertilityResult: { flags: ["fertile-type-mucus-observed"] },
    learningDays: 30,
    language: "en",
  });
  assert.equal(report.status, "higher");
  assert.equal(report.emoji, "🔴");
});

test("uses orange possible status for a changing mucus pattern", () => {
  const report = buildDailyFertilityNotification({
    fertilityResult: { flags: ["mucus-pattern-needs-observation"] },
    learningDays: 30,
    language: "en",
  });
  assert.equal(report.status, "possible");
  assert.equal(report.emoji, "🟠");
});

test("does not invent a green lower-chance day when evidence is insufficient", () => {
  const report = buildDailyFertilityNotification({
    fertilityResult: { flags: [], possibleOvulationShift: { detected: true } },
    learningDays: 30,
    language: "en",
  });
  assert.equal(report.status, "uncertain");
  assert.equal(report.emoji, "⚪");
});

test("uses Amharic text for Amharic users", () => {
  const report = buildDailyFertilityNotification({
    fertilityResult: { flags: ["fertile-type-mucus-observed"] },
    learningDays: 30,
    language: "am",
  });
  assert.match(report.label, /የእርግዝና/);
});
