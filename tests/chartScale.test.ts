import { describe, expect, it } from "vitest";
import { niceDomain, scaleLinear } from "@/lib/chartScale";

describe("chart scales", () => {
  it("niceDomain pads and rounds outward, and handles empty or flat input", () => {
    expect(niceDomain([])).toEqual([0, 1]);
    expect(niceDomain([41])).toEqual([30, 55]);
    expect(niceDomain([38, 52])).toEqual([30, 60]);
    expect(niceDomain([0, 12], 0, 5)).toEqual([0, 15]);
  });
  it("scaleLinear maps the domain onto the range (and inverted ranges)", () => {
    expect(scaleLinear([0, 10], [0, 100])(5)).toBe(50);
    expect(scaleLinear([0, 10], [100, 0])(2.5)).toBe(75);
    expect(scaleLinear([3, 3], [0, 10])(3)).toBe(0);
  });
});
