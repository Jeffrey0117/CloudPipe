/**
 * Lightweight animation presets for CSS transitions
 * Replaces framer-motion with pure CSS + minimal JS
 */

// Default transition timing
export const defaultTransition = {
  duration: 200,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
};

// Convert animation values to CSS style object
export const animationToStyle = (animation, transition = defaultTransition) => {
  if (!animation) return {};

  const style = {};
  const transforms = [];

  // Handle opacity
  if ('opacity' in animation) {
    style.opacity = animation.opacity;
  }

  // Handle y translation
  if ('y' in animation) {
    transforms.push(`translateY(${animation.y}px)`);
  }

  // Handle x translation
  if ('x' in animation) {
    transforms.push(`translateX(${animation.x}px)`);
  }

  // Handle scale
  if ('scale' in animation) {
    transforms.push(`scale(${animation.scale})`);
  }

  // Handle scaleX
  if ('scaleX' in animation) {
    transforms.push(`scaleX(${animation.scaleX})`);
  }

  // Handle scaleY
  if ('scaleY' in animation) {
    transforms.push(`scaleY(${animation.scaleY})`);
  }

  // Handle rotation
  if ('rotate' in animation) {
    transforms.push(`rotate(${animation.rotate}deg)`);
  }

  if (transforms.length > 0) {
    style.transform = transforms.join(' ');
  }

  return style;
};

// Generate CSS transition string
export const getTransitionString = (properties = ['opacity', 'transform'], transition = defaultTransition) => {
  const { duration, easing } = transition;
  return properties.map(prop => `${prop} ${duration}ms ${easing}`).join(', ');
};

// Common animation presets
export const presets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
  },
  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  },
  slideInRight: {
    initial: { x: 300 },
    animate: { x: 0 },
    exit: { x: 300 }
  },
  slideInLeft: {
    initial: { x: -300 },
    animate: { x: 0 },
    exit: { x: -300 }
  },
  slideInUp: {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 100, opacity: 0 }
  },
  slideInDown: {
    initial: { y: -50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -50, opacity: 0 }
  }
};
