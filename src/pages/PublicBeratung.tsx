import SalesWizard from '@/components/SalesWizard';
import { BookingLayout } from '@/components/esc/public/BookingLayout';

export default function PublicBeratung() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isEmbed = params?.get('embed') === '1' || params?.get('embed') === 'true';

  if (isEmbed) {
    return (
      <div className="min-h-screen p-2 sm:p-4 bg-transparent">
        <SalesWizard publicMode={false} />
      </div>
    );
  }

  return (
    <BookingLayout>
      <SalesWizard publicMode={false} />
    </BookingLayout>
  );
}
