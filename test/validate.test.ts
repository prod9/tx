import { describe, expect, it } from "vitest";
import { all, group, minLen, nonNegative, positive, required } from "../src/validate.ts";

describe("validate", () => {
  it("passes when every check passes", () => {
    expect(all(required("title", "buy milk"), minLen("title", "buy milk", 3))).toBeUndefined();
  });

  it("collects every failed check by field", () => {
    const err = all(required("title", " "), minLen("title", "ab", 3), positive("count", 0));

    expect(err?.fields).toEqual({
      title: [
        { field: "title", message: "missing", value: " " },
        { field: "title", message: "too short, 3 characters required", value: "ab" },
      ],
      count: [{ field: "count", message: "must be positive", value: 0 }],
    });
  });

  it("prefixes grouped fields and merges nested results", () => {
    const err = all(
      group("address", required("city", ""), group("geo", nonNegative("lat", -1))),
      required("name", ""),
    );

    expect(Object.keys(err?.fields ?? {}).sort()).toEqual([
      "address.city",
      "address.geo.lat",
      "name",
    ]);
    expect(err?.fields["address.geo.lat"]?.[0]?.field).toBe("address.geo.lat");
  });
});
