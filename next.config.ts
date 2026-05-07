import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Zera o cache do roteador do lado do cliente.
    // Garante que cada navegação re-executa useEffect e busca dados frescos.
    staleTimes: {
      dynamic: 0, // páginas dinâmicas: sem cache
      static: 30, // páginas estáticas: mínimo de 30s exigido pelo Next.js
    },
  },
};

export default nextConfig;

