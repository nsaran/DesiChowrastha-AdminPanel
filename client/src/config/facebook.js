/**
 * Facebook display configuration (client-side, non-sensitive).
 *
 * The Facebook access token and page ID now live on the SERVER (server/.env)
 * and are used by the /api/facebook-posts proxy endpoint. The client no longer
 * holds the token — it just calls the proxy. This value only controls how many
 * posts to request by default.
 */
const FB_POSTS_LIMIT = 10;

export { FB_POSTS_LIMIT };
