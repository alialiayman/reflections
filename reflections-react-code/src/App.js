import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import SendIcon from "@mui/icons-material/Send";
import axios from "axios";
import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/header";
import Main from "./components/main";
import { GITHUB, getVisionKey } from "./constants";
import {
  isGithubAuthConfigured,
  onGithubAuthChanged,
  signInWithGithub,
  signOutGithub,
} from "./utils/github-auth";

const DEFAULT_COPY_LIMIT = 3500;
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_REPO_OWNER = "alialiayman";
const GITHUB_REPO_NAME = "reflections";
const GITHUB_ACCESS_TOKEN_STORAGE_KEY = "reflections_github_access_token";
const GITHUB_LOGIN_STORAGE_KEY = "reflections_github_login";

const FALLBACK_IMAGE_NAME = "صورة";

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

const getFileNameParts = (fileName = "") => {
  const clean = fileName.trim();
  if (!clean) {
    return { extension: ".png", stem: FALLBACK_IMAGE_NAME };
  }

  const dotIndex = clean.lastIndexOf(".");
  if (dotIndex <= 0) {
    return { extension: ".png", stem: clean };
  }

  return {
    extension: clean.slice(dotIndex),
    stem: clean.slice(0, dotIndex),
  };
};

const splitNumericPrefix = (stem = "") => {
  const match = stem.match(/^(\d+)\s*(.*)$/);
  if (!match) {
    return { number: 1, baseName: stem.trim() || FALLBACK_IMAGE_NAME };
  }

  const parsedNumber = Number.parseInt(match[1], 10);
  return {
    number: Number.isNaN(parsedNumber) ? 1 : parsedNumber,
    baseName: (match[2] || "").trim() || FALLBACK_IMAGE_NAME,
  };
};

