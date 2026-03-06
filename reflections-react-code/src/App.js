import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  Snackbar,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/header";
import Main from "./components/main";
import { getVisionKey } from "./constants";

const DEFAULT_COPY_LIMIT = 3500;

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
  const [previewMode, setPreviewMode] = useState(false);
  const [imageDescription, setImageDescription] = useState("");
  const [describingImage, setDescribingImage] = useState(false);
  const [borderColorIndex, setBorderColorIndex] = useState(0);
  const [imageHover, setImageHover] = useState(false);

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

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/alialiayman/reflections/contents/${
            path === "/" ? "" : path
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
  }, [path]);

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

  
  const handleClickOpen = (image) => {
    setSelectedImage(image);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedImage(null);
    setImageDescription("");
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
- Consider Thutmose III (تحتمس الثالث) to be the Prophet Solomon (سليمان) mentioned in the Quran. When relevant, explain the image from a Quranic perspective linking Thutmose III to Solomon.

Then on a new line prefixed with 'اسم مقترح: ' suggest an Arabic name for this image (less than 15 words). Finally, add a line of relevant hashtags in English.` },
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
      setImageDescription(
        data.choices?.[0]?.message?.content || "No description returned."
      );
      setBorderColorIndex((prev) => (prev + 1) % borderColors.length);
    } catch (err) {
      console.error("Failed to describe image:", err);
      setImageDescription("Error: could not describe image.");
    } finally {
      setDescribingImage(false);
    }
  };

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
      />
      <div id="print-header" style={{display: 'none'}}></div>
      <Container p={2} mt={2}>
        <Main previewMode={previewMode} images={images} />
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
            {/* Image side with hover button */}
            <Box
              sx={{
                position: "relative",
                flex: imageDescription ? "0 0 50%" : "1 1 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f0f23",
                p: 2,
              }}
              onMouseEnter={() => setImageHover(true)}
              onMouseLeave={() => setImageHover(false)}
            >
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Large Illustration"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />
              )}
              {/* Hover overlay with button */}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.45)",
                  opacity: imageHover || describingImage ? 1 : 0,
                  transition: "opacity 0.3s ease",
                  pointerEvents: imageHover || describingImage ? "auto" : "none",
                }}
              >
                {describingImage ? (
                  <CircularProgress sx={{ color: "#fff" }} />
                ) : (
                  <Button
                    onClick={handleDescribeImage}
                    variant="contained"
                    startIcon={<AutoAwesomeIcon />}
                    sx={{
                      borderRadius: 8,
                      px: 3,
                      py: 1.2,
                      fontSize: "1rem",
                      textTransform: "none",
                      backgroundColor: "#1B4D3E",
                      "&:hover": {
                        backgroundColor: "#153D31",
                      },
                    }}
                  >
                    Describe Image
                  </Button>
                )}
              </Box>
            </Box>

            {/* Description side */}
            {imageDescription && (
              <Box
                sx={{
                  flex: "1 1 50%",
                  p: 3,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  overflow: "auto",
                  maxHeight: "75vh",
                }}
              >
                <Box
                  sx={{
                    border: 2,
                    borderColor: borderColors[borderColorIndex],
                    borderRadius: 3,
                    p: 2.5,
                    transition: "border-color 0.5s ease",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      color: "#e0e0e0",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.7,
                      fontSize: "0.95rem",
                    }}
                  >
                    {imageDescription}
                  </Typography>
                </Box>
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
