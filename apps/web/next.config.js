const { IMAGE_MAX_BYTES } = require("./src/lib/upload-limits.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  /**
   * A cover or a profile photo leaves the browser inside a server action, and
   * the default cap is 1 MB, far below what the pickers accept. Anything over it
   * is answered with a raw platform 413 before any handler runs, which reaches
   * the writer as "Body exceeded 1 MB limit" instead of a sentence about the
   * image. The envelope a multipart action adds is small, so the file limit plus
   * a little is enough, and it stays under the host's request cap.
   */
  experimental: {
    agentUpgrade: "security",
    serverActions: {
      bodySizeLimit: `${IMAGE_MAX_BYTES + 256 * 1024}`,
    },
  },
};

module.exports = nextConfig;
