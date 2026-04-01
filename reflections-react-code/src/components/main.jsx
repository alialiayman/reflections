import { Typography } from "@mui/material";
import DisplayReadme from "./display-readme";
import EpubPreview from "./epub-preview";

const safelyDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getNormalizedPathSegments = (pathname) =>
  pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => safelyDecodeURIComponent(segment).trim())
    .filter(Boolean);

export default function Main({ previewMode, images, githubToken, hasRepoWriteAccess }) {
  const path = window.location.pathname;
  const pathSegments = getNormalizedPathSegments(path);
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  const canonicalPath = encodedPath ? `/${encodedPath}` : "/";
  const displayPath = pathSegments.join("/");
  const footerHref = `https://a-reflections.web.app${canonicalPath === "/" ? "" : canonicalPath}`;
  const footerLabel = `https://a-reflections.web.app${displayPath ? `/${displayPath}` : ""}`;

  return (
    <div id="readme">
      {previewMode ? (
        <EpubPreview path={canonicalPath} images={images} />
      ) : (
        <DisplayReadme
          path={canonicalPath}
          githubToken={githubToken}
          hasRepoWriteAccess={hasRepoWriteAccess}
        />
      )}
      <Typography
        variant="caption"
        color="textSecondary"
        align="center"
        sx={{
          width: "100%",
          display: "block",
        }}
      >
        <a href={footerHref}>{footerLabel}</a>
      </Typography>
    </div>
  );
}
