const crypto = require("crypto");
const prisma = require("../utils/prisma");
const { ApiKey, publicApiKey } = require("./apiKeys");

jest.mock("../utils/prisma", () => ({
  api_keys: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
}));

describe("ApiKey secret storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("persists a one-way verifier and returns the raw secret only to the caller", async () => {
    const secret = "new-random-api-key";
    jest.spyOn(ApiKey, "makeSecret").mockReturnValue(secret);
    prisma.api_keys.create.mockImplementation(async ({ data }) => ({
      id: 42,
      ...data,
    }));

    const result = await ApiKey.create(7, "automation", { expiresAt: null });
    const stored = prisma.api_keys.create.mock.calls[0][0].data;
    const expectedHash = crypto.createHash("sha256").update(secret, "utf8").digest("hex");

    expect(stored.secret).toBeNull();
    expect(stored.secretHash).toBe(expectedHash);
    expect(result.apiKey.secret).toBe(secret);
    expect(result.apiKey.secretHash).toBe(expectedHash);
    expect(JSON.stringify(stored)).not.toContain(secret);
  });

  test("authenticates new keys using the verifier hash", async () => {
    prisma.api_keys.findFirst.mockResolvedValue({ id: 1 });
    const secret = "new-random-api-key";
    const expectedHash = crypto.createHash("sha256").update(secret, "utf8").digest("hex");

    await ApiKey.getForAuthentication({ secret });

    expect(prisma.api_keys.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { secretHash: expectedHash },
          { secret },
        ],
      },
    });
  });

  test("retains a legacy raw-secret lookup during migration", async () => {
    prisma.api_keys.findFirst.mockResolvedValue({ id: 2, secret: "legacy-key" });

    await ApiKey.getForAuthentication({ secret: "legacy-key" });

    expect(prisma.api_keys.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { secretHash: ApiKey.hashSecret("legacy-key") },
          { secret: "legacy-key" },
        ],
      },
    });
  });
});

describe("public API key projection", () => {
  test("never returns raw secrets or secret verifiers and parses workspace scope", () => {
    const result = publicApiKey({
      id: 3,
      name: "automation",
      secret: "raw-secret",
      secretHash: "one-way-verifier",
      workspaceSlugs: '["workspace-a","workspace-b"]',
      expiresAt: null,
      revokedAt: null,
    });

    expect(result).toMatchObject({
      id: 3,
      name: "automation",
      workspaceSlugs: ["workspace-a", "workspace-b"],
      status: "active",
    });
    expect(result).not.toHaveProperty("secret");
    expect(result).not.toHaveProperty("secretHash");
    expect(JSON.stringify(result)).not.toContain("raw-secret");
    expect(JSON.stringify(result)).not.toContain("one-way-verifier");
  });

  test("treats malformed workspace scopes as restricted", () => {
    expect(publicApiKey({ id: 4, workspaceSlugs: "not-json" }).workspaceSlugs).toEqual([]);
    expect(publicApiKey({ id: 5, workspaceSlugs: "[]" }).workspaceSlugs).toEqual([]);
  });

  test("marks revoked and expired credentials accurately", () => {
    expect(publicApiKey({ id: 6, revokedAt: new Date() }).status).toBe("revoked");
    expect(publicApiKey({ id: 7, expiresAt: "2000-01-01T00:00:00.000Z" }).status).toBe("expired");
  });
});
