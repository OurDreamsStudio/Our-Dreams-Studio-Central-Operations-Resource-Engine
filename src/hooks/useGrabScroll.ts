import { useRef, useState, useCallback } from 'react';

export function useGrabScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only trigger if we are NOT clicking a draggable element (like a card)
    const target = e.target as HTMLElement;
    if (target.closest('[draggable="true"]')) return;

    if (scrollRef.current) {
      setIsScrolling(true);
      setStartX(e.pageX - scrollRef.current.offsetLeft);
      setScrollLeft(scrollRef.current.scrollLeft);
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    setIsScrolling(false);
  }, []);

  const onMouseUp = useCallback(() => {
    setIsScrolling(false);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isScrolling || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Drag speed multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
  }, [isScrolling, startX, scrollLeft]);

  return {
    scrollRef,
    isScrolling,
    events: {
      onMouseDown,
      onMouseLeave,
      onMouseUp,
      onMouseMove,
    }
  };
}
