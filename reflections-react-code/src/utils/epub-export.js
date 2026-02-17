import createDOMPurify from "dompurify";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { marked } from "marked";
import { GITHUB } from "../constants";

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const DEFAULT_EPUB_METADATA = {
  creator: "Reflections",
  publisher: "Reflections",
  subject: "Spiritual reflections",
  rights: "All rights reserved",
  language: "ar",
};

const escapeXml = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const slugify = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "reflections";

const getNumericPrefix = (fileName = "") => {
  const match = fileName.match(/^(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const [majorRaw, minorRaw] = match[1].split(".");
  const major = Number.parseInt(majorRaw, 10);
  const minor = minorRaw ? Number.parseInt(minorRaw, 10) : null;

  if (Number.isNaN(major)) {
    return null;
  }

  return {
    major,
    minor: Number.isNaN(minor) ? null : minor,
    raw: match[1],
  };
};

const compareNumericPrefix = (left, right) => {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }

  if (left.major !== right.major) {
    return left.major - right.major;
  }

  const leftMinor = left.minor === null ? -1 : left.minor;
  const rightMinor = right.minor === null ? -1 : right.minor;
  return leftMinor - rightMinor;
};

const splitMarkdownSections = (markdownText) => {
  const lines = markdownText.split("\n");
  const sections = [];
  let currentHeading = "";
  let currentLines = [];

  const pushSection = () => {
    if (currentLines.length === 0) {
      return;
    }

    sections.push({
      heading: currentHeading || "Introduction",
      markdown: currentLines.join("\n").trim(),
    });
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      pushSection();
      currentHeading = headingMatch[2].trim() || "Untitled";
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  });

  pushSection();

  if (sections.length === 0) {
    return [
      {
        heading: "Introduction",
        markdown: markdownText,
      },
    ];
  }

  return sections;
};

const mapImagesToSections = (images, sectionsCount) => {
  if (sectionsCount === 0) {
    return [];
  }

  const normalized = images
    .map((image) => ({
      ...image,
      numericPrefix: getNumericPrefix(image.name),
    }))
    .sort((left, right) => {
      const numericOrder = compareNumericPrefix(
        left.numericPrefix,
        right.numericPrefix
      );
      if (numericOrder !== 0) {
        return numericOrder;
      }
      return left.name.localeCompare(right.name);
    });

  const majorBaseIndex = new Map();
  const majorLastIndex = new Map();
  let fallbackSection = 0;

  return normalized.map((image) => {
    const prefix = image.numericPrefix;

    if (!prefix) {
      const sectionIndex = Math.min(fallbackSection, sectionsCount - 1);
      fallbackSection += 1;
      return { ...image, sectionIndex };
    }

    const { major, minor } = prefix;

    const getOrCreateBase = () => {
      if (majorBaseIndex.has(major)) {
        return majorBaseIndex.get(major);
      }

      let computedBase;
      if (major === 1) {
        computedBase = 0;
      } else if (majorLastIndex.has(major - 1)) {
        computedBase = majorLastIndex.get(major - 1) + 1;
      } else {
        computedBase = major - 1;
      }

      const safeBase = Math.max(0, Math.min(computedBase, sectionsCount - 1));
      majorBaseIndex.set(major, safeBase);
      return safeBase;
    };

    const baseIndex = getOrCreateBase();
    const target = minor === null ? baseIndex : baseIndex + minor;
    const safeTarget = Math.max(0, Math.min(target, sectionsCount - 1));

    const currentLast = majorLastIndex.get(major) ?? -1;
    if (safeTarget > currentLast) {
      majorLastIndex.set(major, safeTarget);
    }

    return {
      ...image,
      sectionIndex: safeTarget,
    };
  });
};

const buildXhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="ar" xml:lang="ar">
  <head>
    <meta charset="utf-8" />
    <title>${escapeXml(title)}</title>
  </head>
  <body>
${body}
  </body>
