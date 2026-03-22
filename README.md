# streaming-chat

Real-time streaming chat built with Node.js and Server-Sent Events. Tokens appear word-by-word as OpenAI generates them — no waiting for the full response.

## How It Works
```
Browser → POST /chat
              ↓
         OpenAI stream=true
              ↓
         SSE token events
              ↓
         Browser renders token-by-token
```

## Features

- Token-by-token streaming via Server-Sent Events
- Conversation history per session
- Blinking cursor while AI is typing
- Zero dependencies — pure Node.js
- Simple dark UI included

## Run
```bash
export OPENAI_API_KEY=your_key
npm start
# open http://localhost:3000
```

## API

| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Send message, receive SSE stream |
| GET | `/history/:sessionId` | Get session history |
| DELETE | `/history/:sessionId` | Clear session history |

## SSE Events

| Event | Payload | Description |
|---|---|---|
| `token` | `{ token: string }` | Single streamed token |
| `done` | `{ fullText: string }` | Stream complete |
| `error` | `{ message: string }` | Stream error |

## Test
```bash
npm install
npm test
```

## Project Structure
```
streaming-chat/
├── src/
│   ├── server.js         # HTTP server and routes
│   └── stream.js         # SSE helpers and OpenAI streaming
├── public/
│   └── index.html        # Chat UI
├── tests/
│   └── stream.test.js
├── package.json
└── README.md
```

## Author

**Szymon Wypler**
