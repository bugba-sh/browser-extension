import type { EnvironmentMetadata } from "./telemetry"

type AdfMark = {
  type: "link"
  attrs: {
    href: string
  }
}

type AdfNode =
  | {
      type: "text"
      text: string
      marks?: AdfMark[]
    }
  | {
      type: "hardBreak"
    }

type AdfParagraph = {
  type: "paragraph"
  content: AdfNode[]
}

type AdfTableCell = {
  type: "tableCell" | "tableHeader"
  content: AdfParagraph[]
}

type AdfTableRow = {
  type: "tableRow"
  content: AdfTableCell[]
}

type AdfTable = {
  type: "table"
  attrs?: {
    isNumberColumnEnabled?: boolean
    layout?: "default"
  }
  content: AdfTableRow[]
}

export type AdfDocument = {
  type: "doc"
  version: 1
  content: Array<AdfParagraph | AdfTable>
}

type ParagraphSegment =
  | string
  | {
      text: string
      href: string
    }

function createParagraph(segments: ParagraphSegment[]): AdfParagraph {
  const content: AdfNode[] = []

  for (const segment of segments) {
    if (typeof segment === "string") {
      if (segment) {
        content.push({
          type: "text",
          text: segment
        })
      }
      continue
    }

    if (segment.text) {
      content.push({
        type: "text",
        text: segment.text,
        marks: [
          {
            type: "link",
            attrs: {
              href: segment.href
            }
          }
        ]
      })
    }
  }

  return {
    type: "paragraph",
    content
  }
}

function createTextParagraph(text: string): AdfParagraph {
  return createParagraph([text])
}

function createTableCell(
  text: string,
  type: AdfTableCell["type"] = "tableCell"
): AdfTableCell {
  return {
    type,
    content: [createTextParagraph(text)]
  }
}

function createEnvironmentTable(
  headerLabel: string,
  headerValue: string,
  rows: Array<[label: string, value: string]>
): AdfTable {
  return {
    type: "table",
    attrs: {
      layout: "default",
      isNumberColumnEnabled: false
    },
    content: [
      {
        type: "tableRow",
        content: [
          createTableCell(headerLabel, "tableHeader"),
          createTableCell(headerValue, "tableHeader")
        ]
      },
      ...rows.map(
        ([label, value]) =>
          ({
            type: "tableRow",
            content: [createTableCell(label), createTableCell(value)]
          }) satisfies AdfTableRow
      )
    ]
  }
}

function createDocument(blocks: Array<AdfParagraph | AdfTable>): AdfDocument {
  return {
    type: "doc",
    version: 1,
    content: blocks.filter((block) =>
      block.type === "table"
        ? block.content.length > 0
        : block.content.length > 0
    )
  }
}

export function buildEnvironmentRows(
  environment: EnvironmentMetadata
): Array<[string, string]> {
  return [
    ["URL", environment.url],
    ["Title", environment.title || "-"],
    ["Captured At", environment.capturedAt],
    [
      "Browser",
      `${environment.browserName} ${environment.browserVersion}`.trim()
    ],
    ["OS", `${environment.osName} ${environment.osVersion}`.trim()],
    ["Device", environment.device],
    ["Platform", environment.platform],
    ["Viewport", `${environment.viewportWidth}x${environment.viewportHeight}`],
    ["Screen", `${environment.screenWidth}x${environment.screenHeight}`],
    [
      "Available Screen",
      `${environment.availScreenWidth}x${environment.availScreenHeight}`
    ],
    ["Pixel Density", String(environment.pixelDensity)],
    ["Locale", environment.locale],
    ["Language", environment.language],
    ["Timezone", environment.timezone],
    ["Referrer", environment.referrer || "-"],
    ["User Agent", environment.userAgent]
  ]
}

function getFeedbackPageMetadata(pageUrl: string): {
  hostLabel: string
  linkLabel: string
} {
  try {
    const hostLabel = new URL(pageUrl).host || "Page"

    return {
      hostLabel,
      linkLabel: `BugBash feedback captured on ${hostLabel}`
    }
  } catch {
    return {
      hostLabel: "Page",
      linkLabel: "BugBash feedback captured"
    }
  }
}

export function buildDescriptionDocument({
  telemetryEvents,
  screenshotAttached,
  environment
}: {
  telemetryEvents: number
  screenshotAttached: boolean
  environment: EnvironmentMetadata
}): AdfDocument {
  const { hostLabel, linkLabel } = getFeedbackPageMetadata(environment.url)

  return createDocument([
    createParagraph([linkLabel]),
    createTextParagraph(`Telemetry events: ${telemetryEvents}`),
    createTextParagraph(
      screenshotAttached ? "Screenshot attached." : "Screenshot unavailable."
    ),
    createEnvironmentTable(
      "Environment",
      hostLabel,
      buildEnvironmentRows(environment)
    )
  ])
}
