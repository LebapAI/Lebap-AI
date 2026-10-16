const { randomUUID } = require("crypto");

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * Attach a safe correlation ID to API requests and responses.
 * A caller-provided ID is accepted only when it is a short, printable token;
 * otherwise the server creates one. Never use this value as an auth token.
 */
function apiRequestId(request, response, next) {
  const supplied =
    typeof request.get === "function"
      ? request.get("X-Request-Id")
      : request.headers?.["x-request-id"];

  const requestId =
    typeof supplied === "string" && SAFE_REQUEST_ID.test(supplied)
      ? supplied
      : randomUUID();

  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  return next();
}

module.exports = { apiRequestId };
