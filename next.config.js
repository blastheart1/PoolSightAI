/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from bundling native/binary modules — let Node require them at runtime
  serverExternalPackages: ["fluent-ffmpeg", "@ffmpeg-installer/ffmpeg"],

  experimental: {
    // Increase body size limit for the cut-video route (videos up to 25 MB)
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
};

module.exports = nextConfig;
