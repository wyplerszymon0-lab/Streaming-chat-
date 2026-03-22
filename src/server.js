const http = require("http");
const fs = require("fs");
const path = require("path");
const { createSSEResponse, streamToSSE } = require("./stream");

const API_KEY = process.env.OPENAI_API_KEY ?? "";
const PORT = process.env.PORT ?? 3000;

const sessions = new Map();

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, []);
  }
  return sessions.get(id);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf-8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    const { message, sessionId = "default" } = await collectBody(req);

    if (!message) {
      send(res, 400, { error: "message is required" });
      return;
    }

    const history = getSession(sessionId);
    history.push({ role: "user", content: message });

    const sse = createSSEResponse(res);

    try {
      const fullText = await streamToSSE(
        API_KEY,
        "gpt-4o-mini",
        [
          { role: "system", content: "You are a helpful, concise assistant." },
          ...history,
        ],
        sse,
      );

      history.push({ role: "assistant", content: fullText });
    } catch (err) {
      sse.send("error", { message: err.message });
    } finally {
      sse.close();
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/history/")) {
    const sessionId = req.url.split("/history/")[1];
    send(res, 200, { history: getSession(sessionId) });
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/history/")) {
    const sessionId = req.url.split("/history/")[1];
    sessions.delete(sessionId);
    send(res, 200, { cleared: true });
    return;
  }

  send(res, 404, { error: "Not found" });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Streaming chat running on http://localhost:${PORT}`));
}

module.exports = { server };
