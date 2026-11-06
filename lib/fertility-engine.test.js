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
