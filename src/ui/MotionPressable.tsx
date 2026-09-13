import React from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface MotionPressableProps
  extends Omit<PressableProps, 'style' | 'onPressIn' | 'onPressOut'> {
  readonly style?: StyleProp<ViewStyle>;
  readonly onPressIn?: (event: GestureResponderEvent) => void;
  readonly onPressOut?: (event: GestureResponderEvent) => void;
}

/**
 * Native equivalent of the product UI's press/tap micro-transition.
 *
 * It keeps the hit target and accessibility contract on Pressable while
 * animating only opacity and scale on the UI thread. The system reduced-motion
 * setting is passed to Reanimated rather than being inferred in a screen.
 */
export function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  ...rest
}: MotionPressableProps): React.ReactElement {
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.08,
    transform: [{ scale: 1 - pressed.value * 0.018 }],
  }));

  const handlePressIn = (event: GestureResponderEvent): void => {
    pressed.value = withTiming(1, {
      duration: 90,
      reduceMotion: ReduceMotion.System,
    });
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent): void => {
    pressed.value = withTiming(0, {
      duration: 140,
      reduceMotion: ReduceMotion.System,
    });
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      style={[style, pressStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    />
  );
}
