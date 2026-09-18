import Link from "next/link";
import { Car, Landmark, Settings, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">ParkDigital</h1>
        <p className="mt-1 text-slate-600">Zona Azul digital para municípios brasileiros</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <Link
          href="/motorista"
          className="flex items-center gap-3 rounded-xl bg-blue-900 px-5 py-4 text-white shadow-sm transition-colors hover:bg-blue-800"
        >
          <Car className="h-5 w-5" />
          <span className="font-medium">Sou motorista</span>
        </Link>

        <Link
          href="/fiscal"
          className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-4 text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
        >
          <ShieldCheck className="h-5 w-5" />
          <span className="font-medium">Sou fiscal de trânsito</span>
        </Link>

        <Link
          href="/governo"
          className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-4 text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
        >
          <Landmark className="h-5 w-5" />
          <span className="font-medium">Sou gestor público</span>
        </Link>

        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-4 text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
        >
          <Settings className="h-5 w-5" />
          <span className="font-medium">Sou administrador</span>
        </Link>
      </div>
    </main>
  );
}
