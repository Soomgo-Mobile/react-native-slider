import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, Image, StyleSheet, PanResponder, View, Easing, I18nManager } from 'react-native';
import { ShadowedView } from 'react-native-fast-shadow';
import { ViewPropTypes, ImagePropTypes } from 'deprecated-react-native-prop-types';
import PropTypes from 'prop-types';

const TRACK_SIZE = 4;
const THUMB_SIZE = 20;

function Rect(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

Rect.prototype.containsPoint = function (x, y) {
  return x >= this.x && y >= this.y && x <= this.x + this.width && y <= this.y + this.height;
};

const DEFAULT_ANIMATION_CONFIGS = {
  spring: {
    friction: 7,
    tension: 100,
  },
  timing: {
    duration: 150,
    easing: Easing.inOut(Easing.ease),
    delay: 0,
  },
};

const Slider = props => {
  const {
    value: initialValue,
    disabled,
    minimumValue,
    maximumValue,
    step,
    minimumTrackTintColor,
    maximumTrackTintColor,
    thumbTintColor,
    thumbImage,
    style,
    trackStyle,
    thumbStyle,
    thumbShadow,
    debugTouchArea,
    onValueChange,
    onSlidingStart,
    onSlidingComplete,
    thumbTouchSize,
    animateTransitions,
    animationType,
    animationConfig: providedAnimationConfig,
    ...other
  } = props;

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [trackSize, setTrackSize] = useState({ width: 0, height: 0 });
  const [thumbSize, setThumbSize] = useState({ width: 0, height: 0 });
  const [allMeasured, setAllMeasured] = useState(false);

  const value = useRef(new Animated.Value(initialValue)).current;

  const _previousLeft = useRef(0);
  const _containerSize = useRef({ width: 0, height: 0 });
  const _trackSize = useRef({ width: 0, height: 0 });
  const _thumbSize = useRef({ width: 0, height: 0 });

  const _getCurrentValue = useCallback(() => value.__getValue(), [value]);

  const _fireChangeEvent = useCallback(
    event => {
      if (props[event]) {
        props[event](_getCurrentValue());
      }
    },
    [props, _getCurrentValue]
  );

  const _setCurrentValue = useCallback(
    newValue => {
      value.setValue(newValue);
    },
    [value]
  );

  const _setCurrentValueAnimated = useCallback(
    newValue => {
      const animType = animationType;
      const animConfig = Object.assign(
        {},
        DEFAULT_ANIMATION_CONFIGS[animType],
        providedAnimationConfig,
        {
          toValue: newValue,
        }
      );
      Animated[animType](value, animConfig).start();
    },
    [animationType, providedAnimationConfig, value]
  );

  useEffect(() => {
    if (animateTransitions) {
      _setCurrentValueAnimated(initialValue);
    } else {
      _setCurrentValue(initialValue);
    }
  }, [initialValue, animateTransitions, _setCurrentValueAnimated, _setCurrentValue]);

  const _getRatio = useCallback(
    val => (val - minimumValue) / (maximumValue - minimumValue),
    [minimumValue, maximumValue]
  );

  const _getThumbLeft = useCallback(
    val => {
      const nonRtlRatio = _getRatio(val);
      const ratio = I18nManager.isRTL ? 1 - nonRtlRatio : nonRtlRatio;
      return ratio * (containerSize.width - thumbSize.width);
    },
    [_getRatio, containerSize.width, thumbSize.width]
  );

  const _getValue = useCallback(
    gestureState => {
      const length = containerSize.width - thumbSize.width;
      const thumbLeft = _previousLeft.current + gestureState.dx;

      const nonRtlRatio = thumbLeft / length;
      const ratio = I18nManager.isRTL ? 1 - nonRtlRatio : nonRtlRatio;

      if (step) {
        return Math.max(
          minimumValue,
          Math.min(
            maximumValue,
            minimumValue + Math.round((ratio * (maximumValue - minimumValue)) / step) * step
          )
        );
      }
      return Math.max(
        minimumValue,
        Math.min(maximumValue, ratio * (maximumValue - minimumValue) + minimumValue)
      );
    },
    [containerSize.width, thumbSize.width, minimumValue, maximumValue, step]
  );

  const _handlePanResponderGrant = useCallback(() => {
    _previousLeft.current = _getThumbLeft(_getCurrentValue());
    _fireChangeEvent('onSlidingStart');
  }, [_getThumbLeft, _getCurrentValue, _fireChangeEvent]);

  const _handlePanResponderMove = useCallback(
    (e, gestureState) => {
      if (disabled) {
        return;
      }
      _setCurrentValue(_getValue(gestureState));
      _fireChangeEvent('onValueChange');
    },
    [disabled, _setCurrentValue, _getValue, _fireChangeEvent]
  );

  const _handlePanResponderEnd = useCallback(
    (e, gestureState) => {
      if (disabled) {
        return;
      }
      _setCurrentValue(_getValue(gestureState));
      _fireChangeEvent('onSlidingComplete');
    },
    [disabled, _setCurrentValue, _getValue, _fireChangeEvent]
  );

  const _getTouchOverflowSize = useCallback(() => {
    const size = {};
    if (allMeasured) {
      size.width = Math.max(0, thumbTouchSize.width - _thumbSize.current.width);
      size.height = Math.max(0, thumbTouchSize.height - _containerSize.current.height);
    }
    return size;
  }, [allMeasured, thumbTouchSize, _thumbSize, _containerSize]);

  const _getThumbTouchRect = useCallback(() => {
    const touchOverflowSize = _getTouchOverflowSize();
    return new Rect(
      touchOverflowSize.width / 2 +
        _getThumbLeft(_getCurrentValue()) +
        (_thumbSize.current.width - thumbTouchSize.width) / 2,
      touchOverflowSize.height / 2 + (_containerSize.current.height - thumbTouchSize.height) / 2,
      thumbTouchSize.width,
      thumbTouchSize.height
    );
  }, [
    _getTouchOverflowSize,
    _getThumbLeft,
    _getCurrentValue,
    _thumbSize,
    _containerSize,
    thumbTouchSize,
  ]);

  const _thumbHitTest = useCallback(
    e => {
      const nativeEvent = e.nativeEvent;
      const thumbTouchRect = _getThumbTouchRect();
      return thumbTouchRect.containsPoint(nativeEvent.locationX, nativeEvent.locationY);
    },
    [_getThumbTouchRect]
  );

  const _handleStartShouldSetPanResponder = useCallback(
    e => {
      return _thumbHitTest(e);
    },
    [_thumbHitTest]
  );

  const _handleMoveShouldSetPanResponder = useCallback(() => false, []);
  const _handlePanResponderRequestEnd = useCallback(() => false, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: _handleStartShouldSetPanResponder,
      onMoveShouldSetPanResponder: _handleMoveShouldSetPanResponder,
      onPanResponderGrant: _handlePanResponderGrant,
      onPanResponderMove: _handlePanResponderMove,
      onPanResponderRelease: _handlePanResponderEnd,
      onPanResponderTerminationRequest: _handlePanResponderRequestEnd,
      onPanResponderTerminate: _handlePanResponderEnd,
    })
  ).current;

  const _handleMeasure = useCallback((name, x) => {
    const { width, height } = x.nativeEvent.layout;
    const size = { width, height };

    const storeNameRef =
      name === 'containerSize' ? _containerSize : name === 'trackSize' ? _trackSize : _thumbSize;
    storeNameRef.current = size;

    if (_containerSize.current.width && _trackSize.current.width && _thumbSize.current.width) {
      setContainerSize(_containerSize.current);
      setTrackSize(_trackSize.current);
      setThumbSize(_thumbSize.current);
      setAllMeasured(true);
    }
  }, []);

  const _measureContainer = useCallback(x => _handleMeasure('containerSize', x), [_handleMeasure]);
  const _measureTrack = useCallback(x => _handleMeasure('trackSize', x), [_handleMeasure]);
  const _measureThumb = useCallback(x => _handleMeasure('thumbSize', x), [_handleMeasure]);

  const mainStyles = props.styles || defaultStyles; // props.styles is not in propTypes
  const thumbLeft = value.interpolate({
    inputRange: [minimumValue, maximumValue],
    outputRange: I18nManager.isRTL
      ? [0, -(containerSize.width - thumbSize.width)]
      : [0, containerSize.width - thumbSize.width],
  });
  const minimumTrackWidth = value.interpolate({
    inputRange: [minimumValue, maximumValue],
    outputRange: [0, containerSize.width - thumbSize.width],
  });

  const valueVisibleStyle = {};
  if (!allMeasured) {
    valueVisibleStyle.opacity = 0;
  }

  const minimumTrackStyle = {
    position: 'absolute',
    width: Animated.add(minimumTrackWidth, thumbSize.width / 2),
    backgroundColor: minimumTrackTintColor,
    ...valueVisibleStyle,
  };

  const _getTouchOverflowStyle = useCallback(() => {
    const { width, height } = _getTouchOverflowSize();
    const touchOverflowStyle = {};
    if (width !== undefined && height !== undefined) {
      const verticalMargin = -height / 2;
      touchOverflowStyle.marginTop = verticalMargin;
      touchOverflowStyle.marginBottom = verticalMargin;

      const horizontalMargin = -width / 2;
      touchOverflowStyle.marginLeft = horizontalMargin;
      touchOverflowStyle.marginRight = horizontalMargin;
    }

    if (debugTouchArea === true) {
      touchOverflowStyle.backgroundColor = 'orange';
      touchOverflowStyle.opacity = 0.5;
    }
    return touchOverflowStyle;
  }, [_getTouchOverflowSize, debugTouchArea]);

  const touchOverflowStyle = _getTouchOverflowStyle();

  const _renderThumbImage = useCallback(() => {
    if (!thumbImage) return null;
    return <Image source={thumbImage} />;
  }, [thumbImage]);

  const _renderDebugThumbTouchRect = useCallback(
    minTrackWidth => {
      // minTrackWidth is not used
      const rect = _getThumbTouchRect();
      const positionStyle = {
        left: thumbLeft, // This should be rect.x or calculated based on current value
        top: rect.y,
        width: rect.width,
        height: rect.height,
      };

      return (
        <Animated.View
          style={[defaultStyles.debugThumbTouchArea, positionStyle]}
          pointerEvents="none"
        />
      );
    },
    [_getThumbTouchRect, thumbLeft]
  );

  return (
    <View {...other} style={[mainStyles.container, style]} onLayout={_measureContainer}>
      <View
        style={[{ backgroundColor: maximumTrackTintColor }, mainStyles.track, trackStyle]}
        renderToHardwareTextureAndroid // This prop is not available in View
        onLayout={_measureTrack}
      />
      <Animated.View
        renderToHardwareTextureAndroid // This prop is not available in View
        style={[mainStyles.track, trackStyle, minimumTrackStyle]}
      />
      <ShadowedView
        style={StyleSheet.flatten([
          thumbShadow,
          { backgroundColor: thumbTintColor },
          mainStyles.thumb,
          thumbStyle,
          valueVisibleStyle,
          {
            transform: [{ translateX: thumbLeft }, { translateY: 0 }],
          },
        ])}
      >
        <Animated.View
          onLayout={_measureThumb}
          renderToHardwareTextureAndroid
          style={StyleSheet.flatten([
            { backgroundColor: thumbTintColor },
            mainStyles.thumb,
            thumbStyle,
          ])}
        >
          {_renderThumbImage()}
        </Animated.View>
      </ShadowedView>
      <View
        renderToHardwareTextureAndroid // This prop is not available in View
        style={[defaultStyles.touchArea, touchOverflowStyle]}
        {...panResponder.panHandlers}
      >
        {debugTouchArea === true && _renderDebugThumbTouchRect(minimumTrackWidth)}
      </View>
    </View>
  );
};

