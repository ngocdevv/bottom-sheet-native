import { registerWebModule, NativeModule } from 'expo';

// NativeBottomSheetModule is not available on the web platform.
class NativeBottomSheetModule extends NativeModule<{}> {}

export default registerWebModule(NativeBottomSheetModule, 'NativeBottomSheetModule');
