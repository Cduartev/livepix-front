import Image from "next/image";
import Link from "next/link";
import { User, Tv } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center p-8 text-center sm:p-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Bem-vindo ao LivePix
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Escolha como deseja prosseguir para acessar as funcionalidades.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 w-full max-w-2xl">
          <Link
            href="/sobreposicao/usuario/qr"
            className="group flex flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-blue-500 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-500"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/20">
              <User size={32} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Painel do Usuário</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Acesse seu QR Code e gerencie suas integrações de pagamento.
              </p>
            </div>
          </Link>

          <Link
            href="/sobreposicao/streamer/alertas"
            className="group flex flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-purple-500 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-purple-500"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white dark:bg-purple-900/20">
              <Tv size={32} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Área do Streamer</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Configure alertas de live e acompanhe suas doações em tempo real.
              </p>
            </div>
          </Link>
        </div>

        <footer className="mt-16 text-sm text-zinc-500 dark:text-zinc-400">
          Precisa de ajuda? Consulte nossa <a href="https://github.com/Cduartev/livepix-front" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">documentação</a>.
        </footer>
      </main>
    </div>
  );
}
