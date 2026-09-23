// Vercel Serverless Function (plain Node.js runtime, zero new dependencies
// — no @vercel/node types package needed since this stays untyped JS,
// intentionally outside the project's own tsconfig).
//
// WHY THIS EXISTS: this is a static Vite SPA (see vercel.json — a plain
// catch-all rewrite to index.html, no SSR/Next.js). A social crawler
// (Facebook, WhatsApp, X, Slack, ...) fetches a URL and reads whatever
// HTML comes back WITHOUT executing any JavaScript — so React Router,
// react-helmet, or any client-side <head> mutation is invisible to it.
// There is no way to give a crawler a *per-post* og:image/description
// without something server-side generating different HTML per postId.
//
// WHAT IT DOES: vercel.json rewrites `/post/:postId` to this function for
// EVERY request (both real visitors and crawlers), and this function
// decides what to send back:
//   - A recognized bot user-agent -> fetch the post's public fields
//     (same anon key already shipped in the client bundle, same RLS as
//     any other client read) and return a small HTML document with real
//     og:/twitter: tags for that specific post.
//   - Anything else (a real browser) -> proxy through to the actual built
//     index.html so the SPA boots and React Router takes over exactly as
//     it would for any other route. This function must never be a real
//     visitor's dead end.
//
// STATUS: this follows Vercel's standard, framework-agnostic pattern for
// exactly this problem (any file under /api becomes an HTTP endpoint,
// regardless of the "vite" framework preset) and is believed correct, but
// it has NOT been deployed or verified against real Vercel infrastructure
// or real crawlers in this session — there was no deployment access to do
// so. After deploying, verify with:
//   https://developers.facebook.com/tools/debug/?q=https://YOUR_DOMAIN/post/POST_ID
//   https://cards-dev.twitter.com/validator (X card validator)
// If this function doesn't work for any reason, the static fallback tags
// in index.html still apply (a generic, non-per-post preview) since the
// crawler branch below fails closed into that same file on any error.

const BOT_USER_AGENT_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|LinkedInBot|Discordbot|TelegramBot|Googlebot|bingbot|Pinterest|redditbot|SkypeUriPreview/i;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export default async function handler(req, res) {
  const postId = req.query?.postId;
  const userAgent = req.headers['user-agent'] || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `https://${host}`;
  const postUrl = `${origin}/post/${postId}`;

  if (!BOT_USER_AGENT_PATTERN.test(userAgent)) {
    // Real visitor — serve the actual SPA shell so React Router boots
    // normally. Asset paths in the built index.html are root-absolute
    // (Vite's default), so serving it at this URL doesn't break anything.
    try {
      const indexResponse = await fetch(`${origin}/index.html`);
      const html = await indexResponse.text();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(html);
    } catch (error) {
      // If even that fails, at least land the visitor somewhere real
      // rather than showing this function's own error page.
      res.writeHead(307, { Location: postUrl });
      res.end();
    }
    return;
  }

  // A crawler. Requires the same VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
  // that must already be set as Vercel Environment Variables for the
  // client build to work at all — same anon key, same RLS, nothing
  // service-role, nothing not already public.
  let title = 'CreativeHUB';
  let description = 'Discover and book creative freelancers on CreativeHUB.';
  let image = `${origin}/creativehub-social-preview.png`;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && postId) {
    try {
      const query =
        `${supabaseUrl}/rest/v1/client_posts` +
        `?id=eq.${encodeURIComponent(postId)}&is_published=eq.true` +
        `&select=caption,image_url,client:client_id(full_name,email)`;
      const response = await fetch(query, {
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      });
      const rows = await response.json();
      const post = Array.isArray(rows) ? rows[0] : null;
      if (post) {
        const username = String(post.client?.email || 'creativehub').split('@')[0];
        title = `CreativeHUB post by @${username}`;
        description = String(post.caption || '').slice(0, 200);
        // A blob: URL (see PublicPostPage.tsx's isUsableImageUrl comment)
        // only resolves in the browser tab that created it — never usable
        // as a crawler-facing og:image, so it falls back to the generic
        // branded image above instead of a broken link.
        if (post.image_url && !String(post.image_url).startsWith('blob:')) {
          image = post.image_url;
        }
      }
      // No matching row (not found / unpublished / deleted): keep the
      // generic fallback values above rather than exposing which case it was.
    } catch (error) {
      // Network/parse failure — same generic fallback, never a 500 to a crawler.
    }
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta property="og:site_name" content="CreativeHUB" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(postUrl)}" />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body></body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
