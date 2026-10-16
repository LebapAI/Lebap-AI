const { apiRequestId } = require("./apiRequestId");

function runMiddleware(headerValue) {
  const request = {
    get: jest.fn(() => headerValue),
    headers: {},
  };
  const response = {
    locals: {},
    setHeader: jest.fn(),
  };
  const next = jest.fn();

  apiRequestId(request, response, next);
  return { request, response, next };
}

describe("apiRequestId middleware", () => {
  test("preserves a safe caller-provided correlation ID", () => {
    const { response, next } = runMiddleware("req-123:attempt.2");

    expect(response.locals.requestId).toBe("req-123:attempt.2");
    expect(response.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      "req-123:attempt.2"
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("generates an ID when the header is missing", () => {
    const { response, next } = runMiddleware(undefined);

    expect(response.locals.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      response.locals.requestId
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  test.each([
    "contains spaces",
    "line\nbreak",
    "x".repeat(129),
    ["not", "a", "string"],
  ])("replaces an invalid request ID (%p)", (headerValue) => {
    const { response, next } = runMiddleware(headerValue);

    expect(response.locals.requestId).not.toBe(headerValue);
    expect(response.locals.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
