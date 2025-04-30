import { Container, Dialog } from "@mui/material";
import { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/header";
import Main from "./components/main";

const COPY_LIMIT = 3500; // Maximum characters per copy
const REFERENCE_LINK = "\nhttps://a-reflections.web.app";

function App() {
  const [copied, setCopied] = useState(false);
  const [copyIndex, setCopyIndex] = useState(0);
  const [textChunks, setTextChunks] = useState([]);
  const [images, setImages] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
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
          const jpgFiles = data
            .filter(
              (file) =>
                file.name.endsWith(".jpg") || file.name.endsWith(".jpeg")
            )
            .map((file) => file.download_url);

          setImages(jpgFiles);
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
      if (fullText.length > 0) {
        const chunks = splitTextIntoChunks(fullText);
        setTextChunks(chunks);
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
  const handleCopy = () => {
    if (textChunks.length === 0) {
      alert("No content to copy");
      return;
    }

    if (copyIndex >= textChunks.length) {
      alert("All text has been copied!");
      setCopyIndex(0); // Reset index to allow copying again
      return;
    }

    navigator.clipboard
      .writeText(textChunks[copyIndex])
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        setCopyIndex(copyIndex + 1); // Move to the next chunk for the next copy
      })
      .catch((err) => console.error("Failed to copy:", err));
  };

  const handleDownloadPdf = async () => {
    const fileName = path.split("/").filter(Boolean).pop() || "reflections";
    const element = document.getElementById("readme"); // Wrap your article with this ID
    if (!element) return;
    const images = element.querySelectorAll("img");
    const imageLoadPromises = Array.from(images).map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Still resolve to avoid blocking
          }
        })
    );

    await Promise.all(imageLoadPromises);
    import("html2pdf.js").then(({ default: html2pdf }) => {
      html2pdf()
        .from(element)
        .set({
          margin: 0.5,
          filename: `${fileName}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          useCORS: true, // 🔥 This tells html2canvas to try loading cross-origin images
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        })
        .save();
    });
  };
  const handleClickOpen = (image) => {
    setSelectedImage(image);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedImage(null);
  };

  return (
    <>
      <Header
        handleCopy={handleCopy}
        handleDownloadPdf={handleDownloadPdf}
        copied={copied}
        copyIndex={copyIndex}
        textChunks={textChunks}
        images={images}
        handleClickOpen={handleClickOpen}
      />
      <Container p={2} mt={2}>
        <Main />
      </Container>

      {/* Modal for Enlarged Image */}
      <Dialog open={open} onClose={handleClose}>
        {selectedImage && (
          <img
            src={selectedImage}
            alt="Large Illustration"
            style={{
              maxWidth: "100%",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
          />
        )}
      </Dialog>
    </>
  );
}

export default App;
