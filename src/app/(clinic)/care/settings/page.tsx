import SettingsPage from '@/app/(main)/settings/page';

// The same Settings (account, alerts, role preview, demo mode) inside the clinic workspace, kept to a readable width
export default function ClinicSettingsPage() {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1">
      <SettingsPage />
    </div>
  );
}
