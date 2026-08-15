import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type {
  NativeBottomSheetViewProps,
  PositionChangeEventData,
} from './NativeBottomSheet.types';

type WebProps = NativeBottomSheetViewProps;

/**
 * Lightweight web stand-in so the public API can be imported in web bundles.
 * Native iOS/Android own the real engine.
 */
export default function NativeBottomSheetView(props: WebProps) {
  const {
    children,
    detents,
    index,
    modal,
    scrimColor,
    scrimOpacities,
    sheetBackgroundColor = '#ffffff',
    sheetCornerRadius = 28,
    style,
    onIndexChange,
    onSettle,
    onPositionChange,
  } = props;

  const closed = useMemo(() => {
    const detent = detents[index];
    return detent != null && detent.kind !== 'content' && detent.value === 0;
  }, [detents, index]);

  const opacity = scrimOpacities?.[index] ?? (closed ? 0 : 1);

  if (closed && modal) {
    return null;
  }

  return (
    <View pointerEvents={modal ? 'auto' : 'box-none'} style={[StyleSheet.absoluteFill, style]}>
      {modal ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const closedIndex = detents.findIndex(
              (detent) => detent.kind !== 'content' && detent.value === 0 && !detent.programmatic
            );
            if (closedIndex >= 0) {
              onIndexChange?.({
                nativeEvent: { index: closedIndex },
              } as Parameters<NonNullable<WebProps['onIndexChange']>>[0]);
              onSettle?.({
                nativeEvent: { index: closedIndex },
              } as Parameters<NonNullable<WebProps['onSettle']>>[0]);
            }
          }}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: (scrimColor as string | undefined) ?? 'rgba(0,0,0,0.4)', opacity },
          ]}
        />
      ) : null}
      <View
        onLayout={(event) => {
          const payload: PositionChangeEventData = {
            position: event.nativeEvent.layout.height,
            index,
          };
          onPositionChange?.({
            nativeEvent: payload,
          } as Parameters<NonNullable<WebProps['onPositionChange']>>[0]);
        }}
        style={[
          styles.sheet,
          {
            backgroundColor: sheetBackgroundColor as string,
            borderTopLeftRadius: sheetCornerRadius,
            borderTopRightRadius: sheetCornerRadius,
          },
          webSheetStyle(),
        ]}>
        {children}
      </View>
    </View>
  );
}

const webSheetStyle = (): StyleProp<ViewStyle> =>
  Platform.OS === 'web' ? ({ boxShadow: '0 -12px 40px rgba(0,0,0,0.12)' } as ViewStyle) : null;

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
});
