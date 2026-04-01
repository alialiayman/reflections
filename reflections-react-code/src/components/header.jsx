import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GitHubIcon from "@mui/icons-material/GitHub";
import HomeIcon from "@mui/icons-material/Home";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TranslateIcon from "@mui/icons-material/Translate";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Alert,
  Avatar,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Chip,
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
  previewMode,
  onTogglePreview,
  githubLogin,
  oauthConfigured,
  canEditSections,
  authLoading,
  authChecking,
  onSignInGithub,
  onSignOutGithub,
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
        sx={{
          backgroundColor: "#1B4D3E",
          color: "#A4B494",
          top: 0,
          zIndex: (muiTheme) => muiTheme.zIndex.drawer + 2,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
        }}
        {...props}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 1, sm: 2 },
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            pt: "max(env(safe-area-inset-top), 0px)",
            pb: { xs: 1, sm: 1.25 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Home">
              <IconButton color="inherit" href="/" aria-label="home">
                <HomeIcon />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ fontWeight: 600, opacity: 0.9 }}>
              Reflections
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              overflowX: "auto",
              maxWidth: { xs: "100%", md: "none" },
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
            }}
          >
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<GitHubIcon />}
              href={`https://github.com/alialiayman/reflections${
                path === "/" ? "" : "/tree/main" + path
              }`}
              target="_blank"
              sx={{ borderColor: "rgba(164, 180, 148, 0.45)", whiteSpace: "nowrap" }}
            >
              Repo
            </Button>
            {!loading && (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopy}
                sx={{ borderColor: "rgba(164, 180, 148, 0.45)", whiteSpace: "nowrap" }}
              >
                {copied ? `Copied ${copyIndex}/${textChunks.length}` : "Copy"}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<TranslateIcon />}
              onClick={handleTranslate}
              sx={{ borderColor: "rgba(164, 180, 148, 0.45)", whiteSpace: "nowrap" }}
            >
              Translate
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<VisibilityIcon />}
              onClick={onTogglePreview}
              sx={{ borderColor: "rgba(164, 180, 148, 0.45)", whiteSpace: "nowrap" }}
            >
              {previewMode ? "README" : "Preview"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={
                exportingEpub ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <MenuBookIcon />
                )
              }
              onClick={handleExportEpub}
              disabled={exportingEpub || loading || !images.length}
              sx={{ borderColor: "rgba(164, 180, 148, 0.45)", whiteSpace: "nowrap" }}
            >
              EPUB
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {githubLogin && (
              <Chip
                avatar={<Avatar sx={{ bgcolor: "#264e3c" }}>{githubLogin[0]?.toUpperCase()}</Avatar>}
                label={`@${githubLogin}`}
                size="small"
                sx={{ color: "#d6dfcc", border: "1px solid rgba(164, 180, 148, 0.35)" }}
              />
            )}
            {authChecking && <Typography variant="caption">Checking access...</Typography>}
            {!canEditSections ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<LoginIcon />}
                onClick={onSignInGithub}
                disabled={authLoading || authChecking || !oauthConfigured}
                sx={{ textTransform: "none", whiteSpace: "nowrap" }}
              >
                {authLoading ? "Signing In..." : "Login with GitHub"}
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={onSignOutGithub}
                disabled={authLoading || authChecking}
                sx={{ borderColor: "rgba(164, 180, 148, 0.45)", whiteSpace: "nowrap" }}
              >
                Sign Out
              </Button>
            )}
          </Box>
        </Toolbar>

        {!isMobile && (
          <Box
            sx={{
              px: 2,
              pb: 1,
              display: "flex",
              gap: 1,
              justifyContent: "flex-start",
              overflowX: "auto",
              alignItems: "center",
            }}
          >
            <Typography variant="caption" sx={{ mr: 0.5, opacity: 0.82 }}>
              Images in this folder
            </Typography>
            {images.map((image, index) => (
              <img
                key={index}
                src={image.url}
                alt={`illustration ${index}`}
                className="header-thumbnail"
                style={{
                  width: "40px",
                  height: "40px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  border: "1.5px solid rgba(164, 180, 148, 0.4)",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                  transition: "all 0.3s ease",
                }}
                onClick={() => handleClickOpen(image.url, image.name)}
              />
            ))}
          </Box>
        )}
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
