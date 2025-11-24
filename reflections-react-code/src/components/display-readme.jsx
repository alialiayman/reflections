import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Typography } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GITHUB } from '../constants';


const DisplayReadme = ({ path, filename = 'README.md' }) => {
    const [error, setError] = useState(null);
    const [sections, setSections] = useState([]);

    useEffect(() => {
        if (path && filename) {
            const url = `${GITHUB}${path.endsWith('/') ? path : path + '/'}${filename}`;
            axios.get(url, { responseType: 'text' })
                .then((response) => {
                    // setContent(response.data);
                    splitSections(response.data);
                })
                .catch(() => setError(`${filename} not found`));
        } else {
            setError('No path or filename provided');
        }
    }, [path, filename]);

    const splitSections = (markdownText) => {
        const lines = markdownText.split('\n');
        const sectionsArr = [];
        let currentSection = '';
        let currentHeading = '';

        lines.forEach((line, index) => {
            const headingMatch = line.match(/^(#{1,3})\s+(.*)/);  // Matches #, ##, ###

            if (headingMatch) {
                if (currentHeading) {
                    sectionsArr.push({ heading: currentHeading, markdown: currentSection.trim() });
                }
                currentHeading = headingMatch[0];
                currentSection = line + '\n';
            } else {
                currentSection += line + '\n';
            }

            if (index === lines.length - 1 && currentHeading) {
                sectionsArr.push({ heading: currentHeading, markdown: currentSection.trim() });
            }
        });

        setSections(sectionsArr);
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Section copied to clipboard!');
        });
    };
    return (
        <div>
            {error ? (
                <Typography color="error">{error}</Typography>
            ) : (
                <div>
                    <div>
                        {sections.map((section, idx) => (
                            <div
                                key={idx}
                                style={{
                                    marginBottom: '1.5rem',
                                    borderBottom: '1px solid #eee',
                                    paddingBottom: '1rem',
                                    position: 'relative'
                                }}
                            >
                                {/* The copy button positioned top-left */}
                                <div style={{ position: 'absolute', top: 0, left: 0 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleCopy(section.markdown)}
                                        title="Copy section"
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </div>

                                {/* Add some left padding to make room for the button */}
                                <div style={{ paddingLeft: '2rem' }}>
                                    <Markdown remarkPlugins={[remarkGfm]}>{section.markdown}</Markdown>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            )}
        </div>
    );
};

export default DisplayReadme;
