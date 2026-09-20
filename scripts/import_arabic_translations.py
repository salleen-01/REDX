from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'app' / '(tabs)' / 'index.tsx'
WORKSHEET = Path('/home/ubuntu/upload/REDX_TRANSLATION_WORKSHEET_ARABIC_PRO.txt')

text = SOURCE.read_text()
worksheet = WORKSHEET.read_text()

pairs = {}
current_key = None
current_english = None
for line in worksheet.splitlines():
    m = re.match(r'^([A-Za-z0-9_.]+)$', line.strip())
    if m:
        current_key = m.group(1)
        current_english = None
        continue
    m = re.match(r'^English:\s*(.*)$', line)
    if m and current_key:
        current_english = m.group(1)
        continue
    m = re.match(r'^Arabic:\s*(.*)$', line)
    if m and current_key and current_english is not None:
        pairs[current_key] = (current_english, m.group(1).strip())

# Parse the compact translation object lines. The English and Arabic entries
# share the same keys, so exact English text gives us a safe import anchor.
def parse_object(line: str):
    result = {}
    for m in re.finditer(r'([A-Za-z][A-Za-z0-9]*)\s*:\s*"((?:\\.|[^"\\])*)"', line):
        result[m.group(1)] = m.group(2)
    return result

def js_escape(value: str) -> str:
    return value.replace('\\', '\\\\').replace('"', '\\"')

english_line = re.search(r'^\s*en:\s*\{(.*?)^\s*\},\s*$', text, re.M | re.S).group(1)
arabic_line = re.search(r'^\s*ar:\s*\{(.*?)^\s*\},\s*$', text, re.M | re.S).group(1)
en = parse_object(english_line)
ar = parse_object(arabic_line)
by_english = {english: arabic for english, arabic in pairs.values() if arabic}

# Keep all existing keys but replace Arabic values from the user's worksheet.
for key, english in en.items():
    if english in by_english:
        ar[key] = by_english[english]

# Daily Challenge was explicitly removed from the product. Delete its keys from
# both language dictionaries and remove the old settings JSX block below.
for key in ('dailyChallenge', 'seededDaily', 'dailyCopy'):
    en.pop(key, None)
    ar.pop(key, None)

def render_object(values):
    return ', '.join(f'{key}: "{js_escape(value)}"' for key, value in values.items())

text = re.sub(r'(^\s*en:\s*)\{.*?^\s*\},', lambda m: m.group(1) + '{' + render_object(en) + '},', text, count=1, flags=re.M | re.S)
text = re.sub(r'(^\s*ar:\s*)\{.*?^\s*\},', lambda m: m.group(1) + '{' + render_object(ar) + '},', text, count=1, flags=re.M | re.S)

# Replace hardcoded Arabic branches in instruction and guide content with the
# exact user-provided worksheet translations. English branches stay untouched.
replacements = {
    'اعثر على الكرة الحمراء الأصلية قبل بداية العاصفة. أبقِ عينيك عليها أثناء تحرك الكرات ثم اضغط على موضعها الأخير.': 'حدّد الكرة الحمراء الأصلية قبل بدء العاصفة. حافظ على تركيزك عليها أثناء تحرك جميع الكرات، ثم اضغط على موقعها النهائي.',
    'نهاية اللعبة تحدٍ للتركيز. راقب الأهداف الحمراء وانتظر توقف الساحة ثم اضغط على كل كرة حمراء قبل انتهاء الجولة.': 'وضع نهاية اللعبة تحدٍّ يتطلب تركيزًا عاليًا. راقب الأهداف الحمراء، وانتظر توقف الساحة، ثم اضغط على كل كرة حمراء قبل انتهاء الجولة.',
    'يستمر الوضع اللانهائي ما دام تركيزك ثابتًا. راقب الكرة الحمراء خلال كل حركة ثم اضغط عليها عند توقف الحركة.': 'يستمر الوضع اللانهائي ما دام تركيزك حاضرًا. راقب الكرة الحمراء خلال كل تبديل، ثم اضغط عليها عند توقف الحركة.',
    'مسار التركيز بسيط: راقب الكرة الحمراء واتبع كل حركة وثق بعينيك عند توقف الساحة.': 'مسار التركيز بسيط: راقب الكرة الحمراء، واتبع كل تبديل، وثق بقدرتك على التركيز عندما تتوقف الساحة.',
    'احفظ مكان الكرة الحمراء.': 'راقب الكرة الحمراء.',
    'اصمد أمام العاصفة المتحركة.': 'تابع كل تبديل.',
    'اضغط على الكرة الحمراء في النهاية.': 'اضغط على الموقع الذي تتذكره.',
    'احفظ مكان الكرة الأصلية.': 'احفظ موقع الكرة الحمراء الأصلية.',
    'اصمد أمام فوضى العاصفة.': 'اصمد أمام العاصفة المتحركة.',
    'اضغط على موضعها الأخير.': 'اضغط على الكرة الحمراء في النهاية.',
}
for old, new in replacements.items():
    text = text.replace(old, new)

# Remove the entire Daily Challenge row and explanatory paragraph from Settings.
text = re.sub(r'\n\s*<View style=\{\[styles\.settingsRow, rtl && styles\.rtlRow\]\}><Text style=\{\[styles\.ruleText, rtl && styles\.rtlText\]\}>\{t\.dailyChallenge\}</Text><Text style=\{\[styles\.settingsValue, rtl && styles\.rtlText\]\}>\{t\.seededDaily\}</Text></View>\n\s*<Text style=\{\[styles\.modalCopy, rtl && styles\.rtlText\]\}>\{t\.dailyCopy\}</Text>', '', text)

SOURCE.write_text(text)
print(f'Imported {len(by_english)} worksheet translations; removed Daily Challenge settings UI.')
