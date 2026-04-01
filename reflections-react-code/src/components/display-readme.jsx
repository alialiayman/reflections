import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CancelIcon from '@mui/icons-material/Cancel';
import ImageIcon from '@mui/icons-material/Image';
import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { Typography } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GITHUB, getVisionKey } from '../constants';

const FOLDER_LIST_TOKEN_DETECT_REGEX = /\{\{\s*folderList\s*\}\}/i;
const FOLDER_LIST_TOKEN_REPLACE_REGEX = /\{\{\s*folderList\s*\}\}/gi;
const REPO_CONTENTS_API_BASE = 'https://api.github.com/repos/alialiayman/reflections/contents';
const SITE_BASE_URL = 'https://a-reflections.web.app';
const EXCLUDED_FOLDER_NAMES = new Set(['reflections-react-code']);
const FOLDER_LIST_FALLBACK = '⚠️ تعذر تحميل قائمة المجلدات من GitHub حالياً.';
const FOLDER_SUBTITLE_TOKEN = '[[FOLDER_SUBTITLE]]';
const FOLDER_SUBTITLE_TOKEN_REGEX = /\[\[\s*FOLDER_SUBTITLE\s*\]\]?/i;
const FOLDER_SUBTITLE_TOKEN_REGEX_GLOBAL = /\[\[\s*FOLDER_SUBTITLE\s*\]\]?/gi;
const GITHUB_DEFAULT_BRANCH = 'main';
const DEFAULT_GENERATED_IMAGE_EXTENSION = '.png';

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

const toGitHubContentsPath = (path, filename) => {
    const segments = getNormalizedPathSegments(path);
    const cleanFilename = safelyDecodeURIComponent(filename || 'README.md').trim() || 'README.md';
    return [...segments, cleanFilename].join('/');
};

const toEncodedGitHubContentsPath = (path) => {
    if (!path) {
        return '';
    }

    return path
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
};

const toBase64Utf8 = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return window.btoa(binary);
};

