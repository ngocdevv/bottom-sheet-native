import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

type PortalNode = { key: string; node: ReactNode };

type PortalContextValue = {
  mount: (key: string, node: ReactNode) => void;
  update: (key: string, node: ReactNode) => void;
  unmount: (key: string) => void;
};

const PortalContext = createContext<PortalContextValue | null>(null);

let nextKey = 1;

export function BottomSheetProvider({ children }: { children: ReactNode }) {
  const [portals, setPortals] = useState<PortalNode[]>([]);

  const value = useMemo<PortalContextValue>(
    () => ({
      mount: (key, node) => {
        setPortals((current) =>
          current.some((entry) => entry.key === key)
            ? current.map((entry) => (entry.key === key ? { key, node } : entry))
            : [...current, { key, node }]
        );
      },
      update: (key, node) => {
        setPortals((current) =>
          current.map((entry) => (entry.key === key ? { key, node } : entry))
        );
      },
      unmount: (key) => {
        setPortals((current) => current.filter((entry) => entry.key !== key));
      },
    }),
    []
  );

  return (
    <PortalContext.Provider value={value}>
      <View pointerEvents="box-none" style={styles.root}>
        {children}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {portals.map((entry) => (
            <View key={entry.key} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              {entry.node}
            </View>
          ))}
        </View>
      </View>
    </PortalContext.Provider>
  );
}

export function Portal({ children }: { children: ReactNode }) {
  const ctx = useContext(PortalContext);
  if (ctx == null) {
    throw new Error(
      'ModalBottomSheet requires BottomSheetProvider at the root of the app (unless nativeOverlay is set).'
    );
  }

  const keyRef = useRef(`sheet-portal-${nextKey++}`);

  useLayoutEffect(() => {
    const key = keyRef.current;
    ctx.mount(key, children);
    return () => ctx.unmount(key);
  }, [ctx]);

  useLayoutEffect(() => {
    ctx.update(keyRef.current, children);
  }, [children, ctx]);

  return null;
}

export function useOptionalPortal() {
  return useContext(PortalContext);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
