export function sendChunk(ws: any, payload: any) {
  if (!ws) return;

  ws.send(JSON.stringify(payload));
}
