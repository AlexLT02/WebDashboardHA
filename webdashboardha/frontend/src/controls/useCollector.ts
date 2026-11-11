import { useEffect, useRef, useState } from "react";
import { COLLECT_MS, createCollector, type Collector } from "../state/collect";

/**
 * Collected taps as React state: `value` is what the user dialled in and has
 * not been sent yet (shown at once), `push` adds a tap. On unmount (popup
 * closes within the 800 ms) the collected value is sent, not lost.
 */
export function useCollector<T>(reduce: (acc: T | undefined, v: T) => T, send: (acc: T) => void, ms = COLLECT_MS) {
  const sendRef = useRef(send);
  sendRef.current = send;
  const [value, setValue] = useState<T | undefined>(undefined);
  const ref = useRef<Collector<T> | null>(null);
  if (!ref.current) {
    ref.current = createCollector<T>(ms, reduce, (acc) => {
      setValue(undefined);
      sendRef.current(acc);
    });
  }
  useEffect(() => {
    const c = ref.current;
    return () => c?.flush();
  }, []);
  const c = ref.current;
  return {
    value,
    push: (v: T) => {
      c.push(v);
      setValue(c.current());
    },
  };
}
