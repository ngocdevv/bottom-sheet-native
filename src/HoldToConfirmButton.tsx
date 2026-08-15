import { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const HOLD_MS = 900;

export function HoldToConfirmButton({
  label,
  onConfirm,
  disabled,
  style,
  holdMs = HOLD_MS,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  holdMs?: number;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);
  const finishedRef = useRef(false);

  const start = (_event?: GestureResponderEvent) => {
    if (disabled) return;
    finishedRef.current = false;
    setHolding(true);
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      duration: holdMs,
      toValue: 1,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !finishedRef.current) {
        finishedRef.current = true;
        onConfirm();
        setHolding(false);
        progress.setValue(0);
      }
    });
  };

  const cancel = () => {
    if (finishedRef.current) return;
    progress.stopAnimation();
    progress.setValue(0);
    setHolding(false);
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={start}
      onPressOut={cancel}
      style={[styles.button, disabled && styles.disabled, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.label}>{holding ? 'Keep holding…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#e11d48',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.45,
  },
  fill: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
