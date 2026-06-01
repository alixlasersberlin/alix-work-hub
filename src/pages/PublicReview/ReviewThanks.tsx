import { CheckCircle2 } from 'lucide-react';

export default function ReviewThanks() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl shadow-sm p-10 text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-semibold">Vielen Dank für Ihre Bewertung.</h1>
        <p className="text-neutral-600">Ihre Rückmeldung hilft uns, unseren Service weiter zu verbessern.</p>
        <div className="text-xs uppercase tracking-widest text-neutral-500 pt-4">Alix Lasers</div>
      </div>
    </div>
  );
}
