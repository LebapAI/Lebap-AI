const { ApiKey } = require("../../models/apiKeys");
const { SystemSettings } = require("../../models/systemSettings");
const { validApiKey } = require("./validApiKey");

jest.mock("../../models/apiKeys", () => ({
  ApiKey: {
    getForAuthentication: jest.fn(),
  },
}));

jest.mock("../../models/systemSettings", () => ({
  SystemSettings: {
    isMultiUserMode: jest.fn(),
  },
}));

function makeRequest(authorization) {
  return {
    header: jest.fn(() => authorization),
  };
}

function makeResponse() {
  const response = {
    locals: {},
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe("validApiKey middleware", () => {
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    SystemSettings.isMultiUserMode.mockResolvedValue(false);
    ApiKey.getForAuthentication.mockResolvedValue({ id: 1 });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ["missing header", undefined],
    ["empty header", ""],
    ["wrong scheme", "Basic abc123"],
    ["missing token", "Bearer"],
    ["extra token parts", "Bearer abc123 extra"],
    ["leading token only", "abc123"],
  ])("rejects %s without looking up a key", async (_label, authorization) => {
    const request = makeRequest(authorization);
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "No valid api key found.",
    });
    expect(ApiKey.getForAuthentication).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("accepts a valid Bearer token and continues", async () => {
    const request = makeRequest("Bearer secret-value");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.locals.multiUserMode).toBe(false);
    expect(ApiKey.getForAuthentication).toHaveBeenCalledWith({ secret: "secret-value" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("accepts the Bearer scheme case-insensitively", async () => {
    const request = makeRequest("bEaReR secret-value");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(ApiKey.getForAuthentication).toHaveBeenCalledWith({ secret: "secret-value" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("rejects a token that does not match a stored key", async () => {
    ApiKey.getForAuthentication.mockResolvedValue(null);
    const request = makeRequest("Bearer unknown-value");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: "No valid api key found.",
    });
    expect(next).not.toHaveBeenCalled();
  });


  test("returns a generic 500 if API key storage is unavailable", async () => {
    ApiKey.getForAuthentication.mockRejectedValue(new Error("private database details"));
    const request = makeRequest("Bearer secret-value");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "Authentication service unavailable.",
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain("private database details");
    expect(next).not.toHaveBeenCalled();
  });

  test("fails closed if multi-user settings cannot be read", async () => {
    SystemSettings.isMultiUserMode.mockRejectedValue(new Error("database unavailable"));
    const request = makeRequest("Bearer secret-value");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "Authentication service unavailable.",
    });
    expect(ApiKey.getForAuthentication).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "API key authentication failed due to an internal error."
    );
  });

  test("stores only non-secret API key metadata for downstream authorization", async () => {
    ApiKey.getForAuthentication.mockResolvedValue({
      id: 12,
      createdBy: 7,
      name: "automation",
      secret: "must-not-be-copied",
    });
    const request = makeRequest("Bearer supplied-secret");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.locals.apiKey).toEqual({
      id: 12,
      createdBy: 7,
      name: "automation",
      expiresAt: null,
      revokedAt: null,
    });
    expect(JSON.stringify(response.locals)).not.toContain("supplied-secret");
    expect(JSON.stringify(response.locals)).not.toContain("must-not-be-copied");
    expect(next).toHaveBeenCalledTimes(1);
  });


  test("rejects a revoked credential", async () => {
    ApiKey.getForAuthentication.mockResolvedValue({
      id: 13,
      createdBy: 7,
      revokedAt: new Date(),
      expiresAt: null,
    });
    const request = makeRequest("Bearer revoked-secret");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "No valid api key found." });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects an expired credential", async () => {
    ApiKey.getForAuthentication.mockResolvedValue({
      id: 14,
      createdBy: 7,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const request = makeRequest("Bearer expired-secret");
    const response = makeResponse();

    await validApiKey(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "No valid api key found." });
    expect(next).not.toHaveBeenCalled();
  });

});