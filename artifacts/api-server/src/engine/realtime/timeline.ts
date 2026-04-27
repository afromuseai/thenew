export function buildTimeline(input: any) {
  const isVocal = input.mode === "vocal";

  return [
    { name: "intro", duration: 4 },
    { name: "groove", duration: 8 },
    { name: "build", duration: 8 },
    { name: "drop", duration: 8 },
    ...(isVocal ? [{ name: "hook", duration: 8 }] : []),
    { name: "variation", duration: 8 },
    { name: "outro", duration: 4 },
  ];
}
