import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0D10] px-4 text-[#F5F5F5]">
      <div className="rounded-2xl border border-[#252A31] bg-[#14171C] p-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#9CA3AF]">Ruta no disponible</p>
        <h1 className="mt-3 text-3xl font-semibold">Panel no encontrado</h1>
        <p className="mt-2 text-[#9CA3AF]">La vista solicitada no existe o no está autorizada.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-[#00C878] px-4 py-2 text-sm font-semibold text-[#0B0D10]"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
