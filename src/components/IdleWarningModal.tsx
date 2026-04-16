'use client';

import { Clock, LogOut, RefreshCw } from 'lucide-react';

interface IdleWarningModalProps {
  countdown: number;
  onStayActive: () => void;
  onSignOut: () => void;
}

export default function IdleWarningModal({
  countdown,
  onStayActive,
  onSignOut,
}: IdleWarningModalProps) {
  const mins    = Math.floor(countdown / 60);
  const secs    = countdown % 60;
  const display = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;
  const urgent  = countdown <= 30;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 overflow-hidden">

        {/* Top accent — turns red when urgent */}
        <div className={`h-[3px] transition-colors duration-500 ${urgent ? 'bg-red-500' : 'bg-amber-700'}`} />

        <div className="px-8 py-8">

          {/* Icon + countdown ring */}
          <div className="flex flex-col items-center mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-500 ${urgent ? 'bg-red-50' : 'bg-amber-50'}`}>
              <Clock className={`w-7 h-7 transition-colors duration-500 ${urgent ? 'text-red-500' : 'text-amber-700'}`} />
            </div>
            <span className={`text-4xl font-black tabular-nums transition-colors duration-500 ${urgent ? 'text-red-500' : 'text-amber-700'}`}>
              {display}
            </span>
          </div>

          <h3 className="text-lg font-bold text-stone-800 text-center mb-2">
            Sesión por expirar
          </h3>
          <p className="text-sm text-stone-400 text-center mb-8 leading-relaxed">
            Su sesión se cerrará automáticamente por inactividad.
            Haga clic en <span className="font-semibold text-stone-500">Continuar</span> para seguir trabajando.
          </p>

          <div className="space-y-3">
            <button
              onClick={onStayActive}
              className="w-full rounded-xl bg-amber-700 py-3 text-sm font-semibold text-white hover:bg-amber-800 active:bg-amber-900 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Continuar sesión
            </button>
            <button
              onClick={onSignOut}
              className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-stone-500 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión ahora
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
