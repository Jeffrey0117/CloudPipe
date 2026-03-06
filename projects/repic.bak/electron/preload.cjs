const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Input validation helpers
function isValidPath(filePath) {
    if (typeof filePath !== 'string') return false;
    if (filePath.length === 0 || filePath.length > 32767) return false;
    // Note: We don't block '..' here as Windows paths are normalized by the OS
    // Security is maintained through contextIsolation
    return true;
}

function isValidBase64Data(data) {
    if (typeof data !== 'string') return false;
    // Must be a data URL format
    return data.startsWith('data:image/');
}

// Expose protected methods to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
    // Listen for file open events (from file association / command line)
    onOpenFile: (callback) => {
        ipcRenderer.on('open-file', (_event, filePath) => callback(filePath));
    },

    // Listen for virtual image open events (.repic files)
    onOpenVirtualImage: (callback) => {
        ipcRenderer.on('open-virtual-image', (_event, data) => callback(data));
    },

    // Directory selection dialog
    selectDirectory: async () => {
        return await ipcRenderer.invoke('select-directory');
    },

    // Save file with base64 data
    saveFile: async (filePath, base64Data) => {
        if (!isValidPath(filePath)) {
            return { success: false, error: 'Invalid file path' };
        }
        if (!isValidBase64Data(base64Data)) {
            return { success: false, error: 'Invalid image data' };
        }
        return await ipcRenderer.invoke('save-file', { filePath, base64Data });
    },

    // Batch crop save
    batchCropSave: async (options) => {
        const { filePath, base64Data, outputMode, originalPath, customDir } = options;

        if (!isValidPath(filePath)) {
            return { success: false, error: 'Invalid file path' };
        }
        if (!isValidBase64Data(base64Data)) {
            return { success: false, error: 'Invalid image data' };
        }
        if (originalPath && !isValidPath(originalPath)) {
            return { success: false, error: 'Invalid original path' };
        }
        if (customDir && !isValidPath(customDir)) {
            return { success: false, error: 'Invalid custom directory' };
        }
        if (!['replace', 'folder', 'custom'].includes(outputMode)) {
            return { success: false, error: 'Invalid output mode' };
        }

        return await ipcRenderer.invoke('batch-crop-save', {
            filePath,
            base64Data,
            outputMode,
            originalPath,
            customDir
        });
    },

    // Get file metadata
    getFileMetadata: async (filePath) => {
        if (!isValidPath(filePath)) {
            return null;
        }
        return await ipcRenderer.invoke('get-file-info', filePath);
    },

    // Read file as data URL (for images) or parse .repic files
    readFile: (filePath) => {
        if (!isValidPath(filePath)) {
            return null;
        }
        try {
            const ext = path.extname(filePath).toLowerCase();

            // Handle .repic virtual image files
            if (ext === '.repic') {
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                return {
                    type: 'virtual',
                    url: data.url,
                    name: data.name,
                    albumId: data.albumId,
                    imageId: data.imageId,
                    crop: data.crop || null,
                    filePath
                };
            }

            // Handle regular image files
            const buffer = fs.readFileSync(filePath);
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp'
            };
            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch (e) {
            console.error('Failed to read file:', e);
            return null;
        }
    },

    // Get files in directory (includes .repic virtual images)
    getFilesInDirectory: (dirPath, extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.repic']) => {
        if (!isValidPath(dirPath)) {
            return [];
        }
        try {
            const files = fs.readdirSync(dirPath);
            return files
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return extensions.includes(ext);
                })
                .map(file => path.join(dirPath, file));
        } catch (e) {
            console.error('Failed to read directory:', e);
            return [];
        }
    },

    // Show save dialog
    showSaveDialog: async (defaultPath) => {
        return await ipcRenderer.invoke('show-save-dialog', defaultPath);
    },

    // Path utilities (safe exposure of path module)
    path: {
        basename: (filePath) => path.basename(filePath),
        dirname: (filePath) => path.dirname(filePath),
        extname: (filePath) => path.extname(filePath),
        join: (...args) => path.join(...args)
    },

    // OS utilities
    getDesktopPath: () => {
        return path.join(os.homedir(), 'Desktop');
    },

    // Check if running in Electron
    isElectron: true,

    // Native image processing (via @modern-ffi/core + libvips)
    nativeCrop: async (inputPath, outputPath, crop) => {
        if (!isValidPath(inputPath) || !isValidPath(outputPath)) {
            return { success: false, error: 'Invalid path' };
        }
        if (!crop || typeof crop.x !== 'number' || typeof crop.y !== 'number' ||
            typeof crop.width !== 'number' || typeof crop.height !== 'number') {
            return { success: false, error: 'Invalid crop parameters' };
        }
        return await ipcRenderer.invoke('native-crop', { inputPath, outputPath, crop });
    },

    // Check if native processing is available
    isNativeAvailable: async () => {
        const result = await ipcRenderer.invoke('native-available');
        return result.available;
    },

    // Native image compression (via Go)
    nativeCompress: async (inputPath, outputPath, quality = 85) => {
        if (!isValidPath(inputPath) || !isValidPath(outputPath)) {
            return { success: false, error: 'Invalid path' };
        }
        if (typeof quality !== 'number' || quality < 1 || quality > 100) {
            return { success: false, error: 'Invalid quality (1-100)' };
        }
        return await ipcRenderer.invoke('native-compress', { inputPath, outputPath, quality });
    },

    // Read .repic virtual image file
    readRepicFile: async (filePath) => {
        if (!isValidPath(filePath)) {
            return { success: false, error: 'Invalid file path' };
        }
        return await ipcRenderer.invoke('read-repic-file', filePath);
    },

    // Write .repic virtual image file
    writeRepicFile: async (filePath, data) => {
        if (!isValidPath(filePath)) {
            return { success: false, error: 'Invalid file path' };
        }
        return await ipcRenderer.invoke('write-repic-file', filePath, data);
    },

    // Batch export .repic files
    writeRepicFilesBatch: async (folderPath, files) => {
        if (!isValidPath(folderPath)) {
            return { success: false, error: 'Invalid folder path' };
        }
        return await ipcRenderer.invoke('write-repic-files-batch', { folderPath, files });
    },

    // Start drag operation (for dragging images to other apps)
    startDrag: async (imageSrc, fileName) => {
        if (!imageSrc || typeof imageSrc !== 'string') {
            return { success: false, error: 'Invalid image source' };
        }
        return await ipcRenderer.invoke('start-drag', { imageSrc, fileName });
    },

    // Pre-warm drag file cache (fire-and-forget, downloads HTTP URL to temp)
    prepareDragFile: (url) => {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return;
        ipcRenderer.send('prepare-drag-file', url);
    },

    // Proxy image download - bypass browser restrictions (for hotlink protected images)
    proxyImage: async (url) => {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return { success: false, error: 'Invalid URL' };
        }
        return await ipcRenderer.invoke('proxy-image', url);
    },

    // Proxy image using hidden browser window - for very strict sites (postimg, etc)
    proxyImageBrowser: async (url) => {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return { success: false, error: 'Invalid URL' };
        }
        return await ipcRenderer.invoke('proxy-image-browser', url);
    },

    // Set always on top
    setAlwaysOnTop: async (value) => {
        return await ipcRenderer.invoke('set-always-on-top', !!value);
    },

    // Get always on top status
    getAlwaysOnTop: async () => {
        return await ipcRenderer.invoke('get-always-on-top');
    },

    // Scrape images from webpage URL
    scrapeImages: async (url) => {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return { success: false, error: 'Invalid URL' };
        }
        return await ipcRenderer.invoke('scrape-images', url);
    },

    // Batch download images (uses Go for speed)
    batchDownloadImages: async (urls, outputDir, concurrency = 8) => {
        if (!Array.isArray(urls) || urls.length === 0) {
            return { success: false, error: 'No URLs provided' };
        }
        if (!outputDir || typeof outputDir !== 'string') {
            return { success: false, error: 'Invalid output directory' };
        }
        return await ipcRenderer.invoke('batch-download-images', { urls, outputDir, concurrency });
    },

    // Batch thumbnail generation (uses Go for speed)
    batchThumbnails: async (files, options = {}) => {
        if (!Array.isArray(files) || files.length === 0) {
            return { success: false, error: 'No files provided' };
        }
        const { outputDir, size = 200, concurrency = 8, base64 = true } = options;
        return await ipcRenderer.invoke('batch-thumbnails', { files, outputDir, size, concurrency, base64 });
    },

    // Streaming thumbnail generation - returns immediately, calls onProgress for each thumbnail
    batchThumbnailsStream: async (files, options = {}) => {
        if (!Array.isArray(files) || files.length === 0) {
            return { success: false, error: 'No files provided' };
        }
        const { size = 200, concurrency = 8, onProgress } = options;
        const requestId = `thumb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Set up listener for streaming results
        if (onProgress) {
            const handler = (_event, data) => {
                if (data.requestId === requestId && data.item) {
                    onProgress(data.item);
                }
            };
            ipcRenderer.on('thumbnail-ready', handler);

            // Return cleanup function
            setTimeout(() => {
                ipcRenderer.removeListener('thumbnail-ready', handler);
            }, 120000); // Auto-cleanup after 2 minutes
        }

        return await ipcRenderer.invoke('batch-thumbnails-stream', { files, size, concurrency, requestId });
    },

    // Listen for thumbnail stream events (alternative API)
    onThumbnailReady: (callback) => {
        ipcRenderer.on('thumbnail-ready', (_event, data) => callback(data));
    },

    // Remove thumbnail listener
    offThumbnailReady: (callback) => {
        ipcRenderer.removeListener('thumbnail-ready', callback);
    },

    // Prefetch images to local temp - streaming download
    prefetchImages: async (urls, options = {}) => {
        if (!Array.isArray(urls) || urls.length === 0) {
            return { success: false, error: 'No URLs provided' };
        }
        const { onProgress } = options;
        const requestId = `prefetch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Set up listener for streaming results
        if (onProgress) {
            const handler = (_event, data) => {
                if (data.requestId === requestId && data.item) {
                    onProgress(data.item);
                }
            };
            ipcRenderer.on('prefetch-ready', handler);

            // Auto-cleanup after 5 minutes
            setTimeout(() => {
                ipcRenderer.removeListener('prefetch-ready', handler);
            }, 300000);
        }

        return await ipcRenderer.invoke('prefetch-images', { urls, requestId });
    },

    // Listen for prefetch stream events
    onPrefetchReady: (callback) => {
        ipcRenderer.on('prefetch-ready', (_event, data) => callback(data));
    },

    // Remove background from image
    removeBackground: async (imageSrc) => {
        if (!imageSrc || typeof imageSrc !== 'string') {
            return { success: false, error: 'Invalid image source' };
        }
        return await ipcRenderer.invoke('remove-background', { imageSrc });
    },

    // Rename file
    renameFile: async (oldPath, newPath) => {
        if (!isValidPath(oldPath) || !isValidPath(newPath)) {
            return { success: false, error: 'Invalid path' };
        }
        return await ipcRenderer.invoke('rename-file', { oldPath, newPath });
    }
});
