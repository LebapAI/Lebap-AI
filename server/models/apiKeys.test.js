const crypto = require("crypto");
const prisma = require("../utils/prisma");
const { ApiKey } = require("./apiKeys");

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
