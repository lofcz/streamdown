const SVG_OPEN_TAG_RE = /(<svg\b)/;
const SVG_TAG_RE = /<svg\b[^>]*>/i;
const SVG_VIEWBOX_RE = /\bviewBox=(['"])(.*?)\1/i;
const SVG_WIDTH_ATTR_RE = /\swidth=(['"]).*?\1/gi;
const SVG_HEIGHT_ATTR_RE = /\sheight=(['"]).*?\1/gi;
const SVG_STYLE_ATTR_RE = /\sstyle=(['"])(.*?)\1/i;
const SVG_TAG_START_RE = /^<svg/i;
const CSS_WIDTH_DECL_RE = /^width\s*:/i;
const CSS_HEIGHT_DECL_RE = /^height\s*:/i;
const CSS_MAX_WIDTH_DECL_RE = /^max-width\s*:/i;
const VIEWBOX_SPLIT_RE = /[\s,]+/;

/**
 * Ensure the SVG root element declares the xlink namespace when the document
 * contains xlink-prefixed attributes (e.g. `xlink:href` used by Mermaid in
 * C4 and sequence diagrams).  Without the declaration the SVG is not valid
 * XML: browsers refuse to load it as an image, causing PNG export to fail
 * silently.
 *
 * The fix mirrors the approach used for other Mermaid SVG normalisation
 * issues: detect the problem via a lightweight string check and patch the
 * root `<svg>` opening tag in-place before any further processing.
 *
 * Falls back to the original string when the namespace is already present or
 * when xlink-prefixed attributes are absent.
 */
export const addXlinkNamespaceIfMissing = (svgString: string): string => {
  if (!svgString.includes("xlink:") || svgString.includes("xmlns:xlink")) {
    return svgString;
  }
  return svgString.replace(
    SVG_OPEN_TAG_RE,
    '$1 xmlns:xlink="http://www.w3.org/1999/xlink"'
  );
};

/**
 * Mermaid render output may be HTML-serialized. Serialize the SVG node as XML
 * before downloading so embedded HTML like <br> becomes valid SVG markup.
 */
export const serializeSvgForDownload = (svgString: string): string => {
  if (
    typeof DOMParser === "undefined" ||
    typeof XMLSerializer === "undefined"
  ) {
    return svgString;
  }

  const doc = new DOMParser().parseFromString(svgString, "text/html");
  const svg = doc.querySelector("svg");

  if (!svg) {
    return svgString;
  }

  return new XMLSerializer().serializeToString(svg);
};

/**
 * Normalize Mermaid SVG dimensions for inline rendering.
 * Mermaid emits width="100%" with max-width style, which can shrink very wide
 * diagrams until text becomes unreadable.
 */
export const getMermaidSvgSize = (
  svgString: string
): { height: number; width: number } | null => {
  const svgTagMatch = svgString.match(SVG_TAG_RE);
  if (!svgTagMatch) {
    return null;
  }

  const svgTag = svgTagMatch[0];
  const viewBoxMatch = svgTag.match(SVG_VIEWBOX_RE);
  const viewBox = viewBoxMatch?.[2];

  if (!viewBox) {
    return null;
  }

  const values = viewBox
    .trim()
    .split(VIEWBOX_SPLIT_RE)
    .map((value) => Number.parseFloat(value));

  if (values.length < 4 || values.slice(0, 4).some(Number.isNaN)) {
    return null;
  }

  const width = values[2];
  const height = values[3];
  if (!(width > 0 && height > 0)) {
    return null;
  }

  return { height, width };
};

/**
 * Normalize Mermaid SVG dimensions for inline rendering.
 * Mermaid emits width="100%" with max-width style, which can shrink very wide
 * diagrams until text becomes unreadable.
 */
export const normalizeMermaidInlineSvg = (svgString: string): string => {
  const svgTagMatch = svgString.match(SVG_TAG_RE);
  if (!svgTagMatch) {
    return svgString;
  }

  try {
    const svgTag = svgTagMatch[0];
    const size = getMermaidSvgSize(svgString);
    if (!size) {
      return svgString;
    }
    const { width, height } = size;

    let updatedSvgTag = svgTag
      .replace(SVG_WIDTH_ATTR_RE, "")
      .replace(SVG_HEIGHT_ATTR_RE, "");

    const styleMatch = updatedSvgTag.match(SVG_STYLE_ATTR_RE);
    const sizeDeclarations = `width:${width}px;height:${height}px;max-width:none;`;

    if (styleMatch) {
      const styleQuote = styleMatch[1];
      const styleValue = styleMatch[2];
      const filtered = styleValue
        .split(";")
        .map((decl) => decl.trim())
        .filter(Boolean)
        .filter(
          (decl) =>
            !(
              CSS_WIDTH_DECL_RE.test(decl) ||
              CSS_HEIGHT_DECL_RE.test(decl) ||
              CSS_MAX_WIDTH_DECL_RE.test(decl)
            )
        )
        .join(";");

      const mergedStyle = `${sizeDeclarations}${filtered ? `${filtered};` : ""}`;
      updatedSvgTag = updatedSvgTag.replace(
        SVG_STYLE_ATTR_RE,
        ` style=${styleQuote}${mergedStyle}${styleQuote}`
      );
    } else {
      updatedSvgTag = updatedSvgTag.replace(
        SVG_TAG_START_RE,
        `<svg style="${sizeDeclarations}"`
      );
    }

    updatedSvgTag = updatedSvgTag.replace(
      SVG_TAG_START_RE,
      `<svg width="${width}" height="${height}"`
    );

    return svgString.replace(svgTag, updatedSvgTag);
  } catch {
    return svgString;
  }
};

/**
 * Convert SVG string to PNG blob for export
 */
export const svgToPngBlob = (
  svgString: string,
  options?: { scale?: number }
): Promise<Blob> => {
  const scale = options?.scale ?? 5;

  return new Promise((resolve, reject) => {
    // Ensure the SVG is valid XML before encoding it as a data URI. Mermaid
    // can emit xlink-prefixed attributes without declaring xmlns:xlink on the
    // root element, which makes the SVG invalid XML and prevents browsers from
    // loading it as an image (causing silent PNG export failures).
    const normalizedSvg = addXlinkNamespaceIfMissing(svgString);
    const encoded =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(normalizedSvg)));

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.width * scale;
      const h = img.height * scale;

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to create 2D canvas context for PNG export"));
        return;
      }

      // Do NOT draw a background → transparency preserved
      // ctx.clearRect(0, 0, w, h);

      ctx.drawImage(img, 0, 0, w, h);

      // Export PNG (lossless, keeps transparency)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create PNG blob"));
          return;
        }
        resolve(blob);
      }, "image/png");
    };

    img.onerror = () => reject(new Error("Failed to load SVG image"));
    img.src = encoded;
  });
};
