import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('/home/ubuntu/redx-focus-game/assets/audio');
fs.mkdirSync(out, { recursive: true });
const rate = 44100;

function wav(name, notes, duration = 0.12, volume = 0.22) {
  const count = Math.floor(rate * duration);
  const data = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const progress = i / count;
    const envelope = Math.min(1, progress * 24) * Math.min(1, (1 - progress) * 18);
    const sample = notes.reduce((sum, note) => sum + Math.sin(2 * Math.PI * note.frequency * t) * note.gain, 0) * volume * envelope;
    data.writeInt16LE(Math.max(-1, Math.min(1, sample)) * 32767, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(out, name), Buffer.concat([header, data]));
}

wav('tap.wav', [{ frequency: 660, gain: 1 }], 0.07, 0.18);
wav('countdown.wav', [{ frequency: 430, gain: 0.8 }, { frequency: 860, gain: 0.18 }], 0.11, 0.2);
wav('go.wav', [{ frequency: 520, gain: 0.7 }, { frequency: 780, gain: 0.8 }, { frequency: 1040, gain: 0.8 }], 0.22, 0.2);
wav('correct.wav', [{ frequency: 660, gain: 0.65 }, { frequency: 880, gain: 0.8 }, { frequency: 1100, gain: 0.7 }], 0.28, 0.2);
wav('wrong.wav', [{ frequency: 360, gain: 0.8 }, { frequency: 220, gain: 0.7 }], 0.22, 0.2);
