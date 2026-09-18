// Tiny front door for the static site.
// Sends every alias host (www., the workers.dev address) to the canonical domain
// with a 301, then lets Workers static assets serve everything else.
const CANONICAL_HOST = 'ronipradhan.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== CANONICAL_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
