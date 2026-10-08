#!/usr/bin/env python3
"""Собирает messages/uz.json из частей (по одному JSON-файлу на раздел) и проверяет их по messages/en.json:
каждый ключ части есть в английском, плейсхолдеры {name} совпадают, лишних ключей нет.
Запуск: python3 scripts/build-uz.py <каталог с частями>"""
import json, re, sys, glob, os
src = sys.argv[1]
en = json.load(open('messages/en.json'))
ph = lambda s: sorted(re.findall(r'\{[^{}]+\}|<[a-zA-Z/][^>]*>', s)) if isinstance(s, str) else []
out, problems, count = {}, [], 0
def walk(e, u, path):
    global count
    for k, v in u.items():
        p = f"{path}.{k}" if path else k
        if k not in e:
            problems.append(f"лишний ключ {p}"); continue
        if isinstance(v, dict):
            if not isinstance(e[k], dict): problems.append(f"{p}: ожидалась строка"); continue
            walk(e[k], v, p)
        else:
            if isinstance(e[k], dict): problems.append(f"{p}: ожидался раздел"); continue
            count += 1
            if ph(e[k]) != ph(v): problems.append(f"{p}: плейсхолдеры {ph(e[k])} != {ph(v)}")
            if isinstance(v, str) and not v.strip(): problems.append(f"{p}: пусто")
for f in sorted(glob.glob(os.path.join(src, '*.json'))):
    part = json.load(open(f))
    for sec, val in part.items():
        if sec not in en: problems.append(f"нет раздела {sec}"); continue
        out.setdefault(sec, {})
        walk({sec: en[sec]}, {sec: val}, "")
        def merge(a, b):
            for k, v in b.items():
                if isinstance(v, dict): merge(a.setdefault(k, {}), v)
                else: a[k] = v
        merge(out[sec], val)
total = sum(1 for _ in re.finditer(r'"[^"]*":\s*"', json.dumps(en)))
if problems:
    print("\n".join(problems[:60])); print(f"ПРОБЛЕМ: {len(problems)}"); sys.exit(1)
json.dump(out, open('messages/uz.json', 'w'), ensure_ascii=False, indent=2)
open('messages/uz.json', 'a').write("\n")
print(f"uz.json: {count} ключей из ~{total} ({100*count//total}%)")
