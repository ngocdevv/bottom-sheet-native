import { useCallback, useMemo, useState } from 'react';

/**
 * Nested pages inside one sheet — Cardtrace action → folders/tags, filter →
 * status, folder → custom colour. Height follows the new page via `'content'`.
 */
export function useSheetStack<T extends string>(root: T) {
  const [stack, setStack] = useState<readonly T[]>([root]);

  const page = stack[stack.length - 1] ?? root;
  const depth = stack.length;

  const push = useCallback((next: T) => {
    setStack((current) => (current[current.length - 1] === next ? current : [...current, next]));
  }, []);

  const pop = useCallback(() => {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback(
    (next?: T) => {
      setStack([next ?? root]);
    },
    [root]
  );

  return useMemo(
    () => ({ page, depth, stack, push, pop, reset }),
    [page, depth, stack, push, pop, reset]
  );
}
