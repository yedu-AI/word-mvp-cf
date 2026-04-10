const apiBase = process.env.API_BASE ?? "http://127.0.0.1:8787";
const username = process.env.AUTH_USERNAME ?? "admin";
const password = process.env.AUTH_PASSWORD ?? "Admin123!";

function fail(message) {
  console.error(`[auth-verify] ${message}`);
  process.exit(1);
}

async function expectJson(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    fail(`${label} returned non-JSON response (status ${response.status})`);
  }
  return body;
}

async function verifyHealth() {
  const response = await fetch(`${apiBase}/health`);
  const body = await expectJson(response, "GET /health");
  if (!response.ok || body.ok !== true) {
    fail(`GET /health failed with status ${response.status}`);
  }
  console.log("[auth-verify] GET /health ok");
}

async function login(pwd) {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username, password: pwd })
  });
  const body = await expectJson(response, "POST /api/auth/login");
  return { response, body };
}

async function verifyLoginSuccess() {
  const { response, body } = await login(password);
  if (response.status !== 200 || typeof body.token !== "string" || !body.token) {
    fail(`Login success path failed (status ${response.status})`);
  }
  console.log("[auth-verify] POST /api/auth/login success path ok");
}

async function verifyLoginFailure() {
  const { response, body } = await login(`${password}#bad`);
  if (response.status !== 401 || body.error !== "Invalid credentials") {
    fail(`Login failure path failed (status ${response.status})`);
  }
  console.log("[auth-verify] POST /api/auth/login failure path ok");
}

async function verifyInvalidPayload() {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username })
  });
  const body = await expectJson(response, "POST /api/auth/login invalid payload");
  if (response.status !== 400 || body.error !== "Invalid payload") {
    fail(`Login invalid payload path failed (status ${response.status})`);
  }
  console.log("[auth-verify] POST /api/auth/login payload validation path ok");
}

async function main() {
  await verifyHealth();
  await verifyLoginSuccess();
  await verifyLoginFailure();
  await verifyInvalidPayload();
  console.log("[auth-verify] all checks passed");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
