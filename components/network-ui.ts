export const networkPanel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
export const networkInput = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
export const networkButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40'
export type Directory = { agencies: { id: string; nom: string; actif: boolean }[]; teams: { id: string; nom: string; agence_id: string | null }[]; members: { id: string; prenom: string; nom: string; agence_id: string | null; equipe_id: string | null; role: string; actif: boolean; statut: string }[] }
