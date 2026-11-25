// Tiny app-wide toast: any screen calls showToast(); <Toast /> (mounted once in
// app/_layout.tsx) listens and displays it briefly. Survives navigation because
// the layout, not the calling screen, owns the display.
type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function showToast(message: string) {
  listeners.forEach((listener) => listener(message));
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
