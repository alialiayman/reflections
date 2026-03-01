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
const FOLDER_SUBTITLE_TOKEN = '[[FOLDER_SUBTITLE]]';
const FOLDER_SUBTITLE_TOKEN_REGEX = /\[\[\s*FOLDER_SUBTITLE\s*\]\]?/i;
const FOLDER_SUBTITLE_TOKEN_REGEX_GLOBAL = /\[\[\s*FOLDER_SUBTITLE\s*\]\]?/gi;

const getLeadingNumber = (name) => {
    const match = name.match(/^\s*(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const safelyDecodeURIComponent = (value) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const getNormalizedPathSegments = (path) => {
    return path
        .split('/')
        .filter(Boolean)
        .map((segment) => safelyDecodeURIComponent(segment).trim())
        .filter(Boolean);
};

const toRouteSlug = (folderName) => {
    return encodeURIComponent(folderName.trim());
};

const toEncodedRepoPath = (path) => {
    const segments = getNormalizedPathSegments(path);
    if (!segments.length) {
        return '';
    }

    return segments
        .map((segment) => encodeURIComponent(segment))
        .join('/');
};

const buildFolderUrl = (currentPath, folderName) => {
    const normalizedParentPath = getNormalizedPathSegments(currentPath)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
    const slug = toRouteSlug(folderName);

    if (!normalizedParentPath) {
        return `${SITE_BASE_URL}/${slug}`;
    }

    return `${SITE_BASE_URL}/${normalizedParentPath}/${slug}`;
};

const buildFolderReadmeUrl = (currentPath, folderName) => {
    const encodedPath = toEncodedRepoPath(currentPath);
    const encodedFolderName = encodeURIComponent(folderName.trim());
    const relativeReadmePath = encodedPath
        ? `${encodedPath}/${encodedFolderName}/README.md`
        : `${encodedFolderName}/README.md`;

    return `${GITHUB}/${relativeReadmePath}`;
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

const toDisplayTitle = (folderName) => {
    return folderName.replace(/^\s*\d+\s*[-_.]?\s*/, '').trim();
};

const extractFirstReadmeLine = (markdownText) => {
    if (typeof markdownText !== 'string') {
        return '';
    }

    const firstLine = markdownText
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);

    if (!firstLine) {
        return '';
    }

    const cleaned = firstLine
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/\|/g, '\\|')
        .trim();

    return cleaned;
};

const fetchFolderSubtitles = async (folders, currentPath) => {
    const folderEntries = await Promise.all(
        folders.map(async (folder) => {
            try {
                const readmeUrl = buildFolderReadmeUrl(currentPath, folder.name);
                const response = await axios.get(readmeUrl, { responseType: 'text' });
                return {
                    ...folder,
                    subtitle: extractFirstReadmeLine(response.data)
                };
            } catch {
                return {
                    ...folder,
                    subtitle: ''
                };
            }
        })
    );

    return folderEntries;
};

const buildFolderTableMarkdown = (folders, currentPath) => {
    const links = sortFoldersNumerically(folders)
        .map((folder) => {
            const title = `[${toDisplayTitle(folder.name)}](${buildFolderUrl(currentPath, folder.name)})`;
            if (!folder.subtitle) {
                return title;
            }

            return `${title} ${FOLDER_SUBTITLE_TOKEN} ${folder.subtitle}`;
        });

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

const extractTokenParts = (text) => {
    if (typeof text !== 'string') {
        return null;
    }

    const match = text.match(FOLDER_SUBTITLE_TOKEN_REGEX);
    if (!match || typeof match.index !== 'number') {
        return null;
    }

    const beforeToken = text.slice(0, match.index);
    const afterToken = text.slice(match.index + match[0].length);
    return { beforeToken, afterToken };
};

const sanitizeTokenTextInNode = (node) => {
    if (typeof node === 'string') {
        return node.replace(FOLDER_SUBTITLE_TOKEN_REGEX_GLOBAL, ' ').replace(/\s{2,}/g, ' ');
    }

    if (!React.isValidElement(node)) {
        return node;
    }

    const elementChildren = node.props?.children;
    if (elementChildren == null) {
        return node;
    }

    return React.cloneElement(node, {
        ...node.props,
        children: React.Children.map(elementChildren, (child) => sanitizeTokenTextInNode(child))
    });
};

const FolderListTableCell = ({ children, ...props }) => {
    const childNodes = React.Children.toArray(children);
    const sanitizedChildren = React.Children.map(children, (child) => sanitizeTokenTextInNode(child));
    let subtitle = '';
    const titleNodes = [];

    childNodes.forEach((child) => {
        if (typeof child === 'string') {
            const tokenParts = extractTokenParts(child);
            if (!tokenParts) {
                titleNodes.push(sanitizeTokenTextInNode(child));
                return;
            }

            const { beforeToken, afterToken } = tokenParts;
            if (beforeToken && beforeToken.trim()) {
                titleNodes.push(beforeToken);
            }
            subtitle = (afterToken || '').trim();
            return;
        }

        titleNodes.push(sanitizeTokenTextInNode(child));
    });

    if (!subtitle) {
        return <td className="readme-folder-table-td" {...props}>{sanitizedChildren}</td>;
    }

    return (
        <td className="readme-folder-table-td" {...props}>
            <div className="folder-cell-title">{titleNodes}</div>
            <div className="folder-cell-subtitle">{subtitle}</div>
        </td>
    );
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

                            const foldersWithSubtitles = await fetchFolderSubtitles(folders, path);

                            markdownText = replaceFolderListToken(markdownText, foldersWithSubtitles, path);
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

        if (!sectionsArr.length && markdownText.trim()) {
            sectionsArr.push({ heading: '', markdown: markdownText.trim() });
        }

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
                                            td: ({ children, ...props }) => <FolderListTableCell {...props}>{children}</FolderListTableCell>
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