const stripMarkdownHeadingMarks = (value) =>
    (value || '')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/[*_`~]/g, '')
        .trim();

const toSafeArabicFileStem = (value) => {
    const cleaned = (value || '')
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return cleaned || 'صورة';
};

const extractLeadingNumber = (name = '') => {
    const match = name.match(/^(\d+)/);
    return match ? Number.parseInt(match[1], 10) : null;
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

const extractFirstHeadingText = (markdownText) => {
    if (typeof markdownText !== 'string') {
        return '';
    }

    const headingMatch = markdownText.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m);
    return headingMatch?.[1]?.trim() || '';
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


const DisplayReadme = ({ path, filename = 'README.md', githubToken, hasRepoWriteAccess }) => {
    const [error, setError] = useState(null);
    const [sections, setSections] = useState([]);
    const [editingSectionIndex, setEditingSectionIndex] = useState(null);
    const [editingMarkdown, setEditingMarkdown] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [rewordingSectionIndex, setRewordingSectionIndex] = useState(null);
    const [generatingImageSectionIndex, setGeneratingImageSectionIndex] = useState(null);
    const [snackbarState, setSnackbarState] = useState({
        open: false,
        message: '',
        severity: 'success'
    });


    useEffect(() => {
        if (path && filename) {
            const url = `${GITHUB}${path.endsWith('/') ? path : path + '/'}${filename}`;
            setError(null);
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

                    const firstHeading = extractFirstHeadingText(markdownText);
                    document.title = firstHeading || filename;

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

    const handleSnackbarClose = (_, reason) => {
        if (reason === 'clickaway') {
            return;
        }

        setSnackbarState((previousState) => ({ ...previousState, open: false }));
    };

    const handleCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setSnackbarState({
                open: true,
                message: 'Section copied to clipboard!',
                severity: 'success'
            });
        } catch {
            setSnackbarState({
                open: true,
                message: 'Failed to copy section.',
                severity: 'error'
            });
        }
    };

    const handleStartEdit = (idx) => {
        setEditingSectionIndex(idx);
        setEditingMarkdown(sections[idx]?.markdown || '');
    };

    const handleCancelEdit = () => {
        setEditingSectionIndex(null);
        setEditingMarkdown('');
    };

    const handleSaveEdit = async (idx) => {
        if (!hasRepoWriteAccess || !githubToken) {
            setSnackbarState({
                open: true,
                message: 'GitHub write access is required to save edits.',
                severity: 'warning'
            });
            return;
        }

        const updatedSections = sections.map((section, sectionIndex) =>
            sectionIndex === idx
                ? { ...section, markdown: editingMarkdown }
                : section
        );

        const updatedMarkdown = updatedSections
            .map((section) => section.markdown)
            .join('\n\n');
        const githubContentsPath = toGitHubContentsPath(path, filename);
        const encodedContentsPath = toEncodedGitHubContentsPath(githubContentsPath);
        const contentsUrl = `${REPO_CONTENTS_API_BASE}/${encodedContentsPath}`;

        setSavingEdit(true);

        try {
            const fileResponse = await axios.get(`${contentsUrl}?ref=${GITHUB_DEFAULT_BRANCH}`, {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: 'application/vnd.github+json'
                }
            });

            const fileSha = fileResponse.data?.sha;
            if (!fileSha) {
                throw new Error('Missing file SHA');
            }

            const commitMessage = `Edit ${githubContentsPath} section ${idx + 1}`;
            await axios.put(
                contentsUrl,
                {
                    message: commitMessage,
                    content: toBase64Utf8(updatedMarkdown),
                    sha: fileSha,
                    branch: GITHUB_DEFAULT_BRANCH
                },
                {
                    headers: {
                        Authorization: `Bearer ${githubToken}`,
                        Accept: 'application/vnd.github+json'
                    }
                }
            );

            setSections(updatedSections);
            setEditingSectionIndex(null);
            setEditingMarkdown('');
            setSnackbarState({
                open: true,
                message: 'Section updated and saved to GitHub.',
                severity: 'success'
            });
        } catch (error) {
            const status = error?.response?.status;
            const apiMessage = error?.response?.data?.message;
            const message = apiMessage
                ? `Failed to save to GitHub (${status || 'error'}): ${apiMessage}`
                : 'Failed to save to GitHub. Check token permissions and try again.';
            setSnackbarState({
                open: true,
                message,
                severity: 'error'
            });
        } finally {
            setSavingEdit(false);
        }
    };

    const handleRewordSection = async (idx) => {
        const sourceMarkdown = editingSectionIndex === idx
            ? editingMarkdown
            : sections[idx]?.markdown || '';

        if (!sourceMarkdown.trim()) {
            setSnackbarState({
                open: true,
                message: 'No section text available to reword.',
                severity: 'warning'
            });
            return;
        }

        setRewordingSectionIndex(idx);
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getVisionKey()}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an Arabic writing editor. Reword text to be clearer while preserving meaning and Markdown structure exactly.'
                        },
                        {
                            role: 'user',
                            content: `أعد صياغة النص التالي بالعربية فقط، وحافظ على نفس بنية Markdown والعناوين:\n\n${sourceMarkdown}`
                        }
                    ],
                    temperature: 0.6,
                    max_tokens: 2500
                })
            });

            const data = await response.json();
            const rewritten = data?.choices?.[0]?.message?.content?.trim();
            if (!rewritten) {
                throw new Error('No reworded content returned');
            }

            if (editingSectionIndex !== idx) {
                setEditingSectionIndex(idx);
            }
            setEditingMarkdown(rewritten);
            setSnackbarState({
                open: true,
                message: 'Section reworded successfully. Review then save.',
                severity: 'success'
            });
        } catch {
            setSnackbarState({
                open: true,
                message: 'Failed to reword section. Please try again.',
                severity: 'error'
            });
        } finally {
            setRewordingSectionIndex(null);
        }
    };

    const getNextImageNumberInFolder = async () => {
        const encodedPath = toEncodedRepoPath(path);
        const folderApi = encodedPath
            ? `${REPO_CONTENTS_API_BASE}/${encodedPath}?ref=${GITHUB_DEFAULT_BRANCH}`
            : `${REPO_CONTENTS_API_BASE}?ref=${GITHUB_DEFAULT_BRANCH}`;

        const response = await axios.get(folderApi, {
            headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: 'application/vnd.github+json'
            }
        });

        const items = Array.isArray(response.data) ? response.data : [];
        const imageNumbers = items
            .filter((item) => item.type === 'file' && /\.(png|jpe?g|webp)$/i.test(item.name))
            .map((item) => extractLeadingNumber(item.name))
            .filter((value) => Number.isInteger(value));

        const maxNumber = imageNumbers.length ? Math.max(...imageNumbers) : 0;
        return maxNumber + 1;
    };

    const handleGenerateSectionImage = async (idx) => {
        if (!hasRepoWriteAccess || !githubToken) {
            setSnackbarState({
                open: true,
                message: 'GitHub write access is required to generate and save an image.',
                severity: 'warning'
            });
            return;
        }

        const sourceMarkdown = editingSectionIndex === idx
            ? editingMarkdown
            : sections[idx]?.markdown || '';
        const sectionText = stripMarkdownHeadingMarks(sourceMarkdown);

        if (!sectionText.trim()) {
            setSnackbarState({
                open: true,
                message: 'Section text is empty. Cannot generate image.',
                severity: 'warning'
            });
            return;
        }

        setGeneratingImageSectionIndex(idx);

        try {
            const nameResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getVisionKey()}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'Generate short Arabic file names. Return Arabic text only with no punctuation, no numbers, no extension.'
                        },
                        {
                            role: 'user',
                            content: `اقترح اسماً عربياً قصيراً لصورة تمثل هذا النص:\n\n${sectionText}`
                        }
                    ],
                    max_tokens: 80,
                    temperature: 0.5
                })
            });
            const nameData = await nameResponse.json();
            const recommendedStem = toSafeArabicFileStem(nameData?.choices?.[0]?.message?.content || 'صورة');

            const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getVisionKey()}`
                },
                body: JSON.stringify({
                    model: 'gpt-image-1',
                    prompt: `أنشئ صورة فنية واقعية تعبر عن هذا النص العربي بدون أي كتابة على الصورة:\n\n${sectionText}`,
                    size: '1024x1024'
                })
            });
            const imageData = await imageResponse.json();
            const imageB64 = imageData?.data?.[0]?.b64_json;
            if (!imageB64) {
                throw new Error('No generated image returned');
            }

            const nextNumber = await getNextImageNumberInFolder();
            const generatedFileName = `${nextNumber} ${recommendedStem}${DEFAULT_GENERATED_IMAGE_EXTENSION}`;
            const githubImagePath = [...getNormalizedPathSegments(path), generatedFileName].join('/');
            const encodedImagePath = toEncodedGitHubContentsPath(githubImagePath);
            const imageContentsUrl = `${REPO_CONTENTS_API_BASE}/${encodedImagePath}`;

            await axios.put(
                imageContentsUrl,
                {
                    message: `Add generated section image: ${generatedFileName}`,
                    content: imageB64,
                    branch: GITHUB_DEFAULT_BRANCH
                },
                {
                    headers: {
                        Authorization: `Bearer ${githubToken}`,
                        Accept: 'application/vnd.github+json'
                    }
                }
            );

            setSnackbarState({
                open: true,
                message: `Image generated and saved: ${generatedFileName}`,
                severity: 'success'
            });
        } catch (error) {
            const status = error?.response?.status;
            const apiMessage = error?.response?.data?.message;
            setSnackbarState({
                open: true,
                message: apiMessage
                    ? `Failed to generate image (${status || 'error'}): ${apiMessage}`
                    : 'Failed to generate and save section image.',
                severity: 'error'
            });
        } finally {
            setGeneratingImageSectionIndex(null);
        }
    };

    const canEditSections = hasRepoWriteAccess && Boolean(githubToken);

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
                                <div style={{ position: 'absolute', top: 0, left: 0, display: 'flex', gap: '0.25rem' }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleCopy(section.markdown)}
                                        title="Copy section"
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                    {canEditSections && (
                                        <IconButton
                                            size="small"
                                            onClick={() => handleStartEdit(idx)}
                                            title="Edit section"
                                            disabled={savingEdit}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </div>

                                {editingSectionIndex === idx ? (
                                    <div className="markdown-content" style={{ paddingLeft: '4.25rem' }}>
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={8}
                                            value={editingMarkdown}
                                            onChange={(event) => setEditingMarkdown(event.target.value)}
                                            disabled={savingEdit || rewordingSectionIndex === idx || generatingImageSectionIndex === idx}
                                            sx={{
                                                '& .MuiInputBase-inputMultiline': {
                                                    fontFamily: '"Roboto", "Segoe UI", sans-serif',
                                                    fontSize: '1.03rem',
                                                    lineHeight: 1.9
                                                }
                                            }}
                                        />
                                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                            <Tooltip title="Save to GitHub">
                                                <span>
                                                    <IconButton
                                                        color="primary"
                                                        onClick={() => handleSaveEdit(idx)}
                                                        disabled={savingEdit || rewordingSectionIndex === idx || generatingImageSectionIndex === idx}
                                                    >
                                                        <SaveIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Cancel editing">
                                                <span>
                                                    <IconButton
                                                        color="default"
                                                        onClick={handleCancelEdit}
                                                        disabled={savingEdit || rewordingSectionIndex === idx || generatingImageSectionIndex === idx}
                                                    >
                                                        <CancelIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Reword section with OpenAI">
                                                <span>
                                                    <IconButton
                                                        color="secondary"
                                                        onClick={() => handleRewordSection(idx)}
                                                        disabled={savingEdit || rewordingSectionIndex === idx || generatingImageSectionIndex === idx}
                                                    >
                                                        <AutoFixHighIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Generate section image and save to GitHub">
                                                <span>
                                                    <IconButton
                                                        color="success"
                                                        onClick={() => handleGenerateSectionImage(idx)}
                                                        disabled={savingEdit || rewordingSectionIndex === idx || generatingImageSectionIndex === idx}
                                                    >
                                                        <ImageIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            {(rewordingSectionIndex === idx || generatingImageSectionIndex === idx) && (
                                                <Typography variant="caption" sx={{ alignSelf: 'center' }}>
                                                    {rewordingSectionIndex === idx ? 'Rewording...' : 'Generating image...'}
                                                </Typography>
                                            )}
                                        </Box>
                                    </div>
                                ) : (
                                    <div className="markdown-content" style={{ paddingLeft: '4.25rem' }}>
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
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            )}
            <Snackbar
                open={snackbarState.open}
                autoHideDuration={3000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbarState.severity} sx={{ width: '100%' }}>
                    {snackbarState.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default DisplayReadme;
