import { useEffect } from 'react';
import { buttonVariants } from './ui/button';

interface DashboardProps {
  onSelectApp: (appId: string) => void;
}

export function Dashboard({ onSelectApp }: DashboardProps) {
  useEffect(() => {
    document.title = "MOBUS - Dashboard";
  }, []);

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 overflow-auto">
      <div className="max-w-7xl mx-auto p-8 pt-20">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-zinc-950 dark:text-zinc-50 mb-2">Kies een ervaring</h1>
          <p className="text-zinc-500 text-base">
            Ontdek verschillende manieren om ideeën te laten groeien, verbinden en verkennen met MOBUS
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Idea Ecosystem App */}
          <button
            onClick={() => onSelectApp('idea-ecosystem')}
            className="group relative h-56 box-border bg-white dark:bg-zinc-900 rounded border border-zinc-950 dark:border-zinc-50 p-8 text-left cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex flex-col justify-center"
          >
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              Ideeën ecosysteem
            </h3>
            <p className="text-zinc-650 dark:text-zinc-350 text-sm mb-4">
              Verzamel gedachten, ontdek verbanden en ervaar hoe ideeën samen uitgroeien tot een levend netwerk.
            </p>

            <div className={buttonVariants({
              className: "mt-2 self-start bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            })}>
              <span>Start ervaring</span>
            </div>
          </button>

          {/* Coming Soon Apps */}
          {[
            { title: 'Binnekort Beschikbaar', description: 'Nieuwe ervaring in ontwikkeling' },
            { title: 'Binnekort Beschikbaar', description: 'Nieuwe ervaring in ontwikkeling' },
            { title: 'Binnekort Beschikbaar', description: 'Nieuwe ervaring in ontwikkeling' },
            { title: 'Binnekort Beschikbaar', description: 'Nieuwe ervaring in ontwikkeling' },
            { title: 'Binnekort Beschikbaar', description: 'Nieuwe ervaring in ontwikkeling' },
          ].map((app, index) => (
            <div
              key={index}
              className="h-56 box-border bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-8 text-left opacity-40 cursor-not-allowed flex flex-col justify-center"
            >
              <h3 className="text-2xl font-bold text-zinc-400 mb-2">
                {app.title}
              </h3>
              <p className="text-zinc-500 text-sm mb-4">
                {app.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
