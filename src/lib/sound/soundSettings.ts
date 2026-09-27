/*
 * App sounds on / off (v4.69.0) — the 🔊 button in the top bar. Per computer.
 * Every beep and voice in the app checks this: POS beeps (playBeepSound), the
 * scanner beep (playSupermarketBeep) and the payment soundbox voice.
 */

export const SOUND_MUTED_KEY = 'kamai_sound_muted';
export const SOUND_MUTE_EVENT = 'sound_mute_changed';

export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SOUND_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_MUTED_KEY, muted ? 'true' : 'false');
  } catch {}
  if (muted) {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
  }
  window.dispatchEvent(new Event(SOUND_MUTE_EVENT));
}
