import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Typography } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GITHUB } from '../constants';

const FOLDER_LIST_TOKEN_DETECT_REGEX = /\{\{\s*folderList\s*\}\}/i;
const FOLDER_LIST_TOKEN_REPLACE_REGEX = /\{\{\s*folderList\s*\}\}/gi;
const REPO_CONTENTS_API_BASE = 'https://api.github.com/repos/alialiayman/reflections/contents';
const SITE_BASE_URL = 'https://a-reflections.web.app';
const EXCLUDED_FOLDER_NAMES = new Set(['reflections-react-code']);
const FOLDER_LIST_FALLBACK = '⚠️ تعذر تحميل قائمة المجلدات من GitHub حالياً.';

const getLeadingNumber = (name) => {
    const match = name.match(/^\s*(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const toRouteSlug = (folderName) => {
    return encodeURIComponent(folderName.trim());
};

const toEncodedRepoPath = (path) => {
    const trimmed = path.replace(/^\/+|\/+$/g, '');
    if (!trimmed) {
        return '';
    }

    return trimmed
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
};

const buildFolderUrl = (currentPath, folderName) => {
    const parentPath = currentPath.replace(/\/+$/g, '');
    const slug = toRouteSlug(folderName);

    if (!parentPath || parentPath === '/') {
        return `${SITE_BASE_URL}/${slug}`;
    }

    return `${SITE_BASE_URL}${parentPath}/${slug}`;
};

const sortFoldersNumerically = (folders) => {
    return [...folders].sort((a, b) => {
        const aNumber = getLeadingNumber(a.name);
        const bNumber = getLeadingNumber(b.name);

        if (aNumber !== bNumber) {
            return aNumber - bNumber;
        }

        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
};

const shouldIncludeFolder = (folder) => {
    if (!folder || typeof folder.name !== 'string') {
        return false;
    }

    const folderName = folder.name.trim();
    if (!folderName || folderName.startsWith('.')) {
        return false;
    }

    return !EXCLUDED_FOLDER_NAMES.has(folderName);
};

const buildFolderTableMarkdown = (folders, currentPath) => {
    const links = sortFoldersNumerically(folders)
        .map((folder) => `[${folder.name}](${buildFolderUrl(currentPath, folder.name)})`);

    const tableLines = [
        '|   |   |   |',
        '| --- | --- | --- |'
    ];

    for (let index = 0; index < links.length; index += 3) {
        const first = links[index] || ' ';
        const second = links[index + 1] || ' ';
        const third = links[index + 2] || ' ';
        tableLines.push(`| ${first} | ${second} | ${third} |`);
    }

    return tableLines.join('\n');
};

const hasFolderListToken = (markdownText) => FOLDER_LIST_TOKEN_DETECT_REGEX.test(markdownText);

const replaceFolderListToken = (markdownText, folders, currentPath) => {
    if (!hasFolderListToken(markdownText)) {
        return markdownText;
    }

    const tableMarkdown = buildFolderTableMarkdown(folders, currentPath);
    return markdownText.replace(FOLDER_LIST_TOKEN_REPLACE_REGEX, tableMarkdown);
};

const replaceFolderListWithFallback = (markdownText) => {
    if (!hasFolderListToken(markdownText)) {
        return markdownText;
    }

    return markdownText.replace(FOLDER_LIST_TOKEN_REPLACE_REGEX, FOLDER_LIST_FALLBACK);
};


const DisplayReadme = ({ path, filename = 'README.md' }) => {
    const [error, setError] = useState(null);
    const [sections, setSections] = useState([]);

    useEffect(() => {
        if (path && filename) {
            const url = `${GITHUB}${path.endsWith('/') ? path : path + '/'}${filename}`;
            axios.get(url, { responseType: 'text' })
                .then(async (readmeResponse) => {
                    let markdownText = readmeResponse.data;

                    if (hasFolderListToken(markdownText)) {
                        const encodedPath = toEncodedRepoPath(path);
                        const folderApi = encodedPath
                            ? `${REPO_CONTENTS_API_BASE}/${encodedPath}?ref=main`
                            : `${REPO_CONTENTS_API_BASE}?ref=main`;
                        try {
                            const foldersResponse = await axios.get(folderApi);
                            if (!Array.isArray(foldersResponse.data)) {
                                markdownText = replaceFolderListWithFallback(markdownText);
                                splitSections(markdownText);
                                return;
                            }

                            const folders = foldersResponse.data
                                .filter((item) => item.type === 'dir' && shouldIncludeFolder(item));

                            markdownText = replaceFolderListToken(markdownText, folders, path);
                        } catch {
                            markdownText = replaceFolderListWithFallback(markdownText);
                        }
                    }

                    splitSections(markdownText);
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
                                <div className="markdown-content" style={{ paddingLeft: '2rem' }}>
                                    <Markdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            table: ({ ...props }) => <table className="readme-folder-table" {...props} />,
                                            th: ({ ...props }) => <th className="readme-folder-table-th" {...props} />,
                                            td: ({ ...props }) => <td className="readme-folder-table-td" {...props} />
                                        }}
                                    >
                                        {section.markdown}
                                    </Markdown>
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
