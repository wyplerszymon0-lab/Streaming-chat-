const https = require("https");

function createSSEResponse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  return {
    send(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      res.end();
    },
  };
}

function streamOpenAI(apiKey, model, messages, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: options.maxTokens ?? 1000,
      temperature: options.temperature ?? 0.7,
    });

    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      res => {
        if (res.statusCode !== 200) {
          reject(new Error(`OpenAI API error: ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString();
          resolve(raw);
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function parseSSEChunks(raw) {
  const tokens = [];
  const lines = raw.split("\n");

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") break;

    try {
      const parsed = JSON.parse(data);
      const token = parsed.choices?.[0]?.delta?.content;
      if (token) tokens.push(token);
    } catch {
      continue;
    }
  }

  return tokens;
}

async function streamToSSE(apiKey, model, messages, sse, options = {}) {
  const raw = await streamOpenAI(apiKey, model, messages, options);
  const tokens = parseSSEChunks(raw);

  let fullText = "";
  for (const token of tokens) {
    fullText += token;
    sse.send("token", { token });
  }

  sse.send("done", { fullText });
  return fullText;
}

module.exports = { createSSEResponse, parseSSEChunks, streamToSSE, streamOpenAI };
