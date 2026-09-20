import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve('/home/ubuntu/redx-focus-game/assets/audio/redx-loop.wav');
const rate = 44100;
const duration = 16;
const data = Buffer.alloc(rate * duration * 2);
const notes = [110, 146.83, 174.61, 220, 261.63, 293.66, 349.23, 440];
for (let i = 0; i < rate * duration; i++) {
  const t = i / rate;
  const beat = Math.floor(t * 2.4);
  const bass = Math.sin(2 * Math.PI * notes[beat % 4] * 0.5 * t) * 0.22;
  const pulse = Math.sin(2 * Math.PI * 2.4 * t) > 0.55 ? 0.12 : 0;
  const lead = Math.sin(2 * Math.PI * notes[(beat * 3) % notes.length] * t) * 0.08;
  const kick = Math.exp(-((t * 2.4 % 1) * 16)) * 0.35;
  const fade = Math.min(1, t * 8) * Math.min(1, (duration - t) * 8);
  const sample = Math.max(-1, Math.min(1, (bass + pulse + lead + kick) * fade));
  data.writeInt16LE(sample * 32767, i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, data]));
