#!/usr/bin/env python3
"""Validate public static files and links from the repository root."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json, sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]
class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs=[]; self.ids=[]; self.json=[]; self.base='./'
        self.in_json=False; self.buffer=''; self.h1=0; self.description=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'): self.ids.append(a['id'])
        if tag=='h1': self.h1+=1
        if tag=='base': self.base=a.get('href','./')
        if tag=='meta' and a.get('name')=='description': self.description=bool(a.get('content'))
        for key in ('href','src','action'):
            if a.get(key): self.refs.append(a[key])
        if tag=='img' and 'alt' not in a: errors.append('Image without alt text')
        if tag=='script' and a.get('type') in ('application/json','application/ld+json'):
            self.in_json=True; self.buffer=''
    def handle_data(self,data):
        if self.in_json: self.buffer+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.in_json:
            try: self.json.append(json.loads(self.buffer))
            except Exception as exc: errors.append('Invalid JSON: '+str(exc))
            self.in_json=False

checked=0
for f in ROOT.rglob('*.html'):
    if 'dist' in f.parts or f.as_posix().endswith('assets/index.html'): continue
    checked+=1
    p=Page(); p.feed(f.read_text(encoding='utf-8'))
    if p.h1!=1: errors.append(f'{f}: expected one h1, got {p.h1}')
    specialist = f.relative_to(ROOT).as_posix() in ('admin/index.html', 'circle/accept/index.html')
    if not specialist and not p.description: errors.append(f'{f}: missing description')
    if len(p.ids)!=len(set(p.ids)): errors.append(f'{f}: duplicate IDs')
    if not specialist and len(p.json)!=2: errors.append(f'{f}: expected two JSON blocks')
    base=(f.parent/p.base).resolve()
    for link in p.refs:
        u=urlsplit(link)
        if u.scheme or u.netloc or not u.path: continue
        target=(base/unquote(u.path)).resolve()
        if target.is_dir(): target=target/'index.html'
        if not target.is_file(): errors.append(f'{f.relative_to(ROOT)}: broken {link}')
if errors:
    print('\n'.join(errors));sys.exit(1)
print(json.dumps({'html_pages_checked':checked,'broken_links':0,'result':'passed'}))
