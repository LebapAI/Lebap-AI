const { resolveApiKeyExpiry } = require("./apiKeyExpiry");

describe("resolveApiKeyExpiry", () => {
  test.each([undefined, null, "never"])("supports no expiration: %p", (value) => {
    expect(resolveApiKeyExpiry(value)).toEqual({ expiresAt: null, error: null });
  });

  test.each([30, 90, 365, "30", "90", "365"])(
    "resolves allowed expiry of %p days",
    (value) => {
      const before = Date.now();
      const result = resolveApiKeyExpiry(value);
      const after = Date.now();
      const lifetime = Number(value) * 24 * 60 * 60 * 1000;

      expect(result.error).toBeNull();
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + lifetime);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + lifetime);
    }
  );

  test.each(["", "0", 0, 1, 29, 31, 180, 999, -30, 30.5, {}, []])(
    "rejects unsupported expiry %p",
    (value) => {
      expect(resolveApiKeyExpiry(value)).toMatchObject({
        expiresAt: null,
        error: expect.stringContaining("expiresInDays"),
      });
    }
  );
});
