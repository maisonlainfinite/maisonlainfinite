#!/usr/bin/env python3
"""Check every generated route, link, asset, and structured-data block."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json, sys
ROOT=Path(__file__).resolve().parents[1]
site=json.loads((ROOT/'data/site.json').read_text())
base=site.get('basePath','')
errors=[]; pages=0; titles=set()
class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.refs=[];self.ids=[];self.json=[];self.active=False;self.data='';self.h1=0;self.title=False;self.titletext='';self.description=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='h1':self.h1+=1
        if tag=='title':self.title=True
        if tag=='meta' and a.get('name')=='description':self.description=a.get('content')
        for key in ['href','src','action']:
            if a.get(key):self.refs.append(a[key])
        if tag=='img' and 'alt' not in a: errors.append('Image without alt text')
        if tag=='script' and a.get('type') in ['application/ld+json','application/json']: self.active=True;self.data=''
    def handle_data(self,data):
        if self.active:self.data+=data
        if self.title:self.titletext+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.active:
            self.json.append(json.loads(self.data));self.active=False
        if tag=='title':self.title=False
for f in (ROOT/'dist').rglob('*.html'):
    if f.relative_to(ROOT/'dist').as_posix()=='assets/index.html':continue
    pages+=1;p=Page();p.feed(f.read_text())
    if p.h1!=1: errors.append(f'{f}: expected one h1, got {p.h1}')
    if not p.description:errors.append(f'{f}: missing description')
    if len(p.ids)!=len(set(p.ids)):errors.append(f'{f}: duplicate IDs')
    if len(p.json)!=2:errors.append(f'{f}: missing structured data or configuration')
    for ref in p.refs:
        u=urlsplit(ref)
        if u.scheme or u.netloc:continue
        if not u.path:
            if u.fragment and u.fragment not in p.ids:errors.append(f'{f}: missing fragment {ref}')
            continue
        path=unquote(u.path)
        if base and path.startswith(base):path=path[len(base):]
        candidate=(ROOT/'dist'/path.lstrip('/')) if path.startswith('/') else f.parent/path
        if candidate.is_dir():candidate=candidate/'index.html'
        if not candidate.exists():errors.append(f'{f.relative_to(ROOT)}: missing link {ref}')
    for block in p.json:
        if '@graph' in block:
            for x in block['@graph']:
                if x.get('@type')=='Product':
                    if not x.get('image') or float(x['offers']['price'])<=0:errors.append(f'{f}: invalid product offer')
                    if any(k in x for k in ['aggregateRating','review']):errors.append('Unverified reviews in metadata')
if errors:
    print('\n'.join(errors));sys.exit(1)
print(json.dumps({'html_pages_checked':pages,'broken_local_links':0,'invalid_json_blocks':0,'duplicate_ids':0,'result':'passed'}))
