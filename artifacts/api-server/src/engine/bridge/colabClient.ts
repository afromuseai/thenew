export async function callColabWorker(input: any) {
  const response = await fetch(process.env.COLAB_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.body) throw new Error("No stream from Colab");

  return response.body;
}
