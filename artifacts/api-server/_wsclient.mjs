import WebSocket from "ws";
const ws = new WebSocket("ws://localhost:8080/api/realtime/stream");
ws.on("open", () => {
  ws.send(JSON.stringify({ prompt: "Lagos sunset groove", bpm: 102, key: "A minor", mode: "vocal" }));
});
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log(msg.type, msg.segment ?? "");
  if (msg.type === "stream-complete") ws.close();
});
ws.on("close", () => process.exit(0));
ws.on("error", (e) => { console.error("ERR", e.message); process.exit(1); });
