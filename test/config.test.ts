import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { bool, boolDef, get, int, intDef, str, strDef } from "../src/config.ts";

// Resolution rules: docs/spec/configuration.md

describe("config", () => {
  it("reads from the Workers env bindings", () => {
    expect(get(env, strDef("GREETING", "fallback"))).toBe("hello");
  });

  it("reads a set string", () => {
    expect(get({ NAME: "tx" }, strDef("NAME", "fallback"))).toBe("tx");
  });

  it("yields the default for an unset or blank value", () => {
    const name = strDef("NAME", "fallback");

    expect(get({}, name)).toBe("fallback");
    expect(get({ NAME: "  " }, name)).toBe("fallback");
    expect(get({}, str("NAME"))).toBe("");
  });

  it("parses integers from strings and wrangler JSON numbers", () => {
    const limit = intDef("LIMIT", 10);

    expect(get({ LIMIT: "25" }, limit)).toBe(25);
    expect(get({ LIMIT: " -3 " }, limit)).toBe(-3);
    expect(get({ LIMIT: 40 }, limit)).toBe(40);
    expect(get({}, int("LIMIT"))).toBe(0);
  });

  it("yields the default for a value that does not parse", () => {
    const limit = intDef("LIMIT", 10);

    expect(get({ LIMIT: "2.5" }, limit)).toBe(10);
    expect(get({ LIMIT: "ten" }, limit)).toBe(10);
    expect(get({ LIMIT: 2.5 }, limit)).toBe(10);
    expect(get({ LIMIT: { n: 1 } }, limit)).toBe(10);
  });

  it("parses booleans the way Go's strconv.ParseBool does", () => {
    const debug = boolDef("DEBUG", false);

    expect(get({ DEBUG: "true" }, debug)).toBe(true);
    expect(get({ DEBUG: "1" }, debug)).toBe(true);
    expect(get({ DEBUG: "T" }, debug)).toBe(true);
    expect(get({ DEBUG: true }, debug)).toBe(true);
    expect(get({ DEBUG: "FALSE" }, boolDef("DEBUG", true))).toBe(false);
    expect(get({ DEBUG: "yes" }, debug)).toBe(false);
    expect(get({}, bool("DEBUG"))).toBe(false);
  });
});
