import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFertility, hasTemperatureShift } from "./fertility-engine.js";

test("does not label a day infertile when evidence is missing", () => {
  const result = analyzeFertility({ today: "2026-11-07", lastPeriodStart: "2026-10-09", averageCycleLength: 30 });
  assert.equal(result.lowerFertilityConfirmed, false);
  assert.equal(result.status, "uncertain");
});

test("fertile-type mucus marks the day potentially fertile", () => {
  const result = analyzeFertility({
    today: "2026-11-07",
    lastPeriodStart: "2026-10-20",
    observations: [{ observed_on: "2026-11-07", cervical_mucus: "egg-white" }],
  });
  assert.equal(result.status, "potentially-fertile");
});

test("breastfeeding is flagged and calendar estimate is not used to claim safe days", () => {
  const result = analyzeFertility({
    today: "2026-11-07",
    lastPeriodStart: "2026-10-20",
    averageCycleLength: 30,
    breastfeeding: true,
  });
  assert.ok(result.flags.includes("breastfeeding"));
  assert.equal(result.lowerFertilityConfirmed, false);
});

test("temperature shift is only reported as a possible signal", () => {
  const readings = [36.3,36.35,36.32,36.31,36.34,36.33,36.6,36.62,36.61].map((v,i)=>({
    observed_on: new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10),
    basal_temperature_c: v
  }));
  assert.equal(hasTemperatureShift(readings).detected, true);
});

test("early postpartum suppresses calendar-only window", () => {
  const result = analyzeFertility({
    today: "2026-11-07",
    lastPeriodStart: "2026-10-20",
    averageCycleLength: 30,
    postpartumWeeks: 4,
  });
  assert.equal(result.potentialFertileWindow, null);
  assert.ok(result.flags.includes("early-postpartum"));
  assert.equal(result.lowerFertilityConfirmed, false);
});


test("rejects impossible calendar dates instead of normalizing them", () => {
  const result = analyzeFertility({
    today: "2026-02-31",
    lastPeriodStart: "2026-02-01",
    averageCycleLength: 30,
  });
  assert.equal(result.status, "uncertain");
  assert.equal(result.cycleDay, null);
});

test("future-dated temperature readings are not used", () => {
  const futureReadings = [36.3,36.35,36.32,36.31,36.34,36.33,36.6,36.62,36.61].map((v,i)=>({
    observed_on: new Date(Date.UTC(2026,10,8+i)).toISOString().slice(0,10),
    basal_temperature_c: v
  }));
  const result = analyzeFertility({
    today: "2026-11-07",
    lastPeriodStart: "2026-10-20",
    observations: futureReadings,
  });
  assert.equal(result.possibleOvulationShift.detected, false);
});

test("irregular cycle history suppresses calendar caution window", () => {
  const result = analyzeFertility({
    today: "2026-11-07",
    lastPeriodStart: "2026-10-20",
    cycleLengths: [25, 30, 36],
  });
  assert.equal(result.potentialFertileWindow, null);
  assert.ok(result.flags.includes("irregular-cycle-or-bleeding"));
  assert.equal(result.lowerFertilityConfirmed, false);
});


test("accepts valid ISO dates and rejects malformed or impossible dates", () => {
  const valid = analyzeFertility({ today: "2024-02-29", lastPeriodStart: "2024-02-01" });
  assert.equal(valid.cycleDay, 29);
  for (const invalid of ["2026-02-31", "2026-13-01", "07-11-2026", "2026-2-01", "not-a-date"]) {
    const result = analyzeFertility({ today: invalid, lastPeriodStart: "2026-10-01" });
    assert.equal(result.status, "uncertain", invalid);
    assert.equal(result.cycleDay, null, invalid);
  }
});

test("does not accept a malformed observation as a temperature reading", () => {
  const readings = [36.3,36.35,36.32,36.31,36.34,36.33,36.6,36.62,36.61].map((v,i)=>({
    observed_on: i === 4 ? "2026-02-31" : new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10),
    basal_temperature_c: v
  }));
  const result = analyzeFertility({
    today: "2026-11-07",
    lastPeriodStart: "2026-10-01",
    observations: readings,
  });
  assert.equal(result.possibleOvulationShift.detected, false);
});
