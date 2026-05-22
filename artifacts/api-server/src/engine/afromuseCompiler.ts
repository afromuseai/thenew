export function compileAfroMuse(input: any) {
  const lines: string[] = [];

  // Identity
  lines.push(`Genre: ${input.genre}`);
  lines.push(`Mood: ${input.mood}`);
  lines.push(`Energy: ${input.energy}`);

  if (input.bpm) lines.push(`Tempo: ${input.bpm} BPM`);
  if (input.key) lines.push(`Key: ${input.key}`);

  // Beat DNA
  if (input.beatDNA) {
    lines.push(`Bounce: ${input.beatDNA.bounceStyle}`);
    lines.push(`Melody: ${input.beatDNA.melodyDensity}`);
    lines.push(`Drums: ${input.beatDNA.drumCharacter}`);
  }

  // Artist DNA
  if (input.artistDNA) {
    lines.push(`Artist Style: ${input.artistDNA.referenceArtist}`);
    lines.push(`Voice: ${input.artistDNA.vocalTexture}`);
  }

  // Lyrics (keep order!)
  if (input.lyrics) {
    lines.push(`\nFollow structure EXACTLY:\n`);

    Object.entries(input.lyrics).forEach(([section, value]) => {
      lines.push(`${section.toUpperCase()}:`);
      lines.push(Array.isArray(value) ? value.join("\n") : value);
      lines.push("");
    });
  }

  return lines.join("\n");
}