// Edge middleware: HTTP Basic auth for the dashboard, free pass for /api/*.
// API endpoints handle their own auth (CRON_SECRET / ADMIN_TOKEN / ACCESS_PASSWORD).

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt).*)"],
};

export default function middleware(req) {
  const user = process.env.AUTH_USERNAME;
  const pass = process.env.AUTH_PASSWORD;
  if (!user || !pass) return; // no basic-auth configured → allow

  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, p] = atob(header.slice(6)).split(":");
      if (u === user && p === pass) return;
    } catch {}
  }
  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="AI Briefing"' },
  });
}
