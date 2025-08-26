import { useCallback, useEffect, useRef, useState } from "react";

export function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const observer = useRef<ResizeObserver | null>(null);

  const disconnect = useCallback(() => {
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    disconnect();
    observer.current = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    observer.current.observe(ref.current);
    return disconnect;
  }, [disconnect]);

  return { ref, size } as const;
}
