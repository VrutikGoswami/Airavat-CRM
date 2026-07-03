import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // The CRM runs in a self-contained demo mode by default (in-memory data).
  // No remote images are used; operational screens avoid scenic imagery.

  // Pin the tracing root to this project (an unrelated lockfile exists higher
  // up in the user's home directory, which would otherwise be inferred).
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
