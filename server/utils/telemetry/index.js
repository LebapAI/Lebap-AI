const { getGitVersion } = require("../../endpoints/utils");
const { Telemetry } = require("../../models/telemetry");

// Telemetry sends usage events only to the configured project. Disable it by setting
// DISABLE_TELEMETRY=true in the server environment, or leave LEBAP_AI_TELEMETRY_KEY unset.
//
// You can see all Telemetry events by ctrl+f `Telemetry.sendTelemetry` calls to verify this claim.
async function setupTelemetry() {
  if (process.env.DISABLE_TELEMETRY === "true" || !Telemetry.pubkey) {
    console.log(
      `\x1b[31m[TELEMETRY DISABLED]\x1b[0m Telemetry is disabled or no LEBAP_AI_TELEMETRY_KEY is configured; no events will be sent.`
    );
    return true;
  }

  if (Telemetry.isDev()) {
    console.log(
      `\x1b[33m[TELEMETRY STUBBED]\x1b[0m Anonymous Telemetry stubbed in development.`
    );
    return;
  }

  console.log(
    `\x1b[32m[TELEMETRY ENABLED]\x1b[0m Anonymous telemetry is enabled.`
  );
  await Telemetry.findOrCreateId();
  await Telemetry.sendTelemetry("server_boot", {
    commit: getGitVersion(),
  });
  return;
}

module.exports = setupTelemetry;
