// A tiny synchronous signal that lets other first-run overlays (like the
// Freelancer Premium promo) wait for the app guide tour to finish deciding
// whether it will show, and if it does, to finish being shown - so a new
// user always sees the tutorial before any promotional popup can appear.
// "Blocking" covers both "still deciding" (pending) and "currently open".
type Listener = (blocking: boolean) => void;

let pending = false;
let open = false;
const listeners = new Set<Listener>();

function notify() {
  const blocking = pending || open;
  listeners.forEach((listener) => listener(blocking));
}

export function isAppGuideBlocking() {
  return pending || open;
}

export function setAppGuidePending(next: boolean) {
  pending = next;
  notify();
}

export function setAppGuideOpen(next: boolean) {
  open = next;
  notify();
}

export function onAppGuideBlockingChange(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
