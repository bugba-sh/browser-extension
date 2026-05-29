import type { FeedbackItem } from "~src/session/feedback"

import { resolvePortalHost, resolveTargetElement } from "./host-resolution"
import {
  clampPointToHost,
  computeHostLocalPoint,
  computeViewportPoint
} from "./positioning"

const POSITION_MARKER_ATTR = "data-bugbash-positioned"
const RECONCILE_INTERVAL_MS = 750

type HostMutation = {
  count: number
  previousInlinePosition: string | null
  addedRelative: boolean
}

type AnnotationRuntime = {
  feedback: FeedbackItem
  target: Element
  host: HTMLElement
  mountHost: HTMLDivElement
  dotNode: HTMLButtonElement
}

export interface AnnotationManagerOptions {
  onDotClick: (feedbackId: string) => void
}

export class AnnotationManager {
  private feedback: FeedbackItem[] = []
  private readonly runtimeById = new Map<string, AnnotationRuntime>()
  private readonly hostMutationByElement = new Map<HTMLElement, HostMutation>()
  private frameId: number | null = null
  private reconcileTimerId: number | null = null
  private isDestroyed = false

  constructor(private readonly options: AnnotationManagerOptions) {
    window.addEventListener("resize", this.handleViewportChange)
    document.addEventListener("scroll", this.handleViewportChange, {
      capture: true,
      passive: true
    })
  }

  setFeedback(feedback: FeedbackItem[]) {
    this.feedback = feedback
    this.updateReconcileTimer()
    this.scheduleSync()
  }

  destroy() {
    if (this.isDestroyed) {
      return
    }

    this.isDestroyed = true

    window.removeEventListener("resize", this.handleViewportChange)
    document.removeEventListener("scroll", this.handleViewportChange, true)

    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId)
      this.frameId = null
    }

    this.stopReconcileTimer()
    for (const feedbackId of Array.from(this.runtimeById.keys())) {
      this.removeRuntime(feedbackId)
    }
  }

  private readonly handleViewportChange = () => {
    this.scheduleSync()
  }

  private updateReconcileTimer() {
    if (this.feedback.length === 0) {
      this.stopReconcileTimer()
      return
    }

    if (this.reconcileTimerId !== null) {
      return
    }

    this.reconcileTimerId = window.setInterval(() => {
      this.scheduleSync()
    }, RECONCILE_INTERVAL_MS)
  }

  private stopReconcileTimer() {
    if (this.reconcileTimerId === null) {
      return
    }

    window.clearInterval(this.reconcileTimerId)
    this.reconcileTimerId = null
  }

  private scheduleSync() {
    if (this.isDestroyed || this.frameId !== null) {
      return
    }

    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null
      this.sync()
    })
  }

  private sync() {
    const activeIds = new Set(this.feedback.map(({ id }) => id))

    for (const feedbackId of Array.from(this.runtimeById.keys())) {
      if (!activeIds.has(feedbackId)) {
        this.removeRuntime(feedbackId)
      }
    }

    for (const feedback of this.feedback) {
      const target = resolveTargetElement(feedback.annotation.selector)
      const host = resolvePortalHost(target)
      if (!target || !host) {
        this.removeRuntime(feedback.id)
        continue
      }

      let runtime = this.runtimeById.get(feedback.id)
      if (!runtime || runtime.host !== host) {
        this.removeRuntime(feedback.id)
        runtime = this.createRuntime(feedback, target, host)
        this.runtimeById.set(feedback.id, runtime)
      } else {
        runtime.feedback = feedback
        runtime.target = target
      }

      this.positionRuntime(runtime)
    }
  }

  private createRuntime(
    feedback: FeedbackItem,
    target: Element,
    host: HTMLElement
  ): AnnotationRuntime {
    this.attachHost(host)

    const mountHost = document.createElement("div")
    mountHost.setAttribute("data-bugbash-annotation-host", `${feedback.id}`)
    mountHost.style.position = "absolute"
    mountHost.style.inset = "0"
    mountHost.style.overflow = "visible"
    mountHost.style.pointerEvents = "none"
    mountHost.style.zIndex = "1"

    const shadowRoot = mountHost.attachShadow({ mode: "open" })
    const styleNode = document.createElement("style")
    styleNode.textContent = `
      :host {
        all: initial;
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: visible;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      button {
        all: initial;
        cursor: pointer;
      }
    `
    shadowRoot.appendChild(styleNode)

    const dotNode = document.createElement("button")
    dotNode.type = "button"
    dotNode.textContent = "+"
    dotNode.style.position = "absolute"
    dotNode.style.left = "0"
    dotNode.style.top = "0"
    dotNode.style.transform = "translate(-50%, -50%)"
    dotNode.style.zIndex = "1"
    dotNode.style.pointerEvents = "auto"
    dotNode.style.lineHeight = "1"
    dotNode.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.options.onDotClick(feedback.id)
    })

    shadowRoot.appendChild(dotNode)
    host.appendChild(mountHost)

    return {
      feedback,
      target,
      host,
      mountHost,
      dotNode
    }
  }

  private removeRuntime(feedbackId: string) {
    const runtime = this.runtimeById.get(feedbackId)
    if (!runtime) {
      return
    }

    runtime.mountHost.remove()
    this.detachHost(runtime.host)
    this.runtimeById.delete(feedbackId)
  }

  private attachHost(host: HTMLElement) {
    const existingMutation = this.hostMutationByElement.get(host)
    if (existingMutation) {
      existingMutation.count += 1
      return
    }

    const previousInlinePosition = host.style.position || null
    const computedPosition = window.getComputedStyle(host).position
    let addedRelative = false

    if (computedPosition === "static") {
      host.style.position = "relative"
      host.setAttribute(POSITION_MARKER_ATTR, "1")
      addedRelative = true
    }

    this.hostMutationByElement.set(host, {
      count: 1,
      previousInlinePosition,
      addedRelative
    })
  }

  private detachHost(host: HTMLElement) {
    const mutation = this.hostMutationByElement.get(host)
    if (!mutation) {
      return
    }

    mutation.count -= 1
    if (mutation.count > 0) {
      return
    }

    if (mutation.addedRelative) {
      if (mutation.previousInlinePosition) {
        host.style.position = mutation.previousInlinePosition
      } else {
        host.style.removeProperty("position")
      }
      host.removeAttribute(POSITION_MARKER_ATTR)
    }

    this.hostMutationByElement.delete(host)
  }

  private positionRuntime(runtime: AnnotationRuntime) {
    const { feedback, dotNode, host, target } = runtime
    const targetRect = target.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    const { xPercent, yPercent } = feedback.annotation

    const viewportPoint = computeViewportPoint(targetRect, xPercent, yPercent)

    if (target === host) {
      dotNode.style.left = `${xPercent}%`
      dotNode.style.top = `${yPercent}%`
    } else {
      const localPoint = computeHostLocalPoint(hostRect, viewportPoint)
      const clampedPoint = clampPointToHost(localPoint, hostRect)
      dotNode.style.left = `${clampedPoint.x}px`
      dotNode.style.top = `${clampedPoint.y}px`
    }
  }
}
