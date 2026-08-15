import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  processColor,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Portal } from './BottomSheetProvider';
import type {
  NativeBottomSheetViewProps,
  PositionChangeEventData,
} from './NativeBottomSheet.types';
import NativeBottomSheetView from './NativeBottomSheetView';
import {
  type Detent,
  type KeyboardBehavior,
  applyDismissible,
  isNormalizedDetentClosed,
  KEYBOARD_BEHAVIOR_LEVEL,
  normalizeDetent,
  validateIndex,
} from './bottomSheetUtils';

export type { Detent, DetentValue, KeyboardBehavior } from './bottomSheetUtils';
export { programmatic } from './bottomSheetUtils';
export type { KeyboardChangeEventData, PositionChangeEventData } from './NativeBottomSheet.types';

export type ScrollableNegotiationMode = 'none' | 'initial' | 'handoff';

export type ScrollableNegotiation =
  | ScrollableNegotiationMode
  | Readonly<{
      expand: ScrollableNegotiationMode;
      collapse: ScrollableNegotiationMode;
    }>;

const SCROLLABLE_NEGOTIATION_LEVEL: Record<ScrollableNegotiationMode, number> = {
  none: 0,
  initial: 1,
  handoff: 2,
};

const DEFAULT_SCROLLABLE_NEGOTIATION = {
  expand: 'handoff',
  collapse: 'initial',
} as const satisfies Exclude<ScrollableNegotiation, string>;

const DEFAULT_MODAL_SCRIM = 'rgba(0,0,0,0.45)';

/** RN View treats 8-digit hex as RRGGBBAA; product colors are often AARRGGBB. */
function cssOverlayColor(color: string | undefined): string {
  if (!color) return DEFAULT_MODAL_SCRIM;
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return color;
  const alpha = Number.parseInt(match[1], 16) / 255;
  const red = Number.parseInt(match[2], 16);
  const green = Number.parseInt(match[3], 16);
  const blue = Number.parseInt(match[4], 16);
  return `rgba(${red},${green},${blue},${alpha.toFixed(3)})`;
}

export interface BottomSheetProps {
  children: ReactNode;
  surface?: ReactNode;
  style?: StyleProp<ViewStyle>;
  detents?: Detent[];
  index: number;
  animateIn?: boolean;
  animateContentHeight?: boolean;
  extendUnderStatusBar?: boolean;
  onIndexChange?: (index: number) => void;
  onSettle?: (index: number) => void;
  onPositionChange?: (event: NativeSyntheticEvent<PositionChangeEventData>) => void;
  wrapNativeView?: (
    component: ComponentType<NativeBottomSheetViewProps>
  ) => ComponentType<NativeBottomSheetViewProps>;
  scrollableNegotiation?: ScrollableNegotiation;
  /** @deprecated Use `scrollableNegotiation="none"` instead. */
  disableScrollableNegotiation?: boolean;
  sheetBackgroundColor?: string;
  sheetCornerRadius?: number;
  /**
   * When false, a closed (0) detent cannot be reached by drag or scrim tap —
   * Scan-results style persistent sheets.
   */
  dismissible?: boolean;
  /**
   * `'none'` — ignore the keyboard (SWM default).
   * `'extend'` — grow a `'content'` detent by the IME height (Wanted / Offer).
   * `'stick'` — keep the current detent; emit `onKeyboardChange` so JS can pin
   * a search/footer above the keyboard (Add cards / Emoji).
   */
  keyboardBehavior?: KeyboardBehavior;
  onKeyboardChange?: (height: number) => void;
}

type ModalOnlyBottomSheetProps = {
  modal?: boolean;
  nativeOverlay?: boolean;
  scrimColor?: string;
  scrimOpacities?: number[];
};

export type BottomSheetInternalProps = BottomSheetProps & ModalOnlyBottomSheetProps;

