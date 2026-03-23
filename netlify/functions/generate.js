// Thin validation layer — checks passphrase, then invokes the background function
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { prompt, passphrase } = body;

  if (!passphrase || passphrase !== process.env.PASSPHRASE) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Invalid passphrase" }) };
  }

  if (!prompt || prompt.trim().length < 3) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Please provide a persona description" }) };
  }

  // Fire the background function (it will run for up to 15 min)
  const bgUrl = `${event.rawUrl.replace('/generate', '/generate-background')}`;
  fetch(bgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.trim(), passphrase }),
  }).catch(() => {}); // fire-and-forget

  return {
    statusCode: 202,
    headers,
    body: JSON.stringify({ status: "generating", prompt: prompt.trim() }),
  };
};
