"""One-time Google Chirp 3 HD dataset builder. Never included in browser code."""
import argparse, base64, hashlib, json, pathlib, re, sys, urllib.request, urllib.error
ROOT = pathlib.Path(__file__).resolve().parent
VOICE = 'en-US-Chirp3-HD-Aoede'
WORDS = 'zero one two three four five six seven eight nine ten'.split()
ROWS = [('cat','cats',3,10,1),('rooster','roosters',4,10,2),('donkey','donkeys',5,10,3),('pig','pigs',7,10,4),('horse','horses',9,11,5),('dog','dogs',2,11,6),('goat','goats',1,11,7),('bull','bulls',10,11,8)]
parser=argparse.ArgumentParser();parser.add_argument('--key-file');parser.add_argument('--confirmed-free-remaining',type=int,default=0);parser.add_argument('--generate',action='store_true');args=parser.parse_args()
folder=ROOT/'audio';folder.mkdir(exist_ok=True)
entries=[]
for animal,plural,original,page,item in ROWS:
 texts=[('question',f'How many {plural} do you see?')]+[(f'answer-{count}',f'I see {WORDS[count]} {animal if count==1 else plural}.') for count in range(1,11)]
 for role,text in texts:
  name=f'{animal}-{role}.mp3'
  entries.append(dict(id=f'v4-{animal}-{role}',role=role,text=text,file='audio/'+name,voice=VOICE,characters=len(text),requestHash=hashlib.sha256((VOICE+'|MP3|'+text).encode()).hexdigest()))
old={}
manifest=folder/'manifest.json'
if manifest.exists():old={e['file']:e for e in json.loads(manifest.read_text('utf-8')).get('entries',[])}
pending=[]
for e in entries:
 p=ROOT/e['file'];prior=old.get(e['file'],{})
 if p.exists() and prior.get('requestHash')==e['requestHash'] and prior.get('sha256')==hashlib.sha256(p.read_bytes()).hexdigest():e.update(status='ready',sha256=prior['sha256'])
 else:e['status']='pending';pending.append(e)
def save():manifest.write_text(json.dumps(dict(provider='Google Cloud Text-to-Speech',voice=VOICE,totalCharacters=sum(e['characters'] for e in entries),entries=entries),ensure_ascii=False,indent=2),'utf-8')
save();needed=sum(e['characters'] for e in pending);print(json.dumps(dict(files=len(entries),cached=len(entries)-len(pending),pendingCharacters=needed)))
if not args.generate:sys.exit(0)
if needed>min(args.confirmed_free_remaining,2500):sys.exit('STOP: confirmed free allowance is insufficient; no requests sent.')
if not pending:sys.exit(0)
raw=pathlib.Path(args.key_file).read_text('utf-8-sig');keys=re.findall(r'AIza[0-9A-Za-z_-]{35}',raw)
if len(keys)!=1:sys.exit('Expected exactly one Google key. No key values displayed.')
for e in pending:
 payload=json.dumps(dict(input={'text':e['text']},voice={'languageCode':'en-US','name':VOICE},audioConfig={'audioEncoding':'MP3'})).encode()
 request=urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize',data=payload,headers={'Content-Type':'application/json','X-Goog-Api-Key':keys[0]})
 try:
  with urllib.request.urlopen(request,timeout=60) as response:result=json.load(response)
 except urllib.error.HTTPError as ex:sys.exit(f'Google TTS HTTP {ex.code}; stopped without retry. Key and response withheld.')
 except Exception:sys.exit('Network failure; stopped without automatic retry. Check manifest before resuming.')
 data=base64.b64decode(result['audioContent']);(ROOT/e['file']).write_bytes(data);e.update(status='ready',sha256=hashlib.sha256(data).hexdigest());save();print('Saved '+e['file'])