export const BottomSheet = (props: BottomSheetProps) => {
  const {
    children,
    surface,
    style,
    detents = [0, 'content'],
    index,
    animateIn = true,
    animateContentHeight = true,
    extendUnderStatusBar = false,
    onIndexChange,
    onSettle,
    onPositionChange,
    wrapNativeView,
    modal = false,
    nativeOverlay = false,
    scrollableNegotiation,
    disableScrollableNegotiation,
    scrimColor,
    scrimOpacities,
    sheetBackgroundColor,
    sheetCornerRadius,
    dismissible = true,
    keyboardBehavior = 'none',
    onKeyboardChange,
  } = props as BottomSheetInternalProps;

  const resolvedScrollableNegotiation =
    scrollableNegotiation ??
    (disableScrollableNegotiation ? ('none' as const) : DEFAULT_SCROLLABLE_NEGOTIATION);
  const resolvedExpandNegotiation =
    typeof resolvedScrollableNegotiation === 'string'
      ? resolvedScrollableNegotiation
      : resolvedScrollableNegotiation.expand;
  const resolvedCollapseNegotiation =
    typeof resolvedScrollableNegotiation === 'string'
      ? resolvedScrollableNegotiation
      : resolvedScrollableNegotiation.collapse;
  const usesNativeOverlay = modal && nativeOverlay;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  validateIndex(index, detents.length);
  const normalizedDetents = applyDismissible(detents.map(normalizeDetent), dismissible);
  const selectedNormalizedDetent = normalizedDetents[index]!;
  const isSheetClosed = isNormalizedDetentClosed(selectedNormalizedDetent);
  const resolvedScrimOpacities =
    scrimOpacities ??
    normalizedDetents.map((detent) => (isNormalizedDetentClosed(detent) ? 0 : 1));
  const resolvedScrimColor = cssOverlayColor(scrimColor ?? (modal ? DEFAULT_MODAL_SCRIM : undefined));

  const handleIndexChange = useCallback(
    (event: NativeSyntheticEvent<{ index: number }>) => {
      onIndexChange?.(event.nativeEvent.index);
    },
    [onIndexChange]
  );
  const handleSettle = useCallback(
    (event: NativeSyntheticEvent<{ index: number }>) => {
      onSettle?.(event.nativeEvent.index);
    },
    [onSettle]
  );
  const handleKeyboardChange = useCallback(
    (event: NativeSyntheticEvent<{ height: number }>) => {
      onKeyboardChange?.(event.nativeEvent.height);
    },
    [onKeyboardChange]
  );

  const [NativeView] = useState(
    () =>
      (wrapNativeView?.(NativeBottomSheetView) ?? NativeBottomSheetView) as ComponentType<
        NativeBottomSheetViewProps & { children?: ReactNode }
      >
  );

  const [contentHeight, setContentHeight] = useState(0);
  const resolvedCornerRadius = sheetCornerRadius ?? 28;

  const sheet = (
    <View
      pointerEvents={modal && isSheetClosed ? 'none' : 'box-none'}
      style={StyleSheet.absoluteFill}>
      <NativeView
        animateContentHeight={animateContentHeight}
        animateIn={animateIn}
        contentHeight={contentHeight}
        detents={normalizedDetents}
        dismissible={dismissible}
        extendUnderStatusBar={extendUnderStatusBar}
        hasSurface={surface != null || sheetBackgroundColor != null}
        index={index}
        keyboardBehavior={KEYBOARD_BEHAVIOR_LEVEL[keyboardBehavior]}
        modal={modal}
        nativeOverlay={usesNativeOverlay}
        onIndexChange={handleIndexChange}
        onKeyboardChange={handleKeyboardChange}
        onPositionChange={onPositionChange}
        onSettle={handleSettle}
        pointerEvents={modal ? (isSheetClosed ? 'none' : 'auto') : 'box-none'}
        scrimColor={
          (processColor(resolvedScrimColor ?? DEFAULT_MODAL_SCRIM) as
            | string
            | number
            | undefined) ?? undefined
        }
        scrimOpacities={resolvedScrimOpacities}
        scrollableCollapseNegotiation={SCROLLABLE_NEGOTIATION_LEVEL[resolvedCollapseNegotiation]}
        scrollableExpandNegotiation={SCROLLABLE_NEGOTIATION_LEVEL[resolvedExpandNegotiation]}
        sheetBackgroundColor={
          (processColor(sheetBackgroundColor) as string | number | undefined) ?? undefined
        }
        sheetCornerRadius={resolvedCornerRadius}
        style={
          usesNativeOverlay
            ? { position: 'absolute', left: 0, bottom: 0, width: windowWidth, height: windowHeight }
            : [StyleSheet.absoluteFill, { backgroundColor: 'transparent' }, style]
        }>
        {surface != null ? (
          <View
            collapsable={false}
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, styles.sheetClip, { borderTopLeftRadius: resolvedCornerRadius, borderTopRightRadius: resolvedCornerRadius }]}>
            {surface}
          </View>
        ) : sheetBackgroundColor != null ? (
          <View
            collapsable={false}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.sheetClip,
              {
                backgroundColor: sheetBackgroundColor,
                borderTopLeftRadius: resolvedCornerRadius,
                borderTopRightRadius: resolvedCornerRadius,
              },
            ]}
          />
        ) : null}
        <View
          collapsable={false}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height;
            setContentHeight((current) => {
              if (next < 1 && current > 1) return current;
              return Math.abs(current - next) < 0.5 ? current : next;
            });
          }}
          style={styles.contentWrapper}>
          {children}
        </View>
      </NativeView>
    </View>
  );

  if (modal) {
    if (usesNativeOverlay) {
      return sheet;
    }
    return <Portal>{sheet}</Portal>;
  }

  return sheet;
};

const styles = StyleSheet.create({
  contentWrapper: {
    alignSelf: 'stretch',
  },
  sheetClip: {
    overflow: 'hidden',
  },
});
