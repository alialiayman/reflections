import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GitHubIcon from "@mui/icons-material/GitHub";
import HomeIcon from "@mui/icons-material/Home";
import TranslateIcon from "@mui/icons-material/Translate";
import {
  AppBar,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

const Header = ({ handleCopy, copied, images, handleClickOpen }) => {
  const path = window.location.pathname;
  const handleTranslate = () => {
    const url = `https://a--reflections-web-app.translate.goog${path === "/" ? "" : path}?_x_tr_sl=ar&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp`;
    window.open(url, "_blank");
  };

  return (
    <AppBar
      position="sticky"
      sx={{ backgroundColor: "#1B4D3E", color: "#A4B494" }}
    >
      <Toolbar className="flex justify-between">
        <div className="flex items-center gap-4">
          <IconButton color="inherit" href="/" aria-label="home">
            <Tooltip title="Home">
              <HomeIcon />
            </Tooltip>
          </IconButton>
          <IconButton
            color="inherit"
            href="https://github.com/alialiayman/reflections"
            target="_blank"
            aria-label="GitHub"
          >
            <Tooltip title="GitHub">
              <GitHubIcon />
            </Tooltip>
          </IconButton>
        </div>
        <div className="flex items-center gap-4">
          <IconButton
            color="inherit"
            onClick={handleCopy}
            aria-label="Copy to Clipboard"
          >
            <Tooltip title="Copy All">
              {!copied ? (
                <ContentCopyIcon />
              ) : (
                <Typography variant="body">Copied</Typography>
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
            display: "flex",
            gap: "8px",
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "nowrap",
            flexGrow: 1,
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
      </Toolbar>
    </AppBar>
  );
};

export default Header;
