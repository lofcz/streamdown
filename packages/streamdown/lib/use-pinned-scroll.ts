import {
  type RefCallback,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const BOTTOM_THRESHOLD_PX = 8;

const isAtBottom = (el: HTMLElement): boolean =>
  el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;

const getTouchClientY = (event: TouchEvent): number | null => {
  const touch = event.touches[0] ?? event.changedTouches[0] ?? null;
  return typeof touch?.clientY === "number" ? touch.clientY : null;
};

/**
 * Smart snap-to-bottom for a capped scroll region (code-block body, table).
 *
 * While streaming (`isAnimating`) and latched:
 * - new content auto-scrolls to the end
 * - wheel / touch up detaches immediately
 * - scrolling back to the bottom re-latches
 *
 * `scrollRef` is a callback so custom `scrollable` implementations
 * (e.g. OverlayScrollbars) can attach the *viewport* asynchronously.
 */
export const usePinnedScroll = ({
  enabled,
  isAnimating,
  content,
}: {
  enabled: boolean;
  isAnimating: boolean;
  content: unknown;
}): RefCallback<HTMLDivElement> => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const scrollRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
    setElement((current) => (current === node ? current : node));
  }, []);

  const pinToBottom = useCallback(
    (el: HTMLDivElement) => {
      if (!(isAnimating && pinnedRef.current)) {
        return;
      }
      el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
      lastScrollTopRef.current = el.scrollTop;
    },
    [isAnimating]
  );

  useEffect(() => {
    if (!isAnimating) {
      pinnedRef.current = true;
    }
  }, [isAnimating]);

  useEffect(() => {
    if (!(enabled && element)) {
      return;
    }

    lastScrollTopRef.current = element.scrollTop;

    const detach = () => {
      pinnedRef.current = false;
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        detach();
      }
    };

    let touchStartY: number | null = null;
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = getTouchClientY(event);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (touchStartY === null) {
        return;
      }
      const currentY = getTouchClientY(event);
      if (currentY === null) {
        return;
      }
      const deltaY = currentY - touchStartY;
      if (Math.abs(deltaY) <= 3) {
        return;
      }
      if (deltaY > 0) {
        detach();
      }
      touchStartY = currentY;
    };
    const handleTouchEnd = () => {
      touchStartY = null;
    };

    const handleScroll = () => {
      const goingUp = element.scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = element.scrollTop;

      if (goingUp) {
        detach();
        return;
      }

      if (isAtBottom(element)) {
        pinnedRef.current = true;
      }
    };

    element.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: true,
    });
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    element.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      element.removeEventListener("wheel", handleWheel, { capture: true });
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
      element.removeEventListener("scroll", handleScroll);
    };
  }, [enabled, element]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `content` is the streaming invalidation key (tokens / rows) and is not read inside the effect
  useLayoutEffect(() => {
    if (!(enabled && element)) {
      return;
    }

    pinToBottom(element);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      pinToBottom(element);
    });
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }

    return () => {
      observer.disconnect();
    };
  }, [content, element, enabled, pinToBottom]);

  return scrollRef;
};
