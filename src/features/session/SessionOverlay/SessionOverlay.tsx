import { finder } from "@medv/finder"
import type {
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
  SyntheticEvent
} from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { AnnotationOverlay } from "~src/components/AnnotationOverlay"
import { FeedbackMarker } from "~src/components/FeedbackMarker"
import { PendingFeedbackDialog } from "~src/components/PendingFeedbackDialog"
import {
  AnnotationManager,
  clampPercent,
  createPointReference,
  FLOATING_OFFSET,
  FLOATING_PADDING,
  resolvePendingViewportPoint,
  type PendingAnnotationPoint,
  type Point
} from "~src/features/annotation"
import {
  isFeedbackVisibleOnPage,
  type FeedbackItem
} from "~src/session/feedback"
import {
  jiraIssueToFeedbackItem,
  type BugBashJiraIssue
} from "~src/session/jira-issues"
import { sendRuntimeMessage } from "~src/session/messages"
import { collectPageMetadata } from "~src/session/page-metadata"
import { captureAnnotatedScreenshot } from "~src/session/screenshot"
import type { BugBashSession } from "~src/session/types"

import styles from "./SessionOverlay.module.css"

const EXTENSION_CLICK_IGNORE_SELECTOR =
  "[data-bugbash-session-overlay], [data-bugbash-annotation-host]"
const ANNOTATION_HIDE_STYLE_ID = "bugbash-hide-preview-annotations"

function setPersistedAnnotationHostsHidden(hidden: boolean) {
  const existingStyle = document.getElementById(ANNOTATION_HIDE_STYLE_ID)

  if (!hidden) {
    existingStyle?.remove()
    return
  }

  if (existingStyle) {
    return
  }

  const parent = document.head || document.documentElement
  if (!parent) {
    return
  }

  const style = document.createElement("style")
  style.id = ANNOTATION_HIDE_STYLE_ID
  style.textContent = "[data-bugbash-annotation-host]{display:none !important;}"
  parent.appendChild(style)
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  const hasVerticalScroll =
    /(auto|scroll|overlay)/.test(style.overflowY) &&
    element.scrollHeight > element.clientHeight
  const hasHorizontalScroll =
    /(auto|scroll|overlay)/.test(style.overflowX) &&
    element.scrollWidth > element.clientWidth

  return hasVerticalScroll || hasHorizontalScroll
}

function positionFloatingElement(
  reference: { x: number; y: number },
  floatingElement: HTMLElement
) {
  const viewportPadding = FLOATING_PADDING
  const preferredLeft = reference.x + FLOATING_OFFSET
  const preferredTop = reference.y + FLOATING_OFFSET
  const maxLeft = Math.max(
    viewportPadding,
    window.innerWidth - floatingElement.offsetWidth - viewportPadding
  )
  const maxTop = Math.max(
    viewportPadding,
    window.innerHeight - floatingElement.offsetHeight - viewportPadding
  )

  floatingElement.style.left = `${Math.min(Math.max(preferredLeft, viewportPadding), maxLeft)}px`
  floatingElement.style.top = `${Math.min(Math.max(preferredTop, viewportPadding), maxTop)}px`
}

