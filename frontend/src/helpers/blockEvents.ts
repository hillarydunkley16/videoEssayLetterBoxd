// A tiny signal that the user blocked or unblocked someone. Screens that list other people's
// content (feeds, people) subscribe and reload, so a blocked user's rows leave a screen that
// is already mounted. Same shape as toast.ts.
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyBlockChanged() {
  listeners.forEach((listener) => listener());
}

export function subscribeBlockChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
