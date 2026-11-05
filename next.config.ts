import type { NextConfig } from "next";

// GitHub Codespaces forwards ports through <codespace>-<port>.app.github.dev while the
// app sees Host: localhost, so Server Actions must allow that forwarded origin.
const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN, PORT } = process.env;
const codespaceOrigin =
  CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${CODESPACE_NAME}-${PORT ?? 3000}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null;

const nextConfig: NextConfig = {
  transpilePackages: ["@fluentui/react-components"],
  ...(codespaceOrigin && { experimental: { serverActions: { allowedOrigins: [codespaceOrigin] } } }),
};

export default nextConfig;
