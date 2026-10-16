jest.mock("../../../models/eventLogs", () => ({ EventLogs: {} }));
jest.mock("../../../models/systemSettings", () => ({ SystemSettings: {} }));
jest.mock("../../../utils/files/purgeDocument", () => ({ purgeDocument: jest.fn() }));
jest.mock("../../../utils/helpers", () => ({ getVectorDbClass: jest.fn() }));
jest.mock("../../../utils/helpers/chat/convertTo", () => ({
  exportChatsAsType: jest.fn(),
  validExportTypes: ["jsonl", "json", "csv", "jsonAlpaca"],
}));
jest.mock("../../../utils/helpers/updateENV", () => ({ updateENV: jest.fn() }));
jest.mock("../../../utils/http", () => ({ reqBody: jest.fn() }));
jest.mock("../../../utils/middleware/validApiKey", () => ({
  validApiKey: jest.fn(),
}));
jest.mock("../../../utils/middleware/apiKeyOwnerIsAdmin", () => ({
  apiKeyOwnerIsAdmin: jest.fn(),
}));

const { apiSystemEndpoints } = require("./index");
const { validApiKey } = require("../../../utils/middleware/validApiKey");
const { apiKeyOwnerIsAdmin } = require("../../../utils/middleware/apiKeyOwnerIsAdmin");

function registerRoutes() {
  const routes = new Map();
  const app = {
    get: jest.fn((path, middleware, handler) =>
      routes.set(`GET ${path}`, { middleware, handler })
    ),
    post: jest.fn((path, middleware, handler) =>
      routes.set(`POST ${path}`, { middleware, handler })
    ),
    delete: jest.fn((path, middleware, handler) =>
      routes.set(`DELETE ${path}`, { middleware, handler })
    ),
  };
  apiSystemEndpoints(app);
  return routes;
}

describe("system API authorization", () => {
  test.each([
    "GET /v1/system/env-dump",
    "GET /v1/system",
    "GET /v1/system/vector-count",
    "POST /v1/system/update-env",
    "GET /v1/system/export-chats",
    "DELETE /v1/system/remove-documents",
  ])("%s requires API-key authentication and administrator authorization", (route) => {
    const routes = registerRoutes();
    const registered = routes.get(route);

    expect(registered).toBeDefined();
    expect(registered.middleware).toEqual([validApiKey, apiKeyOwnerIsAdmin]);
  });
});
