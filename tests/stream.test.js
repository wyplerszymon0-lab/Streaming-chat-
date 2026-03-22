const { parseSSEChunks, createSSEResponse } = require("../src/stream");

function makeMockRes() {
  const written = [];
  return {
    written,
    headers: {},
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    write(chunk) { written.push(chunk); },
    end() { this.ended = true; },
  };
}

function makeSSELine(data) {
  return `data: ${JSON.stringify(data)}\n`;
}

test("parseSSEChunks extracts tokens from stream", () => {
  const raw = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: " world" } }] })}`,
    "data: [DONE]",
  ].join("\n");

  const tokens = parseSSEChunks(raw);
  expect(tokens).toEqual(["Hello", " world"]);
});

test("parseSSEChunks stops at [DONE]", () => {
  const raw = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: "first" } }] })}`,
    "data: [DONE]",
    `data: ${JSON.stringify({ choices: [{ delta: { content: "second" } }] })}`,
  ].join("\n");

  const tokens = parseSSEChunks(raw);
  expect(tokens).toHaveLength(1);
  expect(tokens[0]).toBe("first");
});

test("parseSSEChunks skips lines without data prefix", () => {
  const raw = [
    "event: token",
    `data: ${JSON.stringify({ choices: [{ delta: { content: "hi" } }] })}`,
    "",
  ].join("\n");

  const tokens = parseSSEChunks(raw);
  expect(tokens).toEqual(["hi"]);
});

test("parseSSEChunks handles empty delta content", () => {
  const raw = [
    `data: ${JSON.stringify({ choices: [{ delta: {} }] })}`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: "word" } }] })}`,
    "data: [DONE]",
  ].join("\n");

  const tokens = parseSSEChunks(raw);
  expect(tokens).toEqual(["word"]);
});

test("parseSSEChunks handles malformed JSON gracefully", () => {
  const raw = [
    "data: not-valid-json",
    `data: ${JSON.stringify({ choices: [{ delta: { content: "valid" } }] })}`,
    "data: [DONE]",
  ].join("\n");

  expect(() => parseSSEChunks(raw)).not.toThrow();
  const tokens = parseSSEChunks(raw);
  expect(tokens).toContain("valid");
});

test("createSSEResponse sets correct headers", () => {
  const res = makeMockRes();
  createSSEResponse(res);
  expect(res.headers["Content-Type"]).toBe("text/event-stream");
  expect(res.headers["Cache-Control"]).toBe("no-cache");
  expect(res.headers["Connection"]).toBe("keep-alive");
});

test("createSSEResponse send writes correct SSE format", () => {
  const res = makeMockRes();
  const sse = createSSEResponse(res);
  sse.send("token", { token: "hello" });
  expect(res.written[0]).toContain("event: token");
  expect(res.written[0]).toContain(`"token":"hello"`);
  expect(res.written[0]).endsWith("\n\n");
});

test("createSSEResponse close ends the response", () => {
  const res = makeMockRes();
  const sse = createSSEResponse(res);
  sse.close();
  expect(res.ended).toBe(true);
});

test("parseSSEChunks returns empty array for empty input", () => {
  expect(parseSSEChunks("")).toEqual([]);
});

test("parseSSEChunks handles multiple tokens correctly", () => {
  const tokens = ["The ", "quick ", "brown ", "fox"];
  const raw = tokens
    .map(t => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}`)
    .join("\n") + "\ndata: [DONE]";

  const result = parseSSEChunks(raw);
  expect(result).toEqual(tokens);
  expect(result.join("")).toBe("The quick brown fox");
});