Slider.propTypes = {
  value: PropTypes.number,
  disabled: PropTypes.bool,
  minimumValue: PropTypes.number,
  maximumValue: PropTypes.number,
  step: PropTypes.number,
  minimumTrackTintColor: PropTypes.string,
  maximumTrackTintColor: PropTypes.string,
  thumbTintColor: PropTypes.string,
  thumbTouchSize: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  onValueChange: PropTypes.func,
  onSlidingStart: PropTypes.func,
  onSlidingComplete: PropTypes.func,
  style: ViewPropTypes.style,
  trackStyle: ViewPropTypes.style,
  thumbStyle: ViewPropTypes.style,
  thumbShadow: ViewPropTypes.style,
  thumbImage: ImagePropTypes.source,
  debugTouchArea: PropTypes.bool,
  animateTransitions: PropTypes.bool,
  animationType: PropTypes.oneOf(['spring', 'timing']),
  animationConfig: PropTypes.object,
  // styles: ViewPropTypes.style, // This was used internally but not a defined prop
};

Slider.defaultProps = {
  value: 0,
  minimumValue: 0,
  maximumValue: 1,
  step: 0,
  minimumTrackTintColor: '#3f3f3f',
  maximumTrackTintColor: '#b3b3b3',
  thumbTintColor: '#343434',
  thumbTouchSize: { width: 40, height: 40 },
  debugTouchArea: false,
  animationType: 'timing',
  animateTransitions: false, // Default was missing in class, but behavior implies false
};

const defaultStyles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_SIZE,
    borderRadius: TRACK_SIZE / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  touchArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  debugThumbTouchArea: {
    position: 'absolute',
    backgroundColor: 'green',
    opacity: 0.5,
  },
});

export default Slider;
