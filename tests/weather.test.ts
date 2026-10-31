import { describe, expect, it } from "vitest";
import { parseNwsElevation, tempAtElevation } from "@/lib/weather";

describe("elevation-adjusted temperature", () => {
  it("cools 6.5 °C per km going up and is unchanged without elevations", () => {
    expect(tempAtElevation(40, 1722, 1917)).toBe(38);
    expect(tempAtElevation(40, 1722, 1261)).toBe(45);
    expect(tempAtElevation(40, undefined, 1917)).toBe(40);
    expect(tempAtElevation(40, 1722, undefined)).toBe(40);
  });
  it("reads the NWS gridpoint elevation in metres or feet", () => {
    expect(parseNwsElevation({ properties: { elevation: { unitCode: "wmoUnit:m", value: 1722.12 } } })).toBeCloseTo(1722.12);
    expect(parseNwsElevation({ properties: { elevation: { unitCode: "wmoUnit:ft", value: 1000 } } })).toBeCloseTo(304.8);
    expect(parseNwsElevation({ properties: {} })).toBeUndefined();
  });
});
import {
  combinedFactor,
  currentPeriod,
  exposureRisk,
  HourlyPeriod,
  parseNwsHourly,
  parseWindMph,
  podModifiers,
  safetyFlags,
  windChillF,
} from "@/lib/weather";
import { cachedWeather } from "@/lib/demo/weather";
import { STYLIZED_TERRAIN } from "@/lib/terrain";

const fixture = {
  properties: {
    periods: [
      {
        number: 1,
        startTime: "2026-10-30T15:00:00-04:00",
        endTime: "2026-10-30T16:00:00-04:00",
        isDaytime: true,
        temperature: 38,
        temperatureUnit: "F",
        probabilityOfPrecipitation: { unitCode: "wmoUnit:percent", value: 40 },
        windSpeed: "10 to 20 mph",
        windDirection: "NW",
        shortForecast: "Areas Of Fog",
      },
      {
        number: 2,
        startTime: "2026-10-30T16:00:00-04:00",
        endTime: "2026-10-30T17:00:00-04:00",
        isDaytime: false,
        temperature: 2,
        temperatureUnit: "C",
        probabilityOfPrecipitation: { value: null },
        windSpeed: "55 mph",
        windDirection: "W",
        shortForecast: "Chance Thunderstorms",
      },
      { broken: true },
    ],
  },
};

const period = (o: Partial<HourlyPeriod>): HourlyPeriod => ({
  startTime: "2026-10-30T15:00:00Z",
  endTime: "2026-10-30T16:00:00Z",
  isDaytime: true,
  temperatureF: 60,
  windMph: 5,
  windDirection: "N",
  precipChance: 0,
  shortForecast: "Sunny",
  ...o,
});

describe("NWS parsing", () => {
  it("parses hourly periods tolerantly", () => {
    const ps = parseNwsHourly(fixture);
    expect(ps).toHaveLength(2);
    expect(ps[0]).toMatchObject({ temperatureF: 38, windMph: 20, precipChance: 40, shortForecast: "Areas Of Fog" });
    expect(ps[1]).toMatchObject({ temperatureF: 36, windMph: 55, precipChance: 0, isDaytime: false });
  });
  it("throws on a malformed response", () => {
    expect(() => parseNwsHourly({})).toThrow();
  });
  it("parses wind strings", () => {
    expect(parseWindMph("5 to 10 mph")).toBe(10);
    expect(parseWindMph("15 mph")).toBe(15);
    expect(parseWindMph(undefined)).toBe(0);
  });
});

describe("derived weather", () => {
  it("computes NWS wind chill", () => {
    expect(windChillF(30, 20)).toBe(17);
    expect(windChillF(60, 20)).toBe(60);
  });
  it("lowers POD for fog, rain and darkness", () => {
    const mods = podModifiers(period({ shortForecast: "Fog And Light Rain", isDaytime: false }));
    expect(mods.map((m) => m.key)).toEqual(["fog", "rain", "darkness"]);
    expect(mods[0].label).toBe("fog: −30% expected detection");
    expect(combinedFactor(mods)).toBeCloseTo(0.336);
    expect(podModifiers(period({}))).toEqual([]);
  });
  it("labels exposure risk without survival times", () => {
    expect(exposureRisk(period({})).level).toBe("low");
    expect(exposureRisk(period({ temperatureF: 35, windMph: 20, shortForecast: "Rain" })).level).toBe("high");
    expect(exposureRisk(period({ temperatureF: 10, windMph: 30 })).level).toBe("severe");
    expect(JSON.stringify(exposureRisk(period({ temperatureF: 10, windMph: 30 })))).not.toMatch(/hour|minute|surviv/i);
  });
  it("flags high ridge winds and thunderstorms", () => {
    const flags = safetyFlags(parseNwsHourly(fixture), STYLIZED_TERRAIN.cells);
    expect(flags.some((f) => /50 mph/.test(f.text) && f.cells.length > 0)).toBe(true);
    expect(flags.some((f) => /Thunder/.test(f.text))).toBe(true);
  });
  it("cached weather has a current period", () => {
    const snap = cachedWeather();
    expect(snap.source).toBe("cached");
    expect(currentPeriod(snap)).not.toBeNull();
  });
});