export function SessionOverlay() {
  const [session, setSession] = useState<BugBashSession | null>(null)
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [isAnnotationMode, setIsAnnotationMode] = useState(false)
  const [pendingAnnotation, setPendingAnnotation] =
    useState<PendingAnnotationPoint | null>(null)
  const [pendingPoint, setPendingPoint] = useState<Point | null>(null)
  const [summary, setSummary] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const overlayRef = useRef<HTMLDivElement | null>(null)
  const pendingDialogRef = useRef<HTMLFormElement | null>(null)
  const annotationManagerRef = useRef<AnnotationManager | null>(null)

  const visibleFeedback = useMemo(
    () =>
      feedbackItems.filter((feedback) =>
        isFeedbackVisibleOnPage(feedback, window.location.href)
      ),
    [feedbackItems]
  )

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      const response = await sendRuntimeMessage<BugBashSession | null>({
        type: "bugbash:get-tab-session"
      })

      if (!cancelled && response.ok) {
        setSession(response.value)
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setFeedbackItems([])
      return
    }

    let cancelled = false

    async function loadFeedback() {
      const [previewResponse, jiraResponse] = await Promise.all([
        sendRuntimeMessage<FeedbackItem[]>({
          type: "bugbash:list-preview-feedback",
          sessionId: session.id
        }),
        sendRuntimeMessage<BugBashJiraIssue[]>({
          type: "bugbash:list-jira-issues",
          jiraOrg: session.jiraOrg,
          jiraIssueKey: session.jiraIssueKey
        })
      ])

      if (!cancelled) {
        const previewFeedback = previewResponse.ok ? previewResponse.value : []
        const jiraFeedback = jiraResponse.ok
          ? jiraResponse.value.map((issue) =>
              jiraIssueToFeedbackItem(session.id, issue)
            )
          : []

        setFeedbackItems([...jiraFeedback, ...previewFeedback])
      }
    }

    void loadFeedback()
    const handleStorageChange = () => {
      void loadFeedback()
    }
    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [session])

  useEffect(() => {
    const manager = new AnnotationManager({
      onDotClick: () => {}
    })

    annotationManagerRef.current = manager

    return () => {
      manager.destroy()
      annotationManagerRef.current = null
    }
  }, [])

  useEffect(() => {
    annotationManagerRef.current?.setFeedback(visibleFeedback)
  }, [visibleFeedback])

  useEffect(() => {
    setPersistedAnnotationHostsHidden(isAnnotationMode)

    return () => {
      setPersistedAnnotationHostsHidden(false)
    }
  }, [isAnnotationMode])

  useEffect(() => {
    if (!pendingAnnotation || !pendingDialogRef.current) {
      setPendingPoint(null)
      return
    }

    const dialogNode = pendingDialogRef.current

    const positionPendingDialog = () => {
      const nextPoint = resolvePendingViewportPoint(pendingAnnotation)
      const reference = createPointReference(nextPoint.x, nextPoint.y)

      setPendingPoint(nextPoint)
      positionFloatingElement(
        {
          x: reference.getBoundingClientRect().left,
          y: reference.getBoundingClientRect().top
        },
        dialogNode
      )
    }

    const frameId = window.requestAnimationFrame(positionPendingDialog)
    window.addEventListener("resize", positionPendingDialog)
    window.addEventListener("scroll", positionPendingDialog, true)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", positionPendingDialog)
      window.removeEventListener("scroll", positionPendingDialog, true)
    }
  }, [pendingAnnotation])

  const resetPendingState = () => {
    setPendingAnnotation(null)
    setPendingPoint(null)
    setSummary("")
    setSubmitError("")
    setIsSubmitting(false)
  }

  const exitAnnotationMode = () => {
    resetPendingState()
    setIsAnnotationMode(false)
  }

  const stopEvent = (event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const createPendingAnnotationFromClick = (
    clientX: number,
    clientY: number
  ): PendingAnnotationPoint | null => {
    const overlay = overlayRef.current
    if (!overlay) {
      return null
    }

    overlay.style.pointerEvents = "none"
    const clickedElement = document.elementFromPoint(clientX, clientY)
    overlay.style.pointerEvents = "auto"

    if (
      !clickedElement ||
      clickedElement.closest(EXTENSION_CLICK_IGNORE_SELECTOR)
    ) {
      return null
    }

    const selector = finder(clickedElement)
    const rect = clickedElement.getBoundingClientRect()

    return {
      selector,
      clientX,
      clientY,
      xPercent:
        rect.width > 0
          ? clampPercent(((clientX - rect.left) / rect.width) * 100)
          : 0,
      yPercent:
        rect.height > 0
          ? clampPercent(((clientY - rect.top) / rect.height) * 100)
          : 0
    }
  }

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    stopEvent(event)

    const nextPendingAnnotation = createPendingAnnotationFromClick(
      event.clientX,
      event.clientY
    )

    if (!nextPendingAnnotation) {
      return
    }

    setSubmitError("")
    setPendingAnnotation(nextPendingAnnotation)
  }

  const handleOverlayWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const overlay = overlayRef.current
    if (!overlay) {
      return
    }

    overlay.style.pointerEvents = "none"
    const target = document.elementFromPoint(
      event.clientX,
      event.clientY
    ) as HTMLElement | null
    overlay.style.pointerEvents = "auto"

    let scrollTarget = target
    while (scrollTarget) {
      if (isScrollableElement(scrollTarget)) {
        scrollTarget.scrollBy({
          left: event.deltaX,
          top: event.deltaY,
          behavior: "auto"
        })
        return
      }

      scrollTarget = scrollTarget.parentElement
    }

    window.scrollBy({
      left: event.deltaX,
      top: event.deltaY,
      behavior: "auto"
    })
  }

  const submitPendingFeedback = async () => {
    const trimmedSummary = summary.trim()

    if (!session || !pendingAnnotation || !trimmedSummary || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    const { page, browser, environment } = collectPageMetadata()
    let screenshotDataUrl: string | undefined

    if (pendingPoint) {
      try {
        screenshotDataUrl = await captureAnnotatedScreenshot({
          marker: {
            clientX: pendingPoint.x,
            clientY: pendingPoint.y
          },
          hiddenSelector:
            "[data-bugbash-session-overlay], [data-bugbash-annotation-host]",
          hiddenElements: [pendingDialogRef.current],
          captureVisibleTab: async () => {
            const screenshotResponse = await sendRuntimeMessage<string>({
              type: "bugbash:capture-visible-tab",
              marker: {
                clientX: pendingPoint.x,
                clientY: pendingPoint.y
              }
            })

            if (screenshotResponse.ok === false) {
              throw new Error(screenshotResponse.error)
            }

            return screenshotResponse.value
          }
        })
      } catch {
        screenshotDataUrl = undefined
      }
    }

    const response = await sendRuntimeMessage<BugBashJiraIssue>({
      type: "bugbash:create-jira-issue",
      jiraOrg: session.jiraOrg,
      jiraIssueKey: session.jiraIssueKey,
      summary: trimmedSummary,
      annotation: {
        selector: pendingAnnotation.selector,
        xPercent: pendingAnnotation.xPercent,
        yPercent: pendingAnnotation.yPercent,
        pageUrl: window.location.href
      },
      page,
      browser,
      environment,
      ...(screenshotDataUrl ? { screenshotDataUrl } : {})
    })

    if (response.ok === false) {
      setSubmitError(response.error)
      setIsSubmitting(false)
      return
    }

    setFeedbackItems((current) => [
      jiraIssueToFeedbackItem(session.id, response.value),
      ...current
    ])
    exitAnnotationMode()
  }

  if (!session) {
    return null
  }

  return (
    <div
      className={styles["bugbash--session-overlay"]}
      data-bugbash-session-overlay="">
      {isAnnotationMode ? (
        <>
          <div className={styles["bugbash--session-overlay__page-frame"]} />
          <AnnotationOverlay
            innerRef={overlayRef}
            onClick={handleOverlayClick}
            onWheel={handleOverlayWheel}
            onMouseDown={stopEvent}
            onMouseUp={stopEvent}
          />
          <div
            className={styles["bugbash--session-overlay__annotation-controls"]}>
            <button type="button" onClick={exitAnnotationMode}>
              Cancel
            </button>
          </div>
        </>
      ) : null}

      {pendingPoint ? <FeedbackMarker point={pendingPoint} /> : null}

      {pendingAnnotation ? (
        <PendingFeedbackDialog
          innerRef={pendingDialogRef}
          summary={summary}
          error={submitError}
          isSubmitting={isSubmitting}
          onSummaryChange={(value) => {
            setSummary(value)
            if (submitError) {
              setSubmitError("")
            }
          }}
          onSubmit={submitPendingFeedback}
          onCancel={exitAnnotationMode}
        />
      ) : null}

      {!isAnnotationMode ? (
        <button
          className={styles["bugbash--session-overlay__action"]}
          type="button"
          onClick={() => {
            resetPendingState()
            setIsAnnotationMode(true)
          }}>
          Add feedback
        </button>
      ) : null}
    </div>
  )
}
