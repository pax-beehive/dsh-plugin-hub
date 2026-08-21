import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfficialPluginInstallCommand,
  isValidTargetProfile,
  pinInstallSpec,
} from "../lib/install-command.ts";

test("builds the official zero-install DSH plugin command with web by default", () => {
  assert.equal(
    buildOfficialPluginInstallCommand("@example/hello@1.2.3"),
    "npx -y @deepseek-ai/dsh plugin --profile web add @example/hello@1.2.3",
  );
});

test("allows safe custom target profiles and rejects shell-shaped names", () => {
  assert.equal(
    buildOfficialPluginInstallCommand("dsh-memory@2.0.0", "research_2026"),
    "npx -y @deepseek-ai/dsh plugin --profile research_2026 add dsh-memory@2.0.0",
  );
  assert.equal(isValidTargetProfile("headless"), true);
  assert.equal(isValidTargetProfile("../../web"), false);
  assert.equal(isValidTargetProfile("web;echo"), false);
  assert.throws(() => buildOfficialPluginInstallCommand("pkg@1.0.0", "web;echo"));
  assert.throws(() => buildOfficialPluginInstallCommand("pkg@1.0.0; echo unsafe"));
});

test("pins install specs to package@version for scoped and unscoped names", () => {
  assert.equal(pinInstallSpec("dshmarket", "1.17.1"), "dshmarket@1.17.1");
  assert.equal(pinInstallSpec("@deepseek-ai/dsh-base", "0.2.0"), "@deepseek-ai/dsh-base@0.2.0");
  assert.equal(
    buildOfficialPluginInstallCommand(pinInstallSpec("@acme/hello", "1.2.3")),
    "npx -y @deepseek-ai/dsh plugin --profile web add @acme/hello@1.2.3",
  );
});
