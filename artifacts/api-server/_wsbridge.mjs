import WebSocket from "ws";
const ws = new WebSocket("ws://localhost:8080/api/stream-ai");
const t = setTimeout(() => { console.log("timeout"); ws.close(); }, 20000);
ws.on("open", () => ws.send(JSON.stringify({ prompt: "afrobeats groove", bpm: 102, key: "A minor" })));
ws.on("message", (d) => {
  const m = JSON.parse(d.toString());
  console.log(m.type, m.data ? `(${m.data.length}b base64)` : (m.error ?? ""));
  if (m.type === "complete" || m.type === "stream-error") { clearTimeout(t); ws.close(); }
});
ws.on("close", () => process.exit(0));
