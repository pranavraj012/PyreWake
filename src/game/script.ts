// How a scene speaks: a line shown at its time and cleared at `until`. Each fight's words live in its own script file (riverScript.ts, hoursScript.ts).
export interface Line { at: number; text: string; until?: number; voice?: string }

/** Shows each line at its time and clears it at `until`; pass the scene's clock every frame. */
export function speak(lines: Line[], t: number, at: (t: number, id: string, f: () => void) => void, verse: (s: string) => void) {
  lines.forEach((l, i) => { at(l.at, 'say' + i, () => verse(l.text)); if (l.until) at(l.until, 'unsay' + i, () => verse('')); });
  void t;
}
