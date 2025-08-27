import { Typography } from "@mui/material";
import DisplayReadme from "./display-readme";

export default function Main() {
  const path = window.location.pathname;
  return (
    <div id="readme">
      <div id="print-header" style={{ display: "none" }}>
        <DisplayReadme path={path} filename="print-header.md" />
      </div>
      <DisplayReadme path={path} />
      <div id="print-footer" style={{ display: "none" }}>
        <DisplayReadme path={path}  />
      </div>

      <Typography
        variant="caption"
        color="textSecondary"
        align="center"
        sx={{
          width: "100%",
          display: "block",
        }}
      >
        {`https://github.com/alialiayman/reflections${
          path === "/" ? "" : path
        }`}
      </Typography>
    </div>
  );
}
