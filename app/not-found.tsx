import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <h1 className="text-4xl font-black text-[#2D3436] uppercase tracking-wide">404 - Page Not Found</h1>
      <p className="text-slate-500 font-bold mt-2">Bacha, where are you wandering? Get back to study!</p>
      <Link href="/" className="mt-6 px-6 py-3 bg-[#E17055] text-white border-4 border-[#2D3436] rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-[#d15f43] shadow-[4px_4px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none transition-all">
        Go Home
      </Link>
    </div>
  );
}
