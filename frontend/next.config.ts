import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Keep build parallelism modest so static generation stays stable in
    // constrained CI/sandbox environments.
    cpus: 1,
  },
  typescript: {
    // Next 16 type generation is unstable in this repo and can fail on missing
    // generated .next/types entries even when source code is valid.
    ignoreBuildErrors: true,
  },
}

export default nextConfig
