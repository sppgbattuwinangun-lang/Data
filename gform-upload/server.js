const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(__dirname, 'submissions.json');

// Pastikan folder uploads ada
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Load data dari file (persisten)
let submissions = [];
if (fs.existsSync(DATA_FILE)) {
    try {
        submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        submissions = [];
    }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
}

function sanitize(name) {
    return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').trim() || 'tanpa_nama';
}

function mimeOf(ext) {
    return {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
    }[ext] || 'application/octet-stream';
}

function parseMultipart(buffer, boundary) {
    const parts = [];
    const bb = Buffer.from(`--${boundary}`);
    let start = buffer.indexOf(bb) + bb.length + 2;

    while (true) {
        const next = buffer.indexOf(bb, start);
        if (next === -1) break;
        const seg = buffer.slice(start, next - 2);
        const headerEnd = seg.indexOf('\r\n\r\n');
        const headers = seg.slice(0, headerEnd).toString();
        const body = seg.slice(headerEnd + 4);

        const nameMatch = headers.match(/name="([^"]+)"/);
        const fnMatch = headers.match(/filename="([^"]+)"/);

        parts.push({
            name: nameMatch ? nameMatch[1] : null,
            filename: fnMatch ? fnMatch[1] : null,
            data: body
        });
        start = next + bb.length + 2;
    }
    return parts;
}

function serveStatic(filename, res) {
    const filePath = path.join(__dirname, 'public', filename);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404); res.end('Not found'); return;
        }
        res.writeHead(200, { 'Content-Type': mimeOf(path.extname(filename)) });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // ===== Halaman =====
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return serveStatic('index.html', res);
    }
    if (req.method === 'GET' && url.pathname === '/admin') {
        return serveStatic('admin.html', res);
    }
    if (req.method === 'GET' && url.pathname === '/styles.css') {
        return serveStatic('styles.css', res);
    }
    if (req.method === 'GET' && url.pathname === '/app.js') {
        return serveStatic('app.js', res);
    }

    // ===== API: Submit form =====
    if (req.method === 'POST' && url.pathname === '/api/submit') {
        const ct = req.headers['content-type'] || '';
        const m = ct.match(/boundary=(.+)/);
        if (!m) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid request' }));
        }

        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            try {
                const buf = Buffer.concat(chunks);
                const parts = parseMultipart(buf, m[1]);

                let sekolah = '', fileData = null, originalName = '';
                for (const p of parts) {
                    if (p.name === 'nama_sekolah') sekolah = p.data.toString().trim();
                    else if (p.name === 'file') {
                        fileData = p.data;
                        originalName = p.filename;
                    }
                }

                if (!sekolah) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Nama sekolah wajib diisi' }));
                }
                if (!fileData || !originalName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'File wajib diunggah' }));
                }

                const ext = path.extname(originalName).toLowerCase();
                if (!['.pdf', '.jpg', '.jpeg'].includes(ext)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Format harus PDF/JPG/JPEG' }));
                }

                const id = randomUUID();
                const savedName = `${sanitize(sekolah)}_${Date.now()}${ext}`;
                fs.writeFileSync(path.join(UPLOAD_DIR, savedName), fileData);

                const sub = {
                    id,
                    namaSekolah: sekolah,
                    originalFilename: originalName,
                    savedFilename: savedName,
                    fileType: ext.slice(1).toUpperCase(),
                    size: fileData.length,
                    uploadDate: new Date().toISOString()
                };
                submissions.push(sub);
                saveData();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error(e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Terjadi kesalahan server' }));
            }
        });
        return;
    }

    // ===== API: List files =====
    if (req.method === 'GET' && url.pathname === '/api/files') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(submissions));
    }

    // ===== API: Download single =====
    if (req.method === 'GET' && url.pathname.startsWith('/api/download/')) {
        const id = url.pathname.slice('/api/download/'.length);
        const sub = submissions.find(s => s.id === id);
        if (!sub) {
            res.writeHead(404); return res.end('Not found');
        }
        const fp = path.join(UPLOAD_DIR, sub.savedFilename);
        if (!fs.existsSync(fp)) {
            res.writeHead(404); return res.end('File missing');
        }
        const dlName = `${sanitize(sub.namaSekolah)}_${sub.originalFilename}`;
        res.writeHead(200, {
            'Content-Type': mimeOf(path.extname(sub.savedFilename)),
            'Content-Disposition': `attachment; filename="${dlName}"`,
            'Content-Length': fs.statSync(fp).size
        });
        fs.createReadStream(fp).pipe(res);
        return;
    }

    // ===== API: Download all (TAR archive, no zip dependency) =====
    if (req.method === 'GET' && url.pathname === '/api/download-all') {
        if (submissions.length === 0) {
            res.writeHead(404); return res.end('Belum ada file');
        }
        // Buat TAR sederhana (USTAR format) — bisa dibuka dengan WinRAR/7-Zip/native macOS/Linux
        const tarChunks = [];

        function makeHeader(name, size) {
            const header = Buffer.alloc(512);
            header.write(name.slice(0, 100), 0);                 // name
            header.write('0000644 ', 100);                       // mode
            header.write('0000000 ', 108);                       // uid
            header.write('0000000 ', 116);                       // gid
            header.write(size.toString(8).padStart(11, '0') + ' ', 124); // size (octal)
            header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + ' ', 136); // mtime
            header.write('        ', 148);                       // checksum placeholder
            header.write('0', 156);                              // type (0 = file)
            header.write('ustar  ', 257);                        // magic
            // Calculate checksum
            let chksum = 0;
            for (let i = 0; i < 512; i++) chksum += header[i];
            header.write(chksum.toString(8).padStart(6, '0') + '\0 ', 148);
            return header;
        }

        for (const s of submissions) {
            const fp = path.join(UPLOAD_DIR, s.savedFilename);
            if (!fs.existsSync(fp)) continue;
            const data = fs.readFileSync(fp);
            const dlName = `${sanitize(s.namaSekolah)}_${s.originalFilename}`;
            tarChunks.push(makeHeader(dlName, data.length));
            tarChunks.push(data);
            // Pad to 512-byte block
            const pad = 512 - (data.length % 512);
            if (pad < 512) tarChunks.push(Buffer.alloc(pad));
        }
        // Two empty 512-byte blocks at end
        tarChunks.push(Buffer.alloc(1024));

        const tar = Buffer.concat(tarChunks);
        const tarName = `dokumen_sekolah_${new Date().toISOString().slice(0, 10)}.tar`;
        res.writeHead(200, {
            'Content-Type': 'application/x-tar',
            'Content-Disposition': `attachment; filename="${tarName}"`,
            'Content-Length': tar.length
        });
        res.end(tar);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log('');
    console.log('=========================================');
    console.log('  Form Upload Sekolah (GForm-style)');
    console.log('=========================================');
    console.log(`  Form     : http://localhost:${PORT}`);
    console.log(`  Admin    : http://localhost:${PORT}/admin`);
    console.log('=========================================');
});