const extractSuggestedArabicName = (text = "") => {
  const match = text.match(/^\s*اسم\s+مقترح\s*:\s*(.+)$/im);
  if (!match) {
    return "";
  }

  return match[1]
    .replace(/^['"\s]+|['"\s]+$/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const toEncodedGitHubContentsPath = (repoPath = "") =>
  repoPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

function getCopyLimitFromQuery() {
  const query = window.location.search;
  const match = query.match(/\d+/); // Find the first number in the query string
  return match ? parseInt(match[0], 10) : DEFAULT_COPY_LIMIT;
}

const COPY_LIMIT = getCopyLimitFromQuery();
const REFERENCE_LINK = "\nhttps://a-reflections.web.app";

function App() {
  const [loadingChunks, setLoadingChunks] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyIndex, setCopyIndex] = useState(0);
  const [textChunks, setTextChunks] = useState([]);
  const [images, setImages] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [imageDescription, setImageDescription] = useState("");
  const [describingImage, setDescribingImage] = useState(false);
  const [borderColorIndex, setBorderColorIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [userQuestion, setUserQuestion] = useState("");
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [imageBase64Data, setImageBase64Data] = useState(null);
  const [imageNameNumber, setImageNameNumber] = useState(1);
  const [editableImageName, setEditableImageName] = useState(FALLBACK_IMAGE_NAME);
  const [selectedImageExtension, setSelectedImageExtension] = useState(".png");
  const [renamingImage, setRenamingImage] = useState(false);
  const [githubToken, setGithubToken] = useState(
    () => localStorage.getItem(GITHUB_ACCESS_TOKEN_STORAGE_KEY) || ""
  );
  const [githubLogin, setGithubLogin] = useState(
    () => localStorage.getItem(GITHUB_LOGIN_STORAGE_KEY) || ""
  );
  const [oauthConfigured] = useState(() => isGithubAuthConfigured());
  const [hasRepoWriteAccess, setHasRepoWriteAccess] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);


  const borderColors = [
    "#6C63FF",
    "#00BFA6",
    "#FF6F61",
    "#FFD600",
    "#448AFF",
    "#E040FB",
    "#FF9100",
  ];
  const [copyToast, setCopyToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const path = window.location.pathname;
  const normalizedPathSegments = getNormalizedPathSegments(path);
  const apiPath = normalizedPathSegments
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  useEffect(() => {
    if (!oauthConfigured) {
      return () => {};
    }

    return onGithubAuthChanged((user) => {
      if (!user) {
        return;
      }

      if (user?.reloadUserInfo?.screenName) {
        const login = user.reloadUserInfo.screenName;
        setGithubLogin(login);
        localStorage.setItem(GITHUB_LOGIN_STORAGE_KEY, login);
      } else if (user?.providerData?.[0]?.uid) {
        const login = user.providerData[0].uid;
        setGithubLogin(login);
        localStorage.setItem(GITHUB_LOGIN_STORAGE_KEY, login);
      }
    });
  }, [oauthConfigured]);

  useEffect(() => {
    if (!githubToken) {
      setHasRepoWriteAccess(false);
      setAuthChecking(false);
      return;
    }

    let cancelled = false;
    const verifyRepoAccess = async () => {
      setAuthChecking(true);

      try {
        const response = await axios.get(
          `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
            },
          }
        );

        const canPush = Boolean(response.data?.permissions?.push);
        if (!cancelled) {
          setHasRepoWriteAccess(canPush);
        }

        if (!canPush && !cancelled) {
          setCopyToast({
            open: true,
            message:
              "GitHub token is valid but does not have write access to this repository.",
            severity: "warning",
          });
        }
      } catch {
        if (!cancelled) {
          setHasRepoWriteAccess(false);
          localStorage.removeItem(GITHUB_ACCESS_TOKEN_STORAGE_KEY);
          setGithubToken("");
          setCopyToast({
            open: true,
            message: "GitHub authentication failed. Please sign in again.",
            severity: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    };

    verifyRepoAccess();
    return () => {
      cancelled = true;
    };
  }, [githubToken]);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/alialiayman/reflections/contents/${
            apiPath
          }?ref=main`
        );
        const data = await response.json();

        if (Array.isArray(data)) {
          const imageFiles = data
            .filter((file) => {
              const lowerName = file.name.toLowerCase();
              return (
                lowerName.endsWith(".jpg") ||
                lowerName.endsWith(".jpeg") ||
                lowerName.endsWith(".png")
              );
            })
            .map((file) => ({
              name: file.name,
              url: file.download_url,
            }));

          setImages(imageFiles);
        }
      } catch (error) {
        console.error("Failed to fetch images", error);
      }
    };

    fetchImages();
  }, [apiPath]);

  useEffect(() => {
    const readmeDiv = document.getElementById("readme");
    if (!readmeDiv) return;
    // MutationObserver to wait until content is loaded inside #readme
    const observer = new MutationObserver(() => {
      const fullText = readmeDiv.innerText.trim();
      if (fullText.length > COPY_LIMIT / 2) {
        const chunks = splitTextIntoChunks(fullText);
        setTextChunks(chunks);
        setLoadingChunks(false); // ✅ Set as ready
        observer.disconnect(); // Stop observing once text is ready
      }
    });
    observer.observe(readmeDiv, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const splitTextIntoChunks = (text) => {
    const chunks = [];
    let position = 0;
    let count = 1;
    while (position < text.length) {
      let chunk = text.substring(position, position + COPY_LIMIT);
      chunk += REFERENCE_LINK; // Add reference link at the end
      chunks.push(
        `(${count}/${Math.ceil(text.length / COPY_LIMIT)})\n\n` + chunk
      );
      position += COPY_LIMIT;
      count++;
    }
    return chunks;
  };

  const getCurrentVisibleChunks = () => {
    const readmeDiv = document.getElementById("readme");
    const fullText = readmeDiv?.innerText?.trim() || "";

    if (!fullText) {
      return [];
    }

    return splitTextIntoChunks(fullText);
  };

  const handleCopy = () => {
    const visibleChunks = getCurrentVisibleChunks();
    setTextChunks(visibleChunks);

    if (visibleChunks.length === 0) {
      setCopyToast({
        open: true,
        message: "No content to copy",
        severity: "warning",
      });
      return;
    }

    if (copyIndex >= visibleChunks.length) {
      setCopyToast({
        open: true,
        message: "All text has been copied!",
        severity: "info",
      });
      setCopyIndex(0); // Reset index to allow copying again
      return;
    }

    navigator.clipboard
      .writeText(visibleChunks[copyIndex])
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        setCopyIndex(copyIndex + 1); // Move to the next chunk for the next copy
      })
      .catch((err) => console.error("Failed to copy:", err));
  };

  const handleCloseCopyToast = (_, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setCopyToast((current) => ({ ...current, open: false }));
  };

  const handleSignInGithub = async () => {
    if (!oauthConfigured) {
      setCopyToast({
        open: true,
        message:
          "GitHub OAuth is not configured yet. Add Firebase env vars to enable sign-in.",
        severity: "warning",
      });
      return;
    }

    try {
      setAuthLoading(true);
      const { user, accessToken } = await signInWithGithub();

      if (!accessToken) {
        throw new Error("Missing GitHub access token.");
      }

      const login =
        user?.reloadUserInfo?.screenName || user?.providerData?.[0]?.uid || "";
      if (login) {
        setGithubLogin(login);
        localStorage.setItem(GITHUB_LOGIN_STORAGE_KEY, login);
      }

      localStorage.setItem(GITHUB_ACCESS_TOKEN_STORAGE_KEY, accessToken);
      setGithubToken(accessToken);
      setCopyToast({
        open: true,
        message: "Signed in with GitHub.",
        severity: "success",
      });
    } catch {
      setCopyToast({
        open: true,
        message: "GitHub sign-in failed. Please try again.",
        severity: "error",
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOutGithub = async () => {
    await signOutGithub();
    localStorage.removeItem(GITHUB_ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(GITHUB_LOGIN_STORAGE_KEY);
    setGithubToken("");
    setGithubLogin("");
    setHasRepoWriteAccess(false);
    setCopyToast({
      open: true,
      message: "Signed out from GitHub editor mode.",
      severity: "info",
    });
  };

  
  const handleClickOpen = (imageUrl, imageName) => {
    setSelectedImage(imageUrl);
    setSelectedImageName(imageName || "");
    const { extension, stem } = getFileNameParts(imageName || "");
    const { number, baseName } = splitNumericPrefix(stem);
    setSelectedImageExtension(extension || ".png");
    setImageNameNumber(number);
    setEditableImageName(baseName);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedImage(null);
    setSelectedImageName("");
    setImageDescription("");
    setChatMessages([]);
    setUserQuestion("");
    setImageBase64Data(null);
    setImageNameNumber(1);
    setEditableImageName(FALLBACK_IMAGE_NAME);
    setSelectedImageExtension(".png");
  };

  const handleDescribeImage = async () => {
    if (!selectedImage) return;
    setDescribingImage(true);
    setImageDescription("");
    try {
      const imgResponse = await fetch(selectedImage);
      const blob = await imgResponse.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
      });

      const mimeType = blob.type || "image/png";
      setImageBase64Data({ base64, mimeType });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getVisionKey()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `You are an expert in ancient Egyptian hieroglyphs, Egyptology, and Quranic studies. Describe this image in detail in Arabic.

If the image contains hieroglyphs:
- Act as an expert hieroglyph reader. Carefully read and transliterate every hieroglyphic symbol visible.
- If cartouches are detected, read and translate the names inside them.
- Explain what is written in the hieroglyphs to someone who wants to understand the text.
- The word "nṯr" (netjer) in hieroglyphs represents a FORCE or power, NOT a god. Ancient Egyptians did not believe in gods as deities — they understood these figures as forces and archetypes within the human psyche.

Use the following correspondences between ancient/historical figures and Quranic/religious figures when analyzing the image:
- Imhotep (إمحوتب) = Prophet Joseph (يوسف)
- Nut (نوت) the sky goddess = Noah (نوح)
- Thutmose III (تحتمس الثالث) = Prophet Solomon (سليمان)
- Thutmose II (تحتمس الثاني) = Prophet David (داود)
- Moses (موسى) = Zarathustra/Zoroaster (زرادشت)
- Abraham (إبراهيم) = Socrates (سقراط)
- Plato (أفلاطون) = Ismail (إسماعيل)
- Aristotle (أرسطو) = Isaac (إسحاق)
- Jacob (يعقوب) is NOT Israel
- Lot (لوط) = Buddha (بوذا)
- Mohamed (محمد) = Mani (ماني)
- Akhenaten/Ikhnaton (إخناتون) = Imran (عمران)
- Tutankhamun (توت عنخ آمون) = Yahia/John (يحيى)
- Meritaten (ميريت آتون) = Mother Mary (السيدة مريم)
- Smenkhkare (سمنخ كع رع) = Zakaria (زكريا)

When relevant, explain the image from a Quranic perspective using these correspondences.

Then on a new line prefixed with 'اسم مقترح: ' suggest an Arabic file name for this image (less than 15 words, Arabic letters only, no numbers, no extension, no English words). Finally, add a line of relevant hashtags in English.` },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
        }),
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "No description returned.";
      const suggestedArabicName = extractSuggestedArabicName(content);
      if (suggestedArabicName) {
        setEditableImageName(suggestedArabicName);
      }
      setImageDescription(content);
      setChatMessages([
        { role: "assistant", content },
      ]);
      setBorderColorIndex((prev) => (prev + 1) % borderColors.length);
    } catch (err) {
      console.error("Failed to describe image:", err);
      setImageDescription("Error: could not describe image.");
    } finally {
      setDescribingImage(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!userQuestion.trim() || !imageBase64Data) return;
    const question = userQuestion.trim();
    setUserQuestion("");
    setAskingQuestion(true);

    const newMessages = [...chatMessages, { role: "user", content: question }];
    setChatMessages(newMessages);

    try {
      const apiMessages = [
        {
          role: "user",
          content: [
            { type: "text", text: "This is an image of an ancient Egyptian artifact. Answer all questions in Arabic." },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageBase64Data.mimeType};base64,${imageBase64Data.base64}`,
              },
            },
          ],
        },
        ...newMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getVisionKey()}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: apiMessages,
          max_tokens: 2000,
        }),
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "No response.";
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setBorderColorIndex((prev) => (prev + 1) % borderColors.length);
    } catch (err) {
      console.error("Failed to ask question:", err);
      setChatMessages((prev) => [...prev, { role: "assistant", content: "حدث خطأ أثناء الإجابة." }]);
    } finally {
      setAskingQuestion(false);
    }
  };

  const handleRenameImageOnGithub = async () => {
    if (!hasRepoWriteAccess || !githubToken) {
      setCopyToast({
        open: true,
        message: "GitHub write access is required to rename images.",
        severity: "warning",
      });
      return;
    }

    if (!selectedImageName) {
      setCopyToast({
        open: true,
        message: "No selected image to rename.",
        severity: "warning",
      });
      return;
    }

    const currentName = selectedImageName.trim();
    const targetName = suggestedFullImageName.trim();
    if (!targetName) {
      setCopyToast({
        open: true,
        message: "Target image name cannot be empty.",
        severity: "warning",
      });
      return;
    }

    if (currentName === targetName) {
      setCopyToast({
        open: true,
        message: "The new image name is the same as the current one.",
        severity: "info",
      });
      return;
    }

    const currentRepoPath = [...normalizedPathSegments, currentName].join("/");
    const targetRepoPath = [...normalizedPathSegments, targetName].join("/");
    const currentContentsUrl = `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${toEncodedGitHubContentsPath(currentRepoPath)}`;
    const targetContentsUrl = `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${toEncodedGitHubContentsPath(targetRepoPath)}`;

    setRenamingImage(true);
    try {
      const fileResponse = await axios.get(`${currentContentsUrl}?ref=main`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
      });

      const fileSha = fileResponse.data?.sha;
      const fileContent = fileResponse.data?.content;
      if (!fileSha || !fileContent) {
        throw new Error("Could not read existing image content");
      }

      await axios.put(
        targetContentsUrl,
        {
          message: `Rename image: ${currentName} -> ${targetName}`,
          content: String(fileContent).replace(/\n/g, ""),
          branch: "main",
        },
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        }
      );

      await axios.delete(currentContentsUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
        data: {
          message: `Delete old image after rename: ${currentName}`,
          sha: fileSha,
          branch: "main",
        },
      });

      const updatedImageUrl = `${GITHUB}/${toEncodedGitHubContentsPath(targetRepoPath)}?v=${Date.now()}`;
      setSelectedImageName(targetName);
      setSelectedImage(updatedImageUrl);
      setImages((previous) =>
        previous.map((image) =>
          image.name === currentName
            ? { ...image, name: targetName, url: updatedImageUrl }
            : image
        )
      );

      setCopyToast({
        open: true,
        message: `Image renamed to ${targetName}`,
        severity: "success",
      });
    } catch (error) {
      const apiMessage = error?.response?.data?.message;
      setCopyToast({
        open: true,
        message: apiMessage
          ? `Rename failed: ${apiMessage}`
          : "Failed to rename image on GitHub.",
        severity: "error",
      });
    } finally {
      setRenamingImage(false);
    }
  };

  const normalizedImageNumber = Number.isFinite(imageNameNumber) && imageNameNumber > 0
    ? Math.floor(imageNameNumber)
    : 1;
  const normalizedImageBaseName = (editableImageName || FALLBACK_IMAGE_NAME)
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim() || FALLBACK_IMAGE_NAME;
  const suggestedFullImageName = `${normalizedImageNumber} ${normalizedImageBaseName}${selectedImageExtension || ".png"}`;

  return (
    <>
      <Header
        id="web-header"
        handleCopy={handleCopy}
        copied={copied}
        copyIndex={copyIndex}
        textChunks={textChunks}
        images={images}
        handleClickOpen={handleClickOpen}
        loading={loadingChunks}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode((current) => !current)}
        githubLogin={githubLogin}
        oauthConfigured={oauthConfigured}
        canEditSections={hasRepoWriteAccess && Boolean(githubToken)}
        authLoading={authLoading}
        authChecking={authChecking}
        onSignInGithub={handleSignInGithub}
        onSignOutGithub={handleSignOutGithub}
      />
      <div id="print-header" style={{display: 'none'}}></div>
      <Container p={2} mt={2}>
        <Main
          previewMode={previewMode}
          images={images}
          githubToken={githubToken}
          hasRepoWriteAccess={hasRepoWriteAccess}
        />
      </Container>

      {/* Modal for Enlarged Image */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={imageDescription ? "lg" : "md"}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            background: "#1a1a2e",
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: imageDescription ? "row" : "column" },
              minHeight: 300,
            }}
          >
            {/* Image side */}
            <Box
              sx={{
                flex: imageDescription ? "0 0 50%" : "1 1 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f0f23",
                p: 2,
              }}
            >
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Large Illustration"
                  className="modal-image-glow"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "65vh",
                    objectFit: "contain",
                    borderRadius: 14,
                    border: "3px solid #00BFA6",
                    boxShadow: "0 0 25px rgba(0, 191, 166, 0.5), 0 0 60px rgba(0, 191, 166, 0.15), 0 10px 40px rgba(0, 0, 0, 0.6)",
                    animation: "imageReveal 0.6s ease-out",
                  }}
                />
              )}
              {/* Image name and action area */}
              <Box
                sx={{
                  width: "100%",
                  mt: 1.5,
                  px: 1,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: "#aaa",
                    fontFamily: "Roboto, sans-serif",
                    fontSize: "0.85rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    mb: 1,
                  }}
                >
                  {selectedImageName}
                </Typography>
                {!imageDescription ? (
                  // Initial Describe button
                  describingImage ? (
                    <CircularProgress size={28} sx={{ color: "#aaa" }} />
                  ) : (
                    <Button
                      onClick={handleDescribeImage}
                      variant="outlined"
                      size="small"
                      startIcon={<AutoAwesomeIcon />}
                      sx={{
                        borderRadius: 5,
                        px: 2,
                        py: 0.5,
                        fontSize: "0.8rem",
                        textTransform: "none",
                        fontFamily: "Roboto, sans-serif",
                        color: "#aaa",
                        borderColor: "#444",
                        "&:hover": {
                          borderColor: "#888",
                          backgroundColor: "rgba(255,255,255,0.05)",
                        },
                      }}
                    >
                      Describe
                    </Button>
                  )
                ) : (
                  <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 1, mb: 1 }}>
                    <TextField
                      type="number"
                      label="رقم"
                      size="small"
                      value={normalizedImageNumber}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value || "1", 10);
                        setImageNameNumber(Number.isNaN(parsed) ? 1 : Math.max(1, parsed));
                      }}
                      inputProps={{ min: 1 }}
                      sx={{
                        "& .MuiInputBase-input": { fontFamily: '"Roboto", "Segoe UI", sans-serif' }
                      }}
                    />
                    <TextField
                      label="اسم الصورة المقترح"
                      size="small"
                      value={editableImageName}
                      onChange={(event) => setEditableImageName(event.target.value)}
                      sx={{
                        "& .MuiInputBase-input": { fontFamily: '"Roboto", "Segoe UI", sans-serif' }
                      }}
                    />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        color: "#b6bdc7",
                        mb: 1,
                        fontFamily: '"Roboto", "Segoe UI", sans-serif'
                      }}
                    >
                      {`الاسم النهائي: ${suggestedFullImageName}`}
                    </Typography>
                    <Button
                      onClick={handleRenameImageOnGithub}
                      variant="outlined"
                      size="small"
                      startIcon={renamingImage ? <CircularProgress size={14} /> : <DriveFileRenameOutlineIcon />}
                      disabled={renamingImage || !hasRepoWriteAccess || !githubToken}
                      sx={{
                        mb: 1,
                        textTransform: "none",
                        fontFamily: '"Roboto", "Segoe UI", sans-serif',
                        color: "#9ec5b3",
                        borderColor: "rgba(158,197,179,0.5)",
                      }}
                    >
                      {renamingImage ? "Renaming..." : "Rename on GitHub"}
                    </Button>

                    <TextField
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAskQuestion();
                        }
                      }}
                      placeholder="اسأل عن الصورة..."
                      variant="outlined"
                      size="small"
                      fullWidth
                      disabled={askingQuestion}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            {askingQuestion ? (
                              <CircularProgress size={22} sx={{ color: "#aaa" }} />
                            ) : (
                              <IconButton
                                onClick={handleAskQuestion}
                                disabled={!userQuestion.trim()}
                                size="small"
                                sx={{ color: "#aaa" }}
                              >
                                <SendIcon fontSize="small" />
                              </IconButton>
                            )}
                          </InputAdornment>
                        ),
                        sx: {
                          fontFamily: '"Roboto", "Segoe UI", sans-serif',
                          fontSize: "0.9rem",
                          color: "#e0e0e0",
                          borderRadius: 3,
                          "& fieldset": { borderColor: "#444" },
                          "&:hover fieldset": { borderColor: "#888" },
                          "&.Mui-focused fieldset": { borderColor: "#6C63FF" },
                        },
                      }}
                    />
                  </>
                )}
              </Box>
            </Box>

            {/* Conversation side */}
            {chatMessages.length > 0 && (
              <Box
                sx={{
                  flex: "1 1 50%",
                  p: 3,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  overflow: "auto",
                  maxHeight: "75vh",
                  gap: 2,
                }}
              >
                {chatMessages.map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      border: msg.role === "assistant" ? 2 : 1,
                      borderColor: msg.role === "assistant"
                        ? borderColors[(borderColorIndex + idx) % borderColors.length]
                        : "#555",
                      borderRadius: 3,
                      p: 2,
                      transition: "border-color 0.5s ease",
                      background: msg.role === "assistant"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(108,99,255,0.08)",
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{
                        color: "#e0e0e0",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.8,
                        fontSize: "1.05rem",
                        fontFamily: '"Roboto", "Segoe UI", sans-serif',
                      }}
                    >
                      {msg.content}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={copyToast.open}
        autoHideDuration={3000}
        onClose={handleCloseCopyToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseCopyToast}
          severity={copyToast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {copyToast.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default App;
