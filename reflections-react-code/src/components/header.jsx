import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GitHubIcon from "@mui/icons-material/GitHub";
import HomeIcon from "@mui/icons-material/Home";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TranslateIcon from "@mui/icons-material/Translate";
import {
  Alert,
  AppBar,
  CircularProgress,
  IconButton,
  Snackbar,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { exportFolderToEpub } from "../utils/epub-export";

const Header = ({
  handleCopy,
  copied,
  images,
  handleClickOpen,
  copyIndex,
  textChunks,
  loading,
  ...props
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const path = window.location.pathname;
  const [exportingEpub, setExportingEpub] = useState(false);
  const [epubToast, setEpubToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleTranslate = () => {
    const url = `https://a--reflections-web-app.translate.goog${
      path === "/" ? "" : path
    }?_x_tr_sl=ar&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp`;
    window.open(url, "_blank");
  };

  const handleExportEpub = async () => {
    try {
      setExportingEpub(true);
      await exportFolderToEpub({ path, images });
      setEpubToast({
        open: true,
        message: "EPUB exported successfully",
        severity: "success",
      });
    } catch (error) {
      console.error("EPUB export failed", error);
      setEpubToast({
        open: true,
        message: "Failed to export EPUB. Please try again.",
        severity: "error",
      });
    } finally {
      setExportingEpub(false);
    }
  };

  const handleCloseEpubToast = (_, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setEpubToast((current) => ({ ...current, open: false }));
  };

  return (
    <>
      <AppBar
        position="sticky"
        sx={{ backgroundColor: "#1B4D3E", color: "#A4B494" }}
        {...props}
      >
        <Toolbar sx={{ justifyContent: isMobile ? "center" : "space-between" }}>
          {isMobile ? (
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <IconButton
                color="inherit"
                href={`https://github.com/alialiayman/reflections${
                  path === "/" ? "" : "/tree/main" + path
                }`}
                target="_blank"
                aria-label="GitHub"
              >
                <Tooltip title="GitHub">
                  <GitHubIcon />
                </Tooltip>
              </IconButton>
              <IconButton
                color="inherit"
                onClick={handleCopy}
                aria-label="Copy to Clipboard"
              >
                <Tooltip title="Copy All">
                  {!copied ? (
                    <ContentCopyIcon />
                  ) : (
                    <Typography variant="body">{`Copied ${copyIndex}/${textChunks.length}`}</Typography>
                  )}
                </Tooltip>
              </IconButton>

              <IconButton
                color="inherit"
                aria-label="Translate"
                onClick={handleTranslate}
              >
                <Tooltip title="Translate to English">
                  <TranslateIcon />
                </Tooltip>
              </IconButton>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  maxWidth: "20vw",
                }}
              >
                <IconButton color="inherit" href="/" aria-label="home">
                  <Tooltip title="Home">
                    <HomeIcon />
                  </Tooltip>
                </IconButton>
                <IconButton
                  color="inherit"
                  href={`https://github.com/alialiayman/reflections${
                    path === "/" ? "" : "/tree/main" + path
                  }`}
                  target="_blank"
                  aria-label="GitHub"
                >
                  <Tooltip title="GitHub">
                    <GitHubIcon />
                  </Tooltip>
                </IconButton>
                {!loading && <IconButton
                  color="inherit"
                  onClick={handleCopy}
                  aria-label="Copy to Clipboard"
                >
                  <Tooltip title="Copy All">
                    {!copied ? (
                      <ContentCopyIcon />
                    ) : (
                      <Typography variant="body">{`Copied ${copyIndex}/${textChunks.length}`}</Typography>
                    )}
                  </Tooltip>
                </IconButton>}
                <IconButton
                  color="inherit"
                  aria-label="Translate"
                  onClick={handleTranslate}
                >
                  <Tooltip title="Translate to English">
                    <TranslateIcon />
                  </Tooltip>
                </IconButton>
                <IconButton
                  color="inherit"
                  aria-label="Export EPUB"
                  onClick={handleExportEpub}
                  disabled={exportingEpub || loading || !images.length}
                >
                  <Tooltip title="Export EPUB">
                    {exportingEpub ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <MenuBookIcon />
                    )}
                  </Tooltip>
                </IconButton>
              </div>

              <div
                style={{
                  maxWidth: "75vw",
                  padding: "0 16px",
                  marginRight: "4rem",
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-start",
                  overflowX: "scroll",
                }}
              >
                {images.map((image, index) => (
                  <img
                    key={index}
                    src={image.url}
                    alt={`illustration ${index}`}
                    style={{
                      width: "40px",
                      height: "40px",
                      cursor: "pointer",
                      borderRadius: "5px",
                    }}
                    onClick={() => handleClickOpen(image.url)}
                  />
                ))}
              </div>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Snackbar
        open={epubToast.open}
        autoHideDuration={3000}
        onClose={handleCloseEpubToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseEpubToast}
          severity={epubToast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {epubToast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Header;
