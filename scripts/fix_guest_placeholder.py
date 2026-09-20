from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'app' / '(tabs)' / 'index.tsx'
s = p.read_text()
old = 'value={username} onChangeText={setUsername} placeholder={t.yourName}'
new = 'value={rtl && username === "Guest" ? "" : username} onChangeText={setUsername} placeholder={t.yourName}'
if s.count(old) != 2:
    raise SystemExit(f'expected 2 remaining profile placeholders, found {s.count(old)}')
p.write_text(s.replace(old, new))
print('Fixed remaining Arabic Guest input fallbacks.')
