import { CircularProgress, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { buildEpubLikePreview } from "../utils/epub-export";

const EpubPreview = ({ path, images }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      try {
        setLoading(true);
        setError(null);

        const preview = await buildEpubLikePreview({ path, images });
        if (!active) {
          return;
        }

        document.title = preview.title;
        setSections(preview.sections);
      } catch {
        if (!active) {
          return;
        }

        setError("Unable to render EPUB preview");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
    };
  }, [path, images]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "2rem 0" }}>
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <div className="markdown-content">
      {sections.map((section, index) => (
        <section
          key={`${section.heading}-${index}`}
          style={{ marginBottom: "1.5rem", borderBottom: "1px solid #eee", paddingBottom: "1rem" }}
          dangerouslySetInnerHTML={{ __html: section.html }}
        />
      ))}
    </div>
  );
};

export default EpubPreview;
