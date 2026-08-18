import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const projectRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const wrangler = join(projectRoot, "node_modules", ".bin", "wrangler");
const config = join(
  projectRoot,
  "tests",
  "fixtures",
  "wrangler.integration.jsonc",
);
const fixtureWranglerDirectory = join(projectRoot, "tests", "fixtures", ".wrangler");

test(
  "built API routes run against a migrated D1 database in workerd",
  { timeout: 30_000 },
  async () => {
    const persistDirectory = await mkdtemp(join(tmpdir(), "pluginhub-workerd-"));
    const wranglerEnvironment = {
      ...process.env,
      WRANGLER_LOG_PATH: join(persistDirectory, "wrangler.log"),
    };
    let worker;

    try {
      await runWrangler(
        [
          "d1",
          "migrations",
          "apply",
          "pluginhub-integration",
          "--local",
          "--config",
          config,
          "--persist-to",
          persistDirectory,
        ],
        wranglerEnvironment,
      );
      await runWrangler(
        [
          "d1",
          "execute",
          "pluginhub-integration",
          "--local",
          "--config",
          config,
          "--persist-to",
          persistDirectory,
          "--command",
          `INSERT INTO waitlist_signups
           (id, email, locale, source, unsubscribe_token, followup_status)
           VALUES ('runtime-signup', 'runtime@example.com', 'en', 'direct',
                   'runtime-unsubscribe-token', 'not_sent')`,
        ],
        wranglerEnvironment,
      );

      const port = await openPort();
      worker = spawn(
        wrangler,
        [
          "dev",
          "--config",
          config,
          "--persist-to",
          persistDirectory,
          "--port",
          String(port),
          "--local",
          "--log-level",
          "error",
        ],
        {
          cwd: projectRoot,
          env: wranglerEnvironment,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const output = collectOutput(worker);
      const origin = `http://127.0.0.1:${port}`;
      await waitForWorker(`${origin}/api/health`, worker, output);

      const healthResponse = await fetch(`${origin}/api/health`);
      assert.equal(healthResponse.status, 200);
      assert.deepEqual(await healthResponse.json(), {
        status: "ok",
        database: "reachable",
      });

      const unauthorizedResponse = await fetch(
        `${origin}/api/admin/waitlist/stats`,
      );
      assert.equal(unauthorizedResponse.status, 401);

      const signupResponse = await fetch(`${origin}/api/waitlist`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({
          email: "new-member@example.com",
          locale: "en",
          turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
        }),
      });
      assert.equal(signupResponse.status, 201);
      assert.deepEqual(await signupResponse.json(), {
        status: "created",
        emailStatus: "queued",
      });

      const adminToken = await deriveAdminBearer("integration-admin-secret");
      const summary = await waitForStats(origin, adminToken, (candidate) =>
        candidate.total === 2 && candidate.emailFailed === 1,
      );
      assert.deepEqual(summary, {
        total: 2,
        active: 2,
        unsubscribed: 0,
        emailDelivered: 0,
        emailQueued: 0,
        emailPending: 1,
        emailFailed: 1,
        emailFailedLast24Hours: 1,
        emailPendingOver15Minutes: 0,
      });

      const databaseResult = await runWrangler(
        [
          "d1",
          "execute",
          "pluginhub-integration",
          "--local",
          "--config",
          config,
          "--persist-to",
          persistDirectory,
          "--json",
          "--command",
          `SELECT
             (SELECT count(*) FROM waitlist_signups) AS signup_count,
             (SELECT count(*) FROM waitlist_rate_limits) AS rate_limit_count`,
        ],
        wranglerEnvironment,
      );
      const databaseRows = JSON.parse(databaseResult.stdout);
      assert.equal(databaseRows[0].results[0].signup_count, 2);
      assert.equal(databaseRows[0].results[0].rate_limit_count, 2);

      const unsubscribeResponse = await fetch(
        `${origin}/api/waitlist/unsubscribe?token=runtime-unsubscribe-token`,
        { method: "POST" },
      );
      assert.equal(unsubscribeResponse.status, 200);
      assert.deepEqual(await unsubscribeResponse.json(), { status: "done" });

      const afterResponse = await fetch(`${origin}/api/admin/waitlist/stats`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const after = await afterResponse.json();
      assert.equal(after.summary.active, 1);
      assert.equal(after.summary.unsubscribed, 1);

      const englishResponse = await fetch(`${origin}/en`);
      assert.equal(englishResponse.status, 200);
      assert.match(await englishResponse.text(), /^<!DOCTYPE html><html lang="en">/i);
    } finally {
      if (worker && worker.exitCode === null) {
        worker.kill("SIGTERM");
        await Promise.race([once(worker, "exit"), delay(2_000)]);
        if (worker.exitCode === null) worker.kill("SIGKILL");
      }
      await rm(persistDirectory, { recursive: true, force: true });
      await rm(fixtureWranglerDirectory, { recursive: true, force: true });
    }
  },
);

async function runWrangler(arguments_, environment) {
  return execFileAsync(wrangler, arguments_, {
    cwd: projectRoot,
    env: environment,
    maxBuffer: 2 * 1024 * 1024,
  });
}

async function openPort() {
  const server = createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function collectOutput(worker) {
  let output = "";
  for (const stream of [worker.stdout, worker.stderr]) {
    stream.on("data", (chunk) => {
      output = `${output}${chunk}`.slice(-8_000);
    });
  }
  return () => output;
}

async function waitForWorker(url, worker, output) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) {
      throw new Error(`workerd exited before startup\n${output()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local listener is still starting.
    }
    await delay(100);
  }
  throw new Error(`workerd startup timed out\n${output()}`);
}

async function waitForStats(origin, adminToken, predicate) {
  const deadline = Date.now() + 8_000;
  let lastSummary;
  while (Date.now() < deadline) {
    const response = await fetch(`${origin}/api/admin/waitlist/stats`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(response.status, 200);
    lastSummary = (await response.json()).summary;
    if (predicate(lastSummary)) return lastSummary;
    await delay(100);
  }
  throw new Error(`timed out waiting for stats: ${JSON.stringify(lastSummary)}`);
}

async function deriveAdminBearer(secret) {
  const bytes = new TextEncoder().encode(`pluginhub-waitlist-stats:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
