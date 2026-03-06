import { useState, useEffect, useRef, createContext, Children, cloneElement, isValidElement } from 'react';
import { defaultTransition } from './presets';

/**
 * Context to communicate exit state to Motion children
 */
export const AnimatePresenceContext = createContext(null);

/**
 * Lightweight AnimatePresence - handles exit animations
 * Replaces framer-motion's AnimatePresence
 *
 * Props:
 * - mode: 'sync' | 'wait' - 'wait' waits for exit before enter
 * - onExitComplete: Callback when exit animation finishes
 * - exitDuration: Duration for exit animation (ms)
 */
export function AnimatePresence({
  children,
  mode = 'sync',
  onExitComplete,
  exitDuration = defaultTransition.duration
}) {
  const [exitingChildren, setExitingChildren] = useState([]);
  const [showCurrent, setShowCurrent] = useState(true);
  const prevChildrenRef = useRef([]);
  const exitTimeoutRef = useRef(null);

  // Get current valid children
  const currentChildren = Children.toArray(children).filter(isValidElement);
  const currentKeys = new Set(currentChildren.map(child => child.key));

  useEffect(() => {
    const prevChildren = prevChildrenRef.current;
    const prevKeys = new Set(prevChildren.map(child => child.key));

    // Find children that are exiting
    const exiting = prevChildren.filter(child =>
      child.key && !currentKeys.has(child.key)
    );

    // Clear any pending timeout
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    if (exiting.length > 0) {
      setExitingChildren(exiting);

      if (mode === 'wait') {
        setShowCurrent(false);
      }

      // Schedule removal after exit animation
      exitTimeoutRef.current = setTimeout(() => {
        setExitingChildren([]);
        setShowCurrent(true);
        onExitComplete?.();
      }, exitDuration);
    } else {
      // Clear any stale exiting children that weren't cleaned up
      setExitingChildren(prev => prev.length > 0 ? [] : prev);
      setShowCurrent(true);
    }

    prevChildrenRef.current = currentChildren;

    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [children, exitDuration, mode, onExitComplete]);

  // Build final rendered list
  const rendered = [];

  // Add current children (maybe hidden in wait mode)
  if (showCurrent || mode !== 'wait') {
    currentChildren.forEach(child => {
      rendered.push(
        <AnimatePresenceContext.Provider
          key={child.key}
          value={{ isExiting: false }}
        >
          {cloneElement(child)}
        </AnimatePresenceContext.Provider>
      );
    });
  }

  // Add exiting children (pointer-events disabled to prevent blocking current content)
  exitingChildren.forEach(child => {
    rendered.push(
      <AnimatePresenceContext.Provider
        key={child.key}
        value={{ isExiting: true }}
      >
        <div style={{ pointerEvents: 'none' }}>
          {cloneElement(child)}
        </div>
      </AnimatePresenceContext.Provider>
    );
  });

  return <>{rendered}</>;
}

export default AnimatePresence;
