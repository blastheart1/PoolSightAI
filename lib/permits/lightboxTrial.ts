// Lightbox API trial expiration: May 5, 2026
const LIGHTBOX_TRIAL_EXPIRES = new Date("2026-05-05T23:59:59");

export function lightboxTrialDaysLeft(): number {
  const now = new Date();
  const diff = LIGHTBOX_TRIAL_EXPIRES.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function lightboxTrialLabel(): string {
  const days = lightboxTrialDaysLeft();
  if (days === 0) return "Trial expired";
  return `Trial · ${days}d left`;
}
