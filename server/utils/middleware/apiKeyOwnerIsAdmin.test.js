jest.mock("../../models/user", () => ({
  User: {
    getForAuthorization: jest.fn(),
  },
}));

const { User } = require("../../models/user");
const { apiKeyOwnerIsAdmin } = require("./apiKeyOwnerIsAdmin");

function makeResponse(apiKey = {}) {
  const response = {
    locals: { apiKey },
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe("apiKeyOwnerIsAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows an active administrator-owned API key", async () => {
    User.getForAuthorization.mockResolvedValue({
      id: 7,
      role: "admin",
      suspended: 0,
    });
    const response = makeResponse({ createdBy: 7 });
    const next = jest.fn();

    await apiKeyOwnerIsAdmin({}, response, next);

    expect(User.getForAuthorization).toHaveBeenCalledWith({ id: 7 });
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test.each([undefined, null, 0, "not-a-user-id"])(
    "rejects an API key without a valid owner (%s)",
    async (createdBy) => {
      const response = makeResponse({ createdBy });
      const next = jest.fn();

      await apiKeyOwnerIsAdmin({}, response, next);

      expect(User.getForAuthorization).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        error: "Administrator-owned API key required.",
      });
      expect(next).not.toHaveBeenCalled();
    }
  );

  test.each([
    [{ id: 8, role: "default", suspended: 0 }, "non-admin"],
    [{ id: 8, role: "admin", suspended: 1 }, "suspended admin"],
    [null, "missing owner record"],
  ])("rejects a %s", async (owner) => {
    User.getForAuthorization.mockResolvedValue(owner);
    const response = makeResponse({ createdBy: 8 });
    const next = jest.fn();

    await apiKeyOwnerIsAdmin({}, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "Administrator privileges required.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("fails closed when the owner lookup throws", async () => {
    User.getForAuthorization.mockRejectedValue(new Error("database failure"));
    const response = makeResponse({ createdBy: 7 });
    const next = jest.fn();
    const originalError = console.error;
    console.error = jest.fn();

    try {
      await apiKeyOwnerIsAdmin({}, response, next);
    } finally {
      console.error = originalError;
    }

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "Authorization service unavailable.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