</html>`;

const fileExtension = (fileName = "") => {
  const extension = fileName.split(".").pop();
  return extension ? extension.toLowerCase() : "jpg";
};

const fileNameWithoutExtension = (fileName = "") =>
  fileName.replace(/\.[^/.]+$/, "");

const normalizeImageLabel = (fileName = "") =>
  fileNameWithoutExtension(fileName)
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractFirstMarkdownHeader = (markdownText = "") => {
  const lines = markdownText.split("\n");
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch && headingMatch[1].trim()) {
      return headingMatch[1].trim();
    }
  }

  return null;
};

const extractFirstMarkdownParagraph = (markdownText = "") => {
  const lines = markdownText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const paragraphLines = [];
  for (const line of lines) {
    if (line.startsWith("#")) {
      continue;
    }

    if (/^[-*]|^\d+[.)]/.test(line)) {
      if (paragraphLines.length > 0) {
        break;
      }
      continue;
    }

    paragraphLines.push(line);
    if (paragraphLines.length >= 3) {
      break;
    }
  }

  return paragraphLines.join(" ").trim() || "";
};

const imageMimeTypeFromName = (fileName = "") => {
  const extension = fileExtension(fileName);
  const extensionToMime = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };

  return extensionToMime[extension] || "image/jpeg";
};

const fetchMarkdown = async (path) => {
  const normalizedPath = path === "/" ? "" : path;
  const readmeUrl = `${GITHUB}${normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`}README.md`;
  const response = await fetch(readmeUrl);

  if (!response.ok) {
    throw new Error("Unable to fetch markdown for EPUB export");
  }

  return response.text();
};

