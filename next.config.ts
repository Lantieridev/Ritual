import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Spotify artist images
      { protocol: 'https', hostname: 'i.scdn.co' },
      // Last.fm artist images
      { protocol: 'https', hostname: 'lastfm.freetls.fastly.net' },
    ],
  },
};

export default nextConfig;

