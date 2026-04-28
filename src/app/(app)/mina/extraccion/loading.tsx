export default function LoadingExtraccion() {
  return (
    <div className="w-full max-w-[1600px] mx-auto h-[calc(100vh-80px)] p-4 md:p-6 flex flex-col overflow-hidden animate-pulse">
      
      {/* Header Fijo Skeleton */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="h-8 w-64 bg-zinc-800 rounded-lg mb-2"></div>
          <div className="h-4 w-96 bg-zinc-800/50 rounded-md"></div>
        </div>
      </div>

      {/* Split Screen Layout Skeleton */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
         
         {/* PANEL IZQUIERDO (BI y KPIs) */}
         <div className="lg:col-span-4 flex flex-col gap-4">
            {/* KPI Grid 2x2 Skeleton */}
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 h-28">
                   <div className="h-3 w-16 bg-zinc-800 rounded mb-4"></div>
                   <div className="h-8 w-24 bg-zinc-800 rounded"></div>
                 </div>
               ))}
            </div>

            {/* Gráfico de Área Compacto Skeleton */}
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 flex-1 min-h-[220px]">
               <div className="h-4 w-40 bg-zinc-800 rounded mb-6"></div>
               <div className="h-full w-full bg-zinc-800/30 rounded-lg"></div>
            </div>
         </div>

         {/* PANEL DERECHO (Operativo / Tabla) */}
         <div className="lg:col-span-8 flex flex-col overflow-hidden bg-zinc-900/60 rounded-xl border border-zinc-800/80 p-4">
            
            {/* Selector de Días Skeleton */}
            <div className="flex gap-2 pb-3 mb-2">
               {[1, 2, 3, 4, 5, 6, 7].map(i => (
                 <div key={i} className="h-8 w-20 bg-zinc-800 rounded-full flex-shrink-0"></div>
               ))}
            </div>

            {/* Mini KPIs Diarios Skeleton */}
            <div className="grid grid-cols-4 gap-2 mb-4">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 h-16">
                   <div className="h-2 w-12 bg-zinc-800 rounded mb-2"></div>
                   <div className="h-5 w-16 bg-zinc-800 rounded"></div>
                 </div>
               ))}
            </div>

            {/* Action Bar Skeleton */}
            <div className="flex items-center justify-between mb-3 gap-4">
               <div className="h-10 w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-lg"></div>
               <div className="h-10 w-32 bg-zinc-800 rounded-lg"></div>
               <div className="h-10 w-40 bg-amber-900/20 rounded-lg border border-amber-900/30"></div>
            </div>

            {/* Table Skeleton */}
            <div className="flex-1 border border-zinc-800/60 rounded-lg bg-zinc-950/30">
               <div className="h-10 border-b border-zinc-800 bg-zinc-900 flex items-center px-4 gap-8">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-3 w-16 bg-zinc-800 rounded"></div>
                  ))}
               </div>
               <div className="p-4 space-y-4">
                  {[1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="h-6 w-full bg-zinc-800/50 rounded"></div>
                  ))}
               </div>
            </div>

         </div>
      </div>
    </div>
  );
}
