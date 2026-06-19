import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure @huggingface/transformers and onnxruntime-node are never bundled
  // into the client or server bundle — they use native Node.js features.
  // @huggingface/transformers is already on Next.js's automatic opt-out list,
  // but we list it explicitly for clarity and to future-proof the config.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};

export default nextConfig;
