const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// In-memory storage for uploaded files metadata
let uploadedFiles = [];

// Parse multipart form data
function parseMultipart(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundary = Buffer.from(`--${boundary}--`);

    let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2; // skip boundary + \r\n

    while (true) {
        const nextBoundary = buffer.indexOf(boundaryBuffer, start);
        if (nextBoundary === -1) break;

        const partData = buffer.slice(start, nextBoundary - 2); // -2 for \r\n before boundary
        const headerEnd = partData.indexOf('\r\n\r\n');
        const headers = partData.slice(0, headerEnd).toString();
        const body = partData.slice(headerEnd + 4);

        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*(.+)/i);

        parts.push({
            name: nameMatch ? nameMatch[1] : null,
            filename: filenameMatch ? filenameMatch[1] : null,
            contentType: contentTypeMatch ? contentTypeMatch[1].trim() : null,
            data: body
        });

        start = nextBoundary + boundaryBuffer.length + 2;
    }

    return parts;
}

// Sanitize filename
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').trim();
}

// Get MIME type
function getMimeType(ext) {
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    };
    return types[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Serve static files
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        const filePath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/styles.css') {
        const filePath = path.join(__dirname, 'public', 'styles.css');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/app.js') {
        const filePath = path.join(__dirname, 'public', 'app.js');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
        return;
    }

    // API: Upload file
    if (req.method === 'POST' && url.pathname === '/api/upload') {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)/);

        if (!boundaryMatch) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid content type' }));
            return;
        }

        const boundary = boundaryMatch[1];
        const chunks = [];

        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const parts = parseMultipart(buffer, boundary);

                let namaSekolah = '';
                let fileData = null;
                let originalFilename = '';
                let fileContentType = '';

                for (const part of parts) {
                    if (part.name === 'nama_sekolah') {
                        namaSekolah = part.data.toString().trim();
                    } else if (part.name === 'file') {
                        fileData = part.data;
                        originalFilename = part.filename;
                        fileContentType = part.contentType;
                    }
                }

                if (!namaSekolah) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Nama sekolah wajib diisi' }));
                    return;
                }

                if (!fileData || !originalFilename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'File wajib diunggah' }));
                    return;
                }

                // Validate file type
                const ext = path.extname(originalFilename).toLowerCase();
                if (!['.pdf', '.jpg', '.jpeg'].includes(ext)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Hanya file PDF dan JPG/JPEG yang diperbolehkan' }));
                    return;
                }

                // Create filename with school name
                const sanitizedSchool = sanitizeFilename(namaSekolah);
                const id = randomUUID();
                const newFilename = `${sanitizedSchool}_${Date.now()}${ext}`;
                const filePath = path.join(UPLOAD_DIR, newFilename);

                fs.writeFile(filePath, fileData, (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Gagal menyimpan file' }));
                        return;
                    }

                    const fileInfo = {
                        id,
                        namaSekolah,
                        originalFilename,
                        savedFilename: newFilename,
                        fileType: ext.replace('.', '').toUpperCase(),
                        contentType: fileContentType,
                        size: fileData.length,
                        uploadDate: new Date().toISOString()
                    };

                    uploadedFiles.push(fileInfo);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, file: fileInfo }));
                });
            } catch (error) {
                console.error('Upload error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Terjadi kesalahan saat upload' }));
            }
        });
        return;
    }

    // API: List uploaded files
    if (req.method === 'GET' && url.pathname === '/api/files') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(uploadedFiles));
        return;
    }

    // API: Download file
    if (req.method === 'GET' && url.pathname.startsWith('/api/download/')) {
        const fileId = url.pathname.replace('/api/download/', '');
        const fileInfo = uploadedFiles.find(f => f.id === fileId);

        if (!fileInfo) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File tidak ditemukan' }));
            return;
        }

        const filePath = path.join(UPLOAD_DIR, fileInfo.savedFilename);

        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File tidak ditemukan di server' }));
            return;
        }

        const downloadName = `${sanitizeFilename(fileInfo.namaSekolah)}_${fileInfo.originalFilename}`;
        const mimeType = getMimeType(path.extname(fileInfo.savedFilename));

        res.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${downloadName}"`,
            'Content-Length': fs.statSync(filePath).size
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
        return;
    }

    // API: Delete file
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/delete/')) {
        const fileId = url.pathname.replace('/api/delete/', '');
        const fileIndex = uploadedFiles.findIndex(f => f.id === fileId);

        if (fileIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File tidak ditemukan' }));
            return;
        }

        const fileInfo = uploadedFiles[fileIndex];
        const filePath = path.join(UPLOAD_DIR, fileInfo.savedFilename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        uploadedFiles.splice(fileIndex, 1);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'File berhasil dihapus' }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Upload Form Server berjalan di:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`========================================\n`);
});
