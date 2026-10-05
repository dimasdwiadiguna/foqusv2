import { describe, expect, it } from "vitest";
import { moveItem, nextOrder, reorderSubset } from "./order";

describe("order helpers", () => {
  it("moves an item to another's position", () => {
    expect(moveItem(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveItem(["a", "b"], "a", "x")).toEqual(["a", "b"]);
  });

  it("reorders a visible subset in place", () => {
    // Goals a..e by rank; the season shows b, d, e. Dragging e to the top of that view.
    expect(reorderSubset(["a", "b", "c", "d", "e"], ["e", "b", "d"])).toEqual(["a", "e", "c", "b", "d"]);
    expect(reorderSubset(["a", "b"], ["b", "a", "zzz"])).toEqual(["b", "a"]);
  });

  it("finds the next sort order", () => {
    expect(nextOrder([])).toBe(0);
    expect(nextOrder([3, 1])).toBe(4);
  });
});
