const { normalizeEmbeddingInput } = require("./helpers");

describe("OpenAI-compatible embedding input validation", () => {
  test("normalizes a single non-empty string", () => {
    expect(normalizeEmbeddingInput("hello")).toEqual({
      input: ["hello"],
      error: null,
    });
  });

  test("accepts a non-empty array of non-empty strings", () => {
    expect(normalizeEmbeddingInput(["first", "second"])).toEqual({
      input: ["first", "second"],
      error: null,
    });
  });

  test.each([
    [undefined, /string or a non-empty array/],
    [null, /string or a non-empty array/],
    ["", /non-empty string/],
    ["   ", /non-empty string/],
    [[], /string or a non-empty array/],
    [["valid", 12], /Every embedding input/],
    [{ text: "not a string" }, /string or a non-empty array/],
    [42, /string or a non-empty array/],
  ])("rejects invalid payload %p", (value, error) => {
    const result = normalizeEmbeddingInput(value);
    expect(result.input).toBeNull();
    expect(result.error).toMatch(error);
  });
});
