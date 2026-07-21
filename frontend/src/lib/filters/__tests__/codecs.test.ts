import { booleanCodec, enumCodec, numberCodec } from "@/lib/filters/codecs";

describe("enumCodec", () => {
  const codec = enumCodec(["office", "desk"] as const);

  it("parses values in the allowed list", () => {
    expect(codec.parse("desk")).toBe("desk");
  });

  it("returns undefined for values outside the allowed list", () => {
    expect(codec.parse("InvalidType")).toBeUndefined();
  });

  it("serializes back to the raw string", () => {
    expect(codec.serialize("office")).toBe("office");
  });
});

describe("booleanCodec", () => {
  const codec = booleanCodec();

  it("parses 'true' and 'false'", () => {
    expect(codec.parse("true")).toBe(true);
    expect(codec.parse("false")).toBe(false);
  });

  it("returns undefined for anything else", () => {
    expect(codec.parse("yes")).toBeUndefined();
  });
});

describe("numberCodec", () => {
  const codec = numberCodec();

  it("parses finite numeric strings", () => {
    expect(codec.parse("42")).toBe(42);
  });

  it("returns undefined for non-numeric strings", () => {
    expect(codec.parse("abc")).toBeUndefined();
  });
});
