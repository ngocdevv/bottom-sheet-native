import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardInset } from './useKeyboardInset';

export function SheetHandle({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="adjustable" style={[styles.wrap, style]}>
      <View style={styles.pill} />
    </View>
  );
}

export function SheetHeader({
  title,
  onClose,
  accessory,
}: {
  title?: string;
  onClose?: () => void;
  accessory?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerSideEnd]}>
        {accessory}
        {onClose ? (
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.close}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SheetFooter({
  children,
  onBack,
  style,
}: {
  children: ReactNode;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.footer, style]}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.back}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.footerMain}>{children}</View>
    </View>
  );
}

/** Pins children above the keyboard. Pair with `keyboardBehavior="stick"`. */
export function SheetDock({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const inset = useKeyboardInset();
  return <View style={[{ paddingBottom: inset }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  pill: {
    backgroundColor: 'rgba(60,60,67,0.28)',
    borderRadius: 2,
    height: 5,
    width: 36,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  headerSide: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 44,
  },
  headerSideEnd: {
    justifyContent: 'flex-end',
  },
  title: {
    color: '#111',
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  close: {
    alignItems: 'center',
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  closeGlyph: {
    color: '#3c3c43',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  back: {
    alignItems: 'center',
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 22,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  backGlyph: {
    color: '#111',
    fontSize: 28,
    lineHeight: 30,
    marginTop: -2,
  },
  footerMain: {
    flex: 1,
  },
});
