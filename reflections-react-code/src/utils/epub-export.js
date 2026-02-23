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
  creator: "ايمن علي محمد",
  publisher: "نشر مستقل عبر الإنترنت",
  subject: "تأملات روحية",
  rights: "© جميع الحقوق محفوظة",
  language: "ar",
  contactWhatsApp: "0019495221879",
  contactUrl: "https://wa.me/19495221879",
  website: "https://a-reflections.web.app",
  location: "مدينة الرحاب في القاهرة",
  disclaimer:
    "هذا الكتاب تأملي/تجريبي، ويعبّر عن تجربة شخصية، وليس مرجعًا طبيًا أو قانونيًا أو مهنيًا.",
  aiDisclosure:
    "تم إنشاء وتحرير أجزاء من هذا الكتاب باستخدام تقنيات الذكاء الاصطناعي. الفكرة أصلًا من الكاتب، بينما الصياغة اللغوية في معظمها مولَّدة بالذكاء الاصطناعي، كما أُنشئت الصور كذلك بالذكاء الاصطناعي.",
};

const DEFAULT_SECTION_MIDDLE_IMAGE_RATIO = 0.3;

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
  const match = fileName.match(/^(\d+(?:[-.]\d+)*)/);
  if (!match) {
    return null;
  }

  const segments = match[1]
    .split(/[-.]/)
    .map((segment) => Number.parseInt(segment, 10));

  if (segments.length === 0 || segments.some((segment) => Number.isNaN(segment))) {
    return null;
  }

  return {
    sectionMajor: segments[0],
    segments,
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

  const maxLength = Math.max(left.segments.length, right.segments.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftSegment = left.segments[index];
    const rightSegment = right.segments[index];

    if (leftSegment === undefined) {
      return -1;
    }
    if (rightSegment === undefined) {
      return 1;
    }
    if (leftSegment !== rightSegment) {
      return leftSegment - rightSegment;
    }
  }

  return 0;
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

  let fallbackSection = 0;

  return normalized.map((image) => {
    const prefix = image.numericPrefix;

    if (!prefix) {
      const sectionIndex = Math.min(fallbackSection, sectionsCount - 1);
      fallbackSection += 1;
      return { ...image, sectionIndex };
    }

    const safeTarget = Math.max(
      0,
      Math.min(prefix.sectionMajor - 1, sectionsCount - 1)
    );

    return {
      ...image,
      sectionIndex: safeTarget,
    };
  });
};

const buildSectionImageFigureHtml = (image) =>
  `<figure style="text-align:center;"><img src="../images/${image.fileName}" alt="${escapeXml(
    image.name
  )}" /><figcaption style="text-align:center;margin-top:0.35rem;font-size:0.85em;opacity:0.7;">${escapeXml(
    stripLeadingImageNumber(fileNameWithoutExtension(image.name)) ||
      fileNameWithoutExtension(image.name)
  )}</figcaption></figure>`;

const distributeImagesInSection = (
  images,
  middleRatio = DEFAULT_SECTION_MIDDLE_IMAGE_RATIO
) => {
  if (images.length <= 1) {
    return {
      middle: [],
      end: images,
    };
  }

  const normalizedRatio = clamp(middleRatio, 0, 1);
  const rawMiddleCount = Math.round(images.length * normalizedRatio);
  const middleCount = clamp(rawMiddleCount, 1, images.length - 1);

  return {
    middle: images.slice(0, middleCount),
    end: images.slice(middleCount),
  };
};

const injectHtmlAtMarkdownMidpoint = (markdownText, htmlBlock) => {
  if (!htmlBlock) {
    return markdownText;
  }

  const lines = markdownText.split("\n");
  const breakIndexes = [];

  for (let index = 1; index < lines.length - 1; index += 1) {
    if (
      lines[index].trim() === "" &&
      lines[index - 1].trim() !== "" &&
      lines[index + 1].trim() !== ""
    ) {
      breakIndexes.push(index);
    }
  }

  if (breakIndexes.length === 0) {
    return `${markdownText}\n\n${htmlBlock}`;
  }

  const targetBreakIndex = breakIndexes[Math.floor(breakIndexes.length / 2)];
  const before = lines.slice(0, targetBreakIndex + 1).join("\n");
  const after = lines.slice(targetBreakIndex + 1).join("\n");

  return `${before}\n${htmlBlock}\n\n${after}`;
};

const ensureXhtmlVoidTags = (html = "") => {
  const voidTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);

  return html.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/g, (match, tagName, attrs) => {
    const normalizedTagName = tagName.toLowerCase();
    if (!voidTags.has(normalizedTagName)) {
      return match;
    }

    const trimmedAttrs = attrs.trimEnd();
    if (trimmedAttrs.endsWith("/")) {
      return `<${tagName}${attrs}>`;
    }

    return `<${tagName}${attrs} />`;
  });
};

const buildXhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ar" xml:lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${escapeXml(title)}</title>
  </head>
  <body style="text-align:right;">
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

