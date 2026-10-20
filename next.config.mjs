/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js / @react-three/fiber ship ESM that Next must transpile for the
  // GhostInTheCodebase WebGL layer.
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  // Keep the live target API (the thing TestSprite pokes) out of the static
  // optimization so it always runs on the Node runtime with the in-memory store.
  experimental: {
    // matcha: keep server routes dynamic by default
  },
};

export default nextConfig;
