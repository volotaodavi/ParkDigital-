import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Este frontend vive dentro do monorepo do backend (../), que também tem
  // um package-lock.json; sem isso o Next.js infere a raiz errada ao
  // rastrear arquivos para o build.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