const stripLeadingImageNumber = (label = "") =>
  label.replace(/^\d+(?:[-.]\d+)*[\s._-]*/, "").trim();

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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const resolveSectionImageMiddleRatio = (
  explicitRatio = null,
  defaultRatio = DEFAULT_SECTION_MIDDLE_IMAGE_RATIO
) => {
  if (typeof explicitRatio === "number" && !Number.isNaN(explicitRatio)) {
    return clamp(explicitRatio, 0, 1);
  }

  const query = window.location.search;
  const match = query.match(/(?:\?|&)epubImageMiddleRatio=([^&]+)/i);

  if (!match) {
    return clamp(defaultRatio, 0, 1);
  }

  const parsed = Number.parseFloat(decodeURIComponent(match[1]));
  if (Number.isNaN(parsed)) {
    return clamp(defaultRatio, 0, 1);
  }

  const ratio = parsed > 1 ? parsed / 100 : parsed;
  return clamp(ratio, 0, 1);
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

const getFolderNameFromPath = (path = "") => {
  if (!path || path === "/") {
    return "reflections";
  }

  const segments = path.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "reflections";
  return decodeURIComponent(lastSegment);
};

const padNumber = (value) => String(value).padStart(2, "0");

const generateIsbnLikeIdentifier = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = padNumber(now.getMonth() + 1);
  const day = padNumber(now.getDate());
  const hour = padNumber(now.getHours());
  const minute = padNumber(now.getMinutes());
  const second = padNumber(now.getSeconds());
  const randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, "0");

  return `979-${year}-${month}${day}-${hour}${minute}${second}-${randomPart}`;
};

