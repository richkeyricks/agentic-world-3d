import type { AccessStatus } from './access.ts'

export type EntryView = 'public' | 'lock' | 'admin' | 'loading'

/**
 * Decides which view the app root shows.
 *
 * Public is the default: anyone opening the root URL without an access code
 * sees the public office, never the lock screen. The lock screen appears only
 * when admin is explicitly requested (`?admin=1` or the "Masuk sebagai admin"
 * link in the public view). `?public=1` keeps working as before and wins over
 * `?admin=1`; an unlocked device (or no access code set) always loads the
 * admin view. This exists because Serveo's free warning page drops `?public=1`
 * on "Continue to Site", so first-time public visitors used to land on the
 * lock screen and had to open the link a second time.
 */
export function entryView({ search, checked, access }: { search: string; checked: boolean; access: AccessStatus | undefined }): EntryView {
  const params = new URLSearchParams(search)
  if (params.get('public') === '1') return 'public'
  if (!checked) return 'loading'
  if (access?.enabled && !access.unlocked) return params.get('admin') === '1' ? 'lock' : 'public'
  return 'admin'
}
