import { describe, expect, it } from "vitest";
import { expandCellRefs, parseCellId } from "@/lib/engine/grid";

describe("grid", () => {
  it("parses cell ids", () => {
    expect(parseCellId("c4")).toEqual({ x: 2, y: 3 });
    expect(parseCellId("P1")).toBeNull();
    expect(parseCellId("A16")).toBeNull();
  });
  it("expands ranges", () => {
    expect(expandCellRefs("C4 through C6")).toEqual(["C4", "C5", "C6"]);
    expect(expandCellRefs("C4-D5")).toEqual(["C4", "D4", "C5", "D5"]);
    expect(expandCellRefs("H9, H10 and G9")).toEqual(["H9", "H10", "G9"]);
  });
});
