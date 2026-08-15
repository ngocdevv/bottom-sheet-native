import { createElement } from 'react';

import { BottomSheet, type BottomSheetInternalProps, type BottomSheetProps } from './BottomSheet';

export interface ModalBottomSheetProps extends BottomSheetProps {
  /**
   * Present the sheet in a native overlay above everything — including native
   * modal screens — instead of the `BottomSheetProvider` portal.
   */
  nativeOverlay?: boolean;
  /** Top-corner radius of the sheet surface. Default 28. */
  sheetCornerRadius?: number;
  /** Scrim color shown behind the modal sheet. */
  scrimColor?: string;
  /**
   * Scrim opacities per detent, indexed to match `detents`. Each value in 0-1
   * scales the scrim color's alpha at the detent of the same index.
   */
  scrimOpacities?: number[];
}

export const ModalBottomSheet = (props: ModalBottomSheetProps) => {
  const internalProps: BottomSheetInternalProps = {
    ...props,
    modal: true,
    scrimColor: props.scrimColor ?? 'rgba(0,0,0,0.45)',
  };
  return createElement(BottomSheet, internalProps);
};
