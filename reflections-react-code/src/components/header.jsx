import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GitHubIcon from "@mui/icons-material/GitHub";
import HomeIcon from "@mui/icons-material/Home";
import TranslateIcon from "@mui/icons-material/Translate";
import DownloadIcon from "@mui/icons-material/Download";
import {
  AppBar,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

const Header = ({
  handleCopy,
  handleDownloadPdf,
  copied,
  images,
  handleClickOpen,
  copyIndex,
  textChunks,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const path = window.location.pathname;

  const handleTranslate = () => {
    const url = `https://a--reflections-web-app.translate.goog${
      path === "/" ? "" : path
    }?_x_tr_sl=ar&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp`;
    window.open(url, "_blank");
  };

  return (
    <AppBar
      position="sticky"
      sx={{ backgroundColor: "#1B4D3E", color: "#A4B494" }}
    >
      <Toolbar sx={{ justifyContent: isMobile ? "center" : "space-between" }}>
        {isMobile ? (
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
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
              onClick={handleDownloadPdf}
              aria-label="Download PDF"
            >
              <Tooltip title="Download as PDF">
                <DownloadIcon />
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
              <IconButton
                color="inherit"
                onClick={handleDownloadPdf}
                aria-label="Download PDF"
              >
                <Tooltip title="Download as PDF">
                  <DownloadIcon />
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
                  src={image}
                  alt={`illustration ${index}`}
                  style={{
                    width: "40px",
                    height: "40px",
                    cursor: "pointer",
                    borderRadius: "5px",
                  }}
                  onClick={() => handleClickOpen(image)}
                />
              ))}
            </div>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
