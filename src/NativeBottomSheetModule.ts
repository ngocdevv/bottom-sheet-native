import { NativeModule, requireNativeModule } from 'expo';

declare class NativeBottomSheetModule extends NativeModule<{}> {}

export default requireNativeModule<NativeBottomSheetModule>('NativeBottomSheet');
