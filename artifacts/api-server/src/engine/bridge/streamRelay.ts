export async function relayStream(colabStream: any, ws: any) {
  const reader = colabStream.getReader();

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    ws.send(
      JSON.stringify({
        type: "audio-chunk",
        data: Buffer.from(value).toString("base64"),
      }),
    );
  }

  ws.send(
    JSON.stringify({
      type: "complete",
    }),
  );
}
