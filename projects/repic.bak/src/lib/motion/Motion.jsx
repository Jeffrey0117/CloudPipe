import { useState, useEffect, useRef, forwardRef, useContext, useCallback } from 'react';
import { animationToStyle, getTransitionString, defaultTransition } from './presets';
import { AnimatePresenceContext } from './AnimatePresence';

/**
 * Lightweight Motion component - CSS transition based animation
 * Replaces framer-motion's motion.div with similar API
 *
 * Supported props:
 * - initial: Initial animation state
 * - animate: Target animation state
 * - exit: Exit animation state (requires AnimatePresence parent)
 * - whileHover: Hover state animation
 * - whileTap: Active/pressed state animation
 * - transition: { duration, easing }
 * - as: Element type (default: 'div')
 */
const Motion = forwardRef(function Motion({
  children,
  initial,
  animate,
  exit,
  whileHover,
  whileTap,
  transition = defaultTransition,
  as: Component = 'div',
  style: propStyle = {},
  className = '',
  onAnimationComplete,
  ...props
}, ref) {
  const presenceContext = useContext(AnimatePresenceContext);
  const isExiting = presenceContext?.isExiting;

  const [currentState, setCurrentState] = useState('initial');
  const [hoverState, setHoverState] = useState(false);
  const [tapState, setTapState] = useState(false);
  const mountedRef = useRef(false);
  const elementRef = useRef(null);

  // Combine refs
  const combinedRef = useCallback((node) => {
    elementRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Handle initial -> animate transition
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      // Start with initial state, then animate
      if (initial) {
        // Small delay to ensure initial styles are applied
        const timer = setTimeout(() => {
          setCurrentState('animate');
        }, 10);
        return () => clearTimeout(timer);
      }
    }
    setCurrentState('animate');
  }, [initial]);

  // Handle exit animation
  useEffect(() => {
    if (isExiting && exit) {
      setCurrentState('exit');
    }
  }, [isExiting, exit]);

  // Determine which animation to apply
  const getAnimationState = () => {
    if (isExiting && exit) return exit;
    if (tapState && whileTap) return { ...animate, ...whileTap };
    if (hoverState && whileHover) return { ...animate, ...whileHover };
    if (currentState === 'initial' && initial) return initial;
    return animate;
  };

  const currentAnimation = getAnimationState();
  const animationStyle = animationToStyle(currentAnimation, transition);

  // Build transition string
  const transitionStr = currentState === 'initial'
    ? 'none'
    : getTransitionString(['opacity', 'transform'], transition);

  const combinedStyle = {
    ...propStyle,
    ...animationStyle,
    transition: transitionStr,
    willChange: 'transform, opacity'
  };

  // Handle animation complete callback
  useEffect(() => {
    if (onAnimationComplete && currentState === 'animate') {
      const timer = setTimeout(() => {
        onAnimationComplete();
      }, transition.duration || defaultTransition.duration);
      return () => clearTimeout(timer);
    }
  }, [currentState, onAnimationComplete, transition.duration]);

  // Event handlers for hover/tap
  const handleMouseEnter = (e) => {
    if (whileHover) setHoverState(true);
    props.onMouseEnter?.(e);
  };

  const handleMouseLeave = (e) => {
    if (whileHover) setHoverState(false);
    if (whileTap) setTapState(false);
    props.onMouseLeave?.(e);
  };

  const handleMouseDown = (e) => {
    if (whileTap) setTapState(true);
    props.onMouseDown?.(e);
  };

  const handleMouseUp = (e) => {
    if (whileTap) setTapState(false);
    props.onMouseUp?.(e);
  };

  // Filter out motion-specific props before passing to DOM
  const {
    onMouseEnter: _onMouseEnter,
    onMouseLeave: _onMouseLeave,
    onMouseDown: _onMouseDown,
    onMouseUp: _onMouseUp,
    ...restProps
  } = props;

  return (
    <Component
      ref={combinedRef}
      className={className}
      style={combinedStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      {...restProps}
    >
      {children}
    </Component>
  );
});

// Create motion.element shortcuts
const elements = ['div', 'span', 'button', 'a', 'img', 'ul', 'li', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside'];

const motion = {};
elements.forEach(element => {
  motion[element] = forwardRef((props, ref) => (
    <Motion {...props} as={element} ref={ref} />
  ));
});

// Also export Motion directly
motion.Motion = Motion;

export { Motion, motion };
export default motion;
