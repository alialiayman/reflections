import { Typography } from "@mui/material";
import DisplayReadme from "./display-readme";
import EpubPreview from "./epub-preview";

export default function Main({ previewMode, images }) {
  const path = window.location.pathname;
  return (
    <div id="readme">
      {previewMode ? <EpubPreview path={path} images={images} /> : <DisplayReadme path={path} />}
      <Typography
        variant="caption"
        color="textSecondary"
        align="center"
        sx={{
          width: "100%",
          display: "block",
        }}
      >
        {`https://a-reflections.web.app${
          path === "/" ? "" : path
        }`}
      </Typography>
    </div>
  );
}
