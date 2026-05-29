import { resolveTargetElement } from "./host-resolution"

export type Point = {
  x: number
  y: number
}

export interface VirtualPointReference {
  getBoundingClientRect: () => DOMRect
  contextElement?: Element
}

export const FLOATING_PADDING = 8
export const FLOATING_OFFSET = 10

export interface PendingAnnotationPoint {
  selector: string
  xPercent: number
  yPercent: number
  clientX: number
  clientY: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function clampPercent(value: number): number {
  return clamp(value, 0, 100)
}

export function computeViewportPoint(
  targetRect: DOMRect,
  xPercent: number,
  yPercent: number
): Point {
  return {
    x: targetRect.left + (targetRect.width * xPercent) / 100,
    y: targetRect.top + (targetRect.height * yPercent) / 100
  }
}

export function computeHostLocalPoint(hostRect: DOMRect, point: Point): Point {
  return {
    x: point.x - hostRect.left,
    y: point.y - hostRect.top
  }
}

export function clampPointToHost(point: Point, hostRect: DOMRect): Point {
  return {
    x: clamp(point.x, 0, Math.max(0, hostRect.width)),
    y: clamp(point.y, 0, Math.max(0, hostRect.height))
  }
}

export function resolvePendingViewportPoint(
  annotation: PendingAnnotationPoint
): Point {
  const target = resolveTargetElement(annotation.selector)

  if (!target) {
    return {
      x: annotation.clientX,
      y: annotation.clientY
    }
  }

  return computeViewportPoint(
    target.getBoundingClientRect(),
    annotation.xPercent,
    annotation.yPercent
  )
}

export function createPointReference(
  x: number,
  y: number,
  contextElement?: Element
): VirtualPointReference {
  return {
    getBoundingClientRect() {
      return {
        x,
        y,
        left: x,
        top: y,
        right: x,
        bottom: y,
        width: 0,
        height: 0,
        toJSON: () => ({})
      } as DOMRect
    },
    contextElement
  }
}
