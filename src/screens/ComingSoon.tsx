import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';

export function ComingSoon({ title, phase, children }: { title: string; phase: number; children?: ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 grid place-items-center">
        <Construction className="w-6 h-6" />
      </div>
      <h2 className="mt-3 font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">Đang xây dựng ở giai đoạn {phase}.</p>
      {children}
    </div>
  );
}
