#!/bin/bash
# Rebuilds standalone/ORVIBO Smart Home Simulator.html (single file, runs from disk without a server).
# Needs Node.js: npm install --no-save esbuild
set -e
cd "$(dirname "$0")/.."
P="$(pwd)"
npx esbuild js/site.js --bundle --format=iife --minify --outfile=/tmp/orvibo-bundle.js \
  --alias:three="$P/vendor/three.module.js" --alias:three-mesh-bvh="$P/vendor/three-mesh-bvh.module.js" \
  --alias:three-gpu-pathtracer="$P/vendor/three-gpu-pathtracer.module.js" \
  --alias:three/addons="$P/vendor/addons" --alias:three/examples/jsm="$P/vendor/addons"
python3 - <<'PY'
import base64, re
html=open('index.html').read()
css=open('css/style.css').read()+'\n'+open('css/site.css').read()
js=open('/tmp/orvibo-bundle.js').read().replace('</script','<\\/script')
fav='data:image/png;base64,'+base64.b64encode(open('favicon.png','rb').read()).decode()
html=re.sub(r'<script type="importmap">.*?</script>\n','',html,flags=re.S)
html=html.replace('<link rel="icon" href="favicon.png">\n','').replace('<link rel="stylesheet" href="css/site.css">\n','')
assert '<link rel="stylesheet" href="css/style.css">' in html
html=html.replace('<link rel="stylesheet" href="css/style.css">','<link rel="icon" href="'+fav+'">\n<style>\n'+css+'\n</style>')
tag='<script type="module" src="js/site.js"></script>'
assert tag in html
html=html.replace(tag,'<script>\n'+js+'\n</script>')
open('standalone/ORVIBO Smart Home Simulator.html','w').write(html)
print('standalone built:',len(html),'bytes')
PY
