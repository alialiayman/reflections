import { Typography } from "@mui/material";
import DisplayReadme from "./display-readme";

export default function Main() {
  const path = window.location.pathname;
  return (
    <div id="readme">
      <DisplayReadme path={path} />
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
