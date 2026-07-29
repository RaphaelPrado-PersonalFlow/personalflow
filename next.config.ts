import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite testar o servidor de desenvolvimento em celulares na mesma rede.
  allowedDevOrigins: [
    "172.20.10.2",
    "192.168.15.8",
    "192.168.15.15",
    "192.168.15.18",
    "192.168.100.97",
  ],
};

export default nextConfig;