export const exportFolderToEpub = async ({
  path,
  images,
  sectionImageMiddleRatio,
}) => {
  const markdown = await fetchMarkdown(path);
  const sections = splitMarkdownSections(markdown);
  const firstHeaderTitle = extractFirstMarkdownHeader(markdown);
  const resolvedSectionImageMiddleRatio = resolveSectionImageMiddleRatio(
    sectionImageMiddleRatio
  );

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
      const mediaType = imageMimeTypeFromName(image.name) || blob.type;

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
      ? "تأملات"
      : decodeURIComponent(path.replaceAll("/", "").trim()) || "تأملات");
  const identifier = generateIsbnLikeIdentifier();
  const description = extractFirstMarkdownParagraph(markdown);
  const createdDate = new Date().toISOString().slice(0, 10);
  const modifiedDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const copyrightYear = new Date().getFullYear();
  const epubMetadata = {
    ...DEFAULT_EPUB_METADATA,
    rights: `© ${copyrightYear} ${DEFAULT_EPUB_METADATA.creator}. جميع الحقوق محفوظة.`,
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
    const sectionImages = imagesBySection.get(index) || [];
    const distributedImages = distributeImagesInSection(
      sectionImages,
      resolvedSectionImageMiddleRatio
    );
    const middleImagesHtml = distributedImages.middle
      .map((image) => buildSectionImageFigureHtml(image))
      .join("\n");
    const endImagesHtml = distributedImages.end
      .map((image) => buildSectionImageFigureHtml(image))
      .join("\n");
    const markdownWithMiddleImages = injectHtmlAtMarkdownMidpoint(
      section.markdown,
      middleImagesHtml
    );
    const sectionHtml = domPurify.sanitize(
      marked.parse(markdownWithMiddleImages, { xhtml: true })
    );
    const sectionXhtml = ensureXhtmlVoidTags(sectionHtml);

    const body = `    <section id="${chapterId}">\n      ${sectionXhtml}\n      ${endImagesHtml}\n    </section>`;

    return {
      id: chapterId,
      href: chapterHref,
      heading: section.heading,
      xhtml: buildXhtml(section.heading, body),
    };
  });

  const coverTopSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="زخرفة غلاف" style="max-width:220px;width:100%;height:auto;display:block;margin:0 auto 1rem auto;"><defs><linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2b6651"/><stop offset="100%" stop-color="#1b4d3e"/></linearGradient></defs><rect x="10" y="10" width="300" height="160" rx="20" fill="url(#coverGrad)" opacity="0.12"/><circle cx="160" cy="54" r="20" fill="#d8b464" opacity="0.85"/><path d="M72 120c22-16 44-16 66 0v26c-22-16-44-16-66 0z" fill="#1b4d3e" opacity="0.95"/><path d="M182 120c22-16 44-16 66 0v26c-22-16-44-16-66 0z" fill="#1b4d3e" opacity="0.95"/><path d="M138 120c7-4 14-6 22-6s15 2 22 6v26c-7-4-14-6-22-6s-15 2-22 6z" fill="#2b6651"/><path d="M72 120c22-16 44-16 66 0M182 120c22-16 44-16 66 0" fill="none" stroke="#d8b464" stroke-width="2" opacity="0.9"/></svg>`;

  const coverDoc = coverAsset
    ? {
        id: "cover-page",
        href: "text/cover-page.xhtml",
        heading: "الغلاف",
        xhtml: buildXhtml(
          "الغلاف",
          `    <section id="cover" style="text-align:center;max-width:780px;margin:0 auto;padding:1rem 0.2rem;">${coverTopSvg}<h1 style="margin:0 0 0.65rem 0;">${escapeXml(
            title
          )}</h1><p style="margin:0 0 1rem 0;font-size:0.95em;opacity:0.8;">رقم الكتاب: ${escapeXml(
            identifier
          )}</p><img src="../images/${coverAsset.fileName}" alt="${escapeXml(
            title
          )}" style="max-width:100%;height:auto;border-radius:10px;" /><div style="text-align:right;margin-top:1.2rem;line-height:1.85;"><p><strong>المؤلف:</strong> ${escapeXml(
            epubMetadata.creator
          )}</p><p><strong>الناشر:</strong> ${escapeXml(
            epubMetadata.publisher
          )}</p><p><strong>العنوان الكامل:</strong> ${escapeXml(
            title
          )}</p><p><strong>الموقع:</strong> ${escapeXml(
            epubMetadata.location
          )}</p><p><strong>وسيلة التواصل (واتساب):</strong> ${escapeXml(
            epubMetadata.contactWhatsApp
          )}</p><p><strong>رابط التواصل:</strong> <a href="${escapeXml(
            epubMetadata.contactUrl
          )}">${escapeXml(epubMetadata.contactUrl)}</a></p><p><strong>الموقع الإلكتروني:</strong> ${escapeXml(
            epubMetadata.website
          )}</p><p><strong>حقوق النشر:</strong> ${escapeXml(
            epubMetadata.rights
          )}</p><p><strong>تنويه الذكاء الاصطناعي:</strong> ${escapeXml(
            epubMetadata.aiDisclosure
          )}</p><p><strong>إخلاء المسؤولية:</strong> ${escapeXml(
            epubMetadata.disclaimer
          )}</p></div></section>`
        ),
      }
    : null;

  const infoDoc = {
    id: "book-info-page",
    href: "text/book-info-page.xhtml",
    heading: "معلومات الكتاب",
    xhtml: buildXhtml(
      "معلومات الكتاب",
      `    <section id="book-info"><h1>${escapeXml(
        title
      )}</h1><p><strong>رقم الكتاب:</strong> ${escapeXml(
        identifier
      )}</p><p><strong>المؤلف:</strong> ${escapeXml(
        epubMetadata.creator
      )}</p><p><strong>الناشر:</strong> ${escapeXml(
        epubMetadata.publisher
      )}</p><p><strong>العنوان الكامل:</strong> ${escapeXml(
        title
      )}</p><p><strong>الموقع:</strong> ${escapeXml(
        epubMetadata.location
      )}</p><p><strong>وسيلة التواصل (واتساب):</strong> ${escapeXml(
        epubMetadata.contactWhatsApp
      )}</p><p><strong>رابط التواصل:</strong> <a href="${escapeXml(
        epubMetadata.contactUrl
      )}">${escapeXml(epubMetadata.contactUrl)}</a></p><p><strong>الموقع الإلكتروني:</strong> ${escapeXml(
        epubMetadata.website
      )}</p><p><strong>حقوق النشر:</strong> ${escapeXml(
        epubMetadata.rights
      )}</p><p><strong>تنويه الذكاء الاصطناعي:</strong> ${escapeXml(
        epubMetadata.aiDisclosure
      )}</p><p><strong>إخلاء المسؤولية:</strong> ${escapeXml(
        epubMetadata.disclaimer
      )}</p><p><strong>تاريخ الإنشاء:</strong> ${escapeXml(createdDate)}</p></section>`
    ),
  };

  const backCoverDoc = backCoverAsset
    ? {
        id: "back-cover-page",
        href: "text/back-cover-page.xhtml",
        heading: "الغلاف الخلفي",
        xhtml: buildXhtml(
          "الغلاف الخلفي",
          `    <section id="back-cover" style="text-align:center;"><img src="../images/${backCoverAsset.fileName}" alt="الغلاف الخلفي" style="max-width:100%;height:auto;" /></section>`
        ),
      }
    : null;

  const spineDocs = [
    ...(coverDoc ? [coverDoc] : []),
    infoDoc,
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
  const navXhtml = buildXhtml(`${title} - الفهرس`, navBody);
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${escapeXml(
    epubMetadata.language
  )}">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <navMap>
    ${spineDocs
      .map(
        (chapter, index) => `
    <navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(chapter.heading)}</text></navLabel>
      <content src="${chapter.href}"/>
    </navPoint>`
      )
      .join("")}
  </navMap>
</ncx>`;

  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    ...spineDocs.map(
      (chapter) => {
        const chapterProperties = chapter.id === "cover-page" ? ' properties="svg"' : "";
        return `<item id="${chapter.id}" href="${chapter.href}" media-type="application/xhtml+xml"${chapterProperties}/>`;
      }
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
  oebpsFolder?.file("toc.ncx", tocNcx);

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

  const fileNameBase = getFolderNameFromPath(path);
  const exportedAt = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  saveAs(epubBlob, `${slugify(fileNameBase)}-${exportedAt}.epub`);
};
