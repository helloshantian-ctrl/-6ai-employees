#!/bin/bash
set -e
rm -rf .vercel/output
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/_middleware.func

# Copy static
cp -r public/* .vercel/output/static/

# Copy API functions
for f in api/*.js; do
  fname=$(basename "$f" .js)
  mkdir -p ".vercel/output/functions/api/${fname}.func"
  cp "$f" ".vercel/output/functions/api/${fname}.func/index.js"
  echo '{"runtime":"nodejs20.x","handler":"index.js","launcherType":"Nodejs"}' > ".vercel/output/functions/api/${fname}.func/.vc-config.json"
done

# Auth middleware
cat > .vercel/output/functions/_middleware.func/index.js << 'ENDMW'
const USERNAME = process.env.AUTH_USERNAME || 'huawei'
const PASSWORD = process.env.AUTH_PASSWORD || 'aigcs@2026'
export default async function middleware(request) {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) return undefined
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ')
    if (scheme === 'Basic') {
      const decoded = atob(encoded)
      const [user, pass] = decoded.split(':')
      if (user === USERNAME && pass === PASSWORD) return undefined
    }
  }
  return new Response('Authentication Required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Restricted Area"' },
  })
}
ENDMW

cat > .vercel/output/functions/_middleware.func/.vc-config.json << 'ENDVC'
{"runtime":"edge","entrypoint":"index.js"}
ENDVC

cat > .vercel/output/config.json << 'ENDCFG'
{"version":3,"routes":[{"src":"/(.*)", "headers":{"X-Frame-Options":"DENY","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()"}, "continue":true}]}
ENDCFG
echo "Done"