const fetchImageBlob = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch image: ${url}`);
  }
  return response.blob();
};

export const exportFolderToEpub = async ({ path, images }) => {
  const markdown = await fetchMarkdown(path);
  const sections = splitMarkdownSections(markdown);
  const firstHeaderTitle = extractFirstMarkdownHeader(markdown);

  const coverImage = images.find(
    (image) => normalizeImageLabel(image.name) === "cover"
  );
  const backCoverImage = images.find(
    (image) => normalizeImageLabel(image.name) === "back cover"
  );

  const contentImages = images.filter(
    (image) => image !== coverImage && image !== backCoverImage
  );

  const mappedImages = mapImagesToSections(contentImages, sections.length);
  const domPurify = createDOMPurify(window);

  const enrichedImages = await Promise.all(
    mappedImages.map(async (image, index) => {
      const blob = await fetchImageBlob(image.url);
      const extension = fileExtension(image.name);
      const id = `image-${index + 1}`;
      const fileName = `${id}.${extension}`;
      const mediaType = blob.type || imageMimeTypeFromName(image.name);

      return {
        ...image,
        id,
        fileName,
        mediaType,
        blob,
      };
    })
  );

  const imagesBySection = new Map();
  enrichedImages.forEach((image) => {
    const current = imagesBySection.get(image.sectionIndex) || [];
    imagesBySection.set(image.sectionIndex, [...current, image]);
  });

  const title =
    firstHeaderTitle ||
    (path === "/"
      ? "Reflections"
      : decodeURIComponent(path.replaceAll("/", "").trim()) || "Reflections");
  const identifier = `reflections-${Date.now()}`;
  const description = extractFirstMarkdownParagraph(markdown);
  const createdDate = new Date().toISOString().slice(0, 10);
  const modifiedDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const epubMetadata = {
    ...DEFAULT_EPUB_METADATA,
    description,
  };

  const coverAsset = coverImage
    ? (() => {
        const extension = fileExtension(coverImage.name);
        return {
          ...coverImage,
          id: "cover-image",
          fileName: `cover.${extension}`,
          mediaType: imageMimeTypeFromName(coverImage.name),
        };
      })()
    : null;

  const backCoverAsset = backCoverImage
    ? (() => {
        const extension = fileExtension(backCoverImage.name);
        return {
          ...backCoverImage,
          id: "back-cover-image",
          fileName: `back-cover.${extension}`,
          mediaType: imageMimeTypeFromName(backCoverImage.name),
        };
      })()
    : null;

  const [coverBlob, backCoverBlob] = await Promise.all([
    coverAsset ? fetchImageBlob(coverAsset.url) : Promise.resolve(null),
    backCoverAsset ? fetchImageBlob(backCoverAsset.url) : Promise.resolve(null),
  ]);

  const chapterDocs = sections.map((section, index) => {
    const chapterId = `chapter-${index + 1}`;
    const chapterHref = `text/${chapterId}.xhtml`;
    const sectionHtml = domPurify.sanitize(marked.parse(section.markdown));
    const sectionImages = imagesBySection.get(index) || [];

    const imagesHtml = sectionImages
      .map(
        (image) =>
          `<figure style="text-align:center;"><img src="../images/${image.fileName}" alt="${escapeXml(
            image.name
          )}" /><figcaption style="text-align:center;margin-top:0.35rem;font-size:0.85em;opacity:0.7;">${escapeXml(
            fileNameWithoutExtension(image.name)
          )}</figcaption></figure>`
      )
      .join("\n");

    const body = `    <section id="${chapterId}">\n      ${sectionHtml}\n      ${imagesHtml}\n    </section>`;

    return {
      id: chapterId,
      href: chapterHref,
      heading: section.heading,
      xhtml: buildXhtml(section.heading, body),
    };
  });

  const coverDoc = coverAsset
    ? {
        id: "cover-page",
        href: "text/cover-page.xhtml",
        heading: "Cover",
        xhtml: buildXhtml(
          "Cover",
          `    <section id="cover" style="text-align:center;"><img src="../images/${coverAsset.fileName}" alt="${escapeXml(
            title
          )}" style="max-width:100%;height:auto;" /></section>`
        ),
      }
    : null;

  const backCoverDoc = backCoverAsset
    ? {
        id: "back-cover-page",
        href: "text/back-cover-page.xhtml",
        heading: "Back Cover",
        xhtml: buildXhtml(
          "Back Cover",
          `    <section id="back-cover" style="text-align:center;"><img src="../images/${backCoverAsset.fileName}" alt="Back Cover" style="max-width:100%;height:auto;" /></section>`
        ),
      }
    : null;

  const spineDocs = [
    ...(coverDoc ? [coverDoc] : []),
    ...chapterDocs,
    ...(backCoverDoc ? [backCoverDoc] : []),
  ];

  const navBody = `    <nav epub:type="toc" id="toc">\n      <h1>${escapeXml(
    title
  )}</h1>\n      <ol>\n${spineDocs
    .map(
      (chapter) =>
        `        <li><a href="${chapter.href}">${escapeXml(chapter.heading)}</a></li>`
    )
    .join("\n")}\n      </ol>\n    </nav>`;
  const navXhtml = buildXhtml(`${title} - TOC`, navBody);

  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    ...spineDocs.map(
      (chapter) =>
        `<item id="${chapter.id}" href="${chapter.href}" media-type="application/xhtml+xml"/>`
    ),
    ...(coverAsset
      ? [
          `<item id="${coverAsset.id}" href="images/${coverAsset.fileName}" media-type="${coverAsset.mediaType}" properties="cover-image"/>`,
        ]
      : []),
    ...(backCoverAsset
      ? [
          `<item id="${backCoverAsset.id}" href="images/${backCoverAsset.fileName}" media-type="${backCoverAsset.mediaType}"/>`,
        ]
      : []),
    ...enrichedImages.map(
      (image) =>
        `<item id="${image.id}" href="images/${image.fileName}" media-type="${image.mediaType}"/>`
    ),
  ].join("\n    ");

  const spineItems = spineDocs
    .map((chapter) => `<itemref idref="${chapter.id}"/>`)
    .join("\n    ");

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0" xml:lang="${escapeXml(
    epubMetadata.language
  )}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${escapeXml(epubMetadata.language)}</dc:language>
    <dc:creator>${escapeXml(epubMetadata.creator)}</dc:creator>
    <dc:publisher>${escapeXml(epubMetadata.publisher)}</dc:publisher>
    <dc:subject>${escapeXml(epubMetadata.subject)}</dc:subject>
    <dc:rights>${escapeXml(epubMetadata.rights)}</dc:rights>
    <dc:description>${escapeXml(epubMetadata.description || title)}</dc:description>
    <dc:date>${escapeXml(createdDate)}</dc:date>
    ${coverAsset ? '<meta name="cover" content="cover-image"/>' : ""}
    <meta property="dcterms:modified">${modifiedDate}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`;

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF")?.file("container.xml", CONTAINER_XML);

  const oebpsFolder = zip.folder("OEBPS");
  oebpsFolder?.file("content.opf", contentOpf);
  oebpsFolder?.file("nav.xhtml", navXhtml);

  const textFolder = oebpsFolder?.folder("text");
  spineDocs.forEach((chapter) => {
    textFolder?.file(`${chapter.id}.xhtml`, chapter.xhtml);
  });

  const imagesFolder = oebpsFolder?.folder("images");
  if (coverAsset && coverBlob) {
    imagesFolder?.file(coverAsset.fileName, coverBlob);
  }
  if (backCoverAsset && backCoverBlob) {
    imagesFolder?.file(backCoverAsset.fileName, backCoverBlob);
  }
  enrichedImages.forEach((image) => {
    imagesFolder?.file(image.fileName, image.blob);
  });

  const epubBlob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });

  saveAs(epubBlob, `${slugify(title)}.epub`);
};
