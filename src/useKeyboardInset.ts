import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Keyboard height that should be added as bottom padding on `'content'` sheets.
 * Pair with `animateContentHeight={false}` when you animate the padding yourself.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      setInset(event.endCoordinates.height);
    };
    const onHide = () => setInset(0);

    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
