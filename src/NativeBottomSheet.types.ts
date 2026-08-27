import type { ReactNode } from 'react';
import type {
  ColorValue,
  NativeSyntheticEvent,
  ProcessedColorValue,
  StyleProp,
  ViewStyle,
} from 'react-native';

import type { NormalizedDetent } from './bottomSheetUtils';

export type IndexEventData = Readonly<{
  index: number;
}>;

export type PositionChangeEventData = Readonly<{
  /** Sheet position, in points from the bottom. */
  position: number;
  /**
   * Fractional detent index in `0..(detents.length - 1)`, interpolated
   * as the sheet moves between them.
   */
  index: number;
  /** Native monotonic timestamp, in milliseconds, for motion diagnostics. */
  timestamp: number;
}>;

export type KeyboardChangeEventData = Readonly<{
  /** Keyboard overlap with the sheet host, in points / dp. */
  height: number;
}>;

export type NativeDetent = NormalizedDetent;

export type NativeBottomSheetViewProps = {
  detents: readonly NativeDetent[];
  index: number;
  animateIn?: boolean;
  animateContentHeight?: boolean;
  dragEnabled?: boolean;
  extendUnderStatusBar?: boolean;
  modal?: boolean;
  nativeOverlay?: boolean;
  scrollableExpandNegotiation?: number;
  scrollableCollapseNegotiation?: number;
  scrimColor?: ColorValue | ProcessedColorValue | null;
  scrimOpacities?: readonly number[];
  contentHeight?: number;
  hasSurface?: boolean;
  sheetBackgroundColor?: ColorValue | ProcessedColorValue | null;
  sheetCornerRadius?: number;
  dismissible?: boolean;
  keyboardBehavior?: number;
  onIndexChange?: (event: NativeSyntheticEvent<IndexEventData>) => void;
  onSettle?: (event: NativeSyntheticEvent<IndexEventData>) => void;
  onPositionChange?: (event: NativeSyntheticEvent<PositionChangeEventData>) => void;
  onKeyboardChange?: (event: NativeSyntheticEvent<KeyboardChangeEventData>) => void;
  /** Internal: avoids dispatching a native event every frame when no JS listener exists. */
  positionEventsEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  children?: ReactNode;
};
