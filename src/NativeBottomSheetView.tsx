import { requireNativeView } from 'expo';
import { type ComponentType } from 'react';

import type { NativeBottomSheetViewProps } from './NativeBottomSheet.types';

const NativeView: ComponentType<NativeBottomSheetViewProps> =
  requireNativeView('NativeBottomSheet');

export default NativeView;
