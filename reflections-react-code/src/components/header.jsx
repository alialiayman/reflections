import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import GitHubIcon from "@mui/icons-material/GitHub";
import HomeIcon from "@mui/icons-material/Home";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import StopIcon from "@mui/icons-material/Stop";
import TranslateIcon from "@mui/icons-material/Translate";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Alert,
  Avatar,
  AppBar,
  Box,
  CircularProgress,
  Chip,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { OPENAI_TTS_VOICES } from "../constants/tts";
import { useTts } from "../context/TtsContext";
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
  isGithubSignedIn,
  canEditReflections,
  authLoading,
  authChecking,
  onSignInGithub,
  onSignOutGithub,
  onDownloadReadmeMarkdown,
  ...props
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const path = window.location.pathname;
  const {
    voice,
    setVoice,
    toggleGlobalSpeak,
    isSpeaking,
    isGlobalArticle,
    isPreparingAudio,
    preparingSectionIndex,
    preparingEtaSeconds,
    ttsEnabled,
  } = useTts();
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
            <Tooltip title="Open GitHub repository">
              <IconButton
                color="inherit"
                href={`https://github.com/alialiayman/reflections${
                  path === "/" ? "" : "/tree/main" + path
                }`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open GitHub repository"
                sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
              >
                <GitHubIcon />
              </IconButton>
            </Tooltip>
            {!loading && (
              <Tooltip
                title={
                  copied
                    ? `Copied ${copyIndex}/${textChunks.length}`
                    : "Copy all text (chunked)"
                }
              >
                <span>
                  <IconButton
                    color="inherit"
                    onClick={handleCopy}
                    aria-label="Copy to clipboard"
                    sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Translate to English (Google Translate)">
              <IconButton
                color="inherit"
                onClick={handleTranslate}
                aria-label="Translate to English"
                sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
              >
                <TranslateIcon />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={
                previewMode
                  ? "Switch to README view to download"
                  : "Download full README as Markdown"
              }
            >
              <span>
                <IconButton
                  color="inherit"
                  onClick={onDownloadReadmeMarkdown}
                  disabled={loading || previewMode || typeof onDownloadReadmeMarkdown !== "function"}
                  aria-label="Download README markdown"
                  sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
                >
                  <FileDownloadIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={previewMode ? "Show README" : "EPUB-like preview"}>
              <IconButton
                color="inherit"
                onClick={onTogglePreview}
                aria-label={previewMode ? "Show README" : "EPUB preview"}
                sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
              >
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export EPUB">
              <span>
                <IconButton
                  color="inherit"
                  onClick={handleExportEpub}
                  disabled={exportingEpub || loading || !images.length}
                  aria-label="Export EPUB"
                  sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
                >
                  {exportingEpub ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    <MenuBookIcon />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            {ttsEnabled && !previewMode && (
              <>
                <FormControl
                  size="small"
                  sx={{
                    minWidth: { xs: 86, sm: 100 },
                    maxWidth: 120,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(164, 180, 148, 0.45)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(164, 180, 148, 0.75)",
                    },
                    "& .MuiSvgIcon-root": { color: "#d6dfcc" },
                  }}
                >
                  <Select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    displayEmpty
                    inputProps={{ "aria-label": "OpenAI TTS voice" }}
                    sx={{
                      color: "#e8f0e8",
                      fontSize: "0.75rem",
                      height: 36,
                      "& .MuiSelect-select": {
                        py: 0.65,
                        display: "flex",
                        alignItems: "center",
                      },
                    }}
                  >
                    {OPENAI_TTS_VOICES.map((v) => (
                      <MenuItem key={v.id} value={v.id} dense>
                        {v.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip
                  title={
                    isSpeaking && isGlobalArticle
                      ? "Stop reading the article"
                      : "Read entire article (section by section)"
                  }
                >
                  <IconButton
                    color="inherit"
                    onClick={toggleGlobalSpeak}
                    aria-label={
                      isSpeaking && isGlobalArticle
                        ? "Stop speech"
                        : "Read full article aloud"
                    }
                    sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
                  >
                    {isSpeaking && isGlobalArticle ? (
                      <StopIcon />
                    ) : (
                      <RecordVoiceOverIcon />
                    )}
                  </IconButton>
                </Tooltip>
                {isPreparingAudio && preparingSectionIndex != null && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 0.25 }}>
                    <CircularProgress size={14} color="inherit" />
                    <Typography variant="caption" sx={{ opacity: 0.95, whiteSpace: "nowrap" }}>
                      {`Loading audio… speaking in ~${Math.max(preparingEtaSeconds, 1)}s`}
                    </Typography>
                  </Box>
                )}
              </>
            )}
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
            {!isGithubSignedIn ? (
              <Tooltip
                title={
                  !oauthConfigured
                    ? "GitHub login not configured"
                    : authLoading
                      ? "Signing in…"
                      : "Login with GitHub"
                }
              >
                <span>
                  <IconButton
                    color="inherit"
                    onClick={onSignInGithub}
                    disabled={authLoading || authChecking || !oauthConfigured}
                    aria-label="Login with GitHub"
                    sx={{
                      bgcolor: "rgba(0, 0, 0, 0.15)",
                      "&:hover": { bgcolor: "rgba(0, 0, 0, 0.25)" },
                    }}
                  >
                    {authLoading ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      <LoginIcon />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip
                title={
                  canEditReflections
                    ? "Sign out"
                    : "Sign out (signed in; editing and AI are limited to authorized accounts)"
                }
              >
                <span>
                  <IconButton
                    color="inherit"
                    onClick={onSignOutGithub}
                    disabled={authLoading || authChecking}
                    aria-label="Sign out"
                    sx={{ border: "1px solid rgba(164, 180, 148, 0.45)" }}
                  >
                    <LogoutIcon />
                  </IconButton>
                </span>
              </Tooltip>
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
