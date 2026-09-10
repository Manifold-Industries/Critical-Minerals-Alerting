import type { NextConfig } from "next";

// The browser calls the API on this app's own origin, under /api, and the Next
// server forwards it. So the API needs no public URL, no CORS allowance, and no
// TLS of its own; nginx only has to proxy the one origin.
//
// Read by `next build`, which writes the rewrite into the build output: setting
// this on a running container does nothing. The default is the uvicorn that
// `next dev` runs beside; the Dockerfile points it at the compose service.
const API_BACKEND_URL = process.env.API_BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: `${API_BACKEND_URL}/:path*`,
    },
  ],
};

export default nextConfig;
