const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'dans.html', 'film.html', 'muziek.html', 'schilderkunst.html', 'styles.css', 'script.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { res.writeHead(400).end('Ongeldig adres'); return; }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  if (!files.has(name)) { res.writeHead(404).end('Niet gevonden'); return; }
  fs.readFile(path.join(__dirname, name), (error, data) => {
    if (error) { res.writeHead(500).end('Bestand niet beschikbaar'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'Poort 3000 is al in gebruik. Stop de andere server en probeer opnieuw.' : error.message);
  process.exitCode = 1;
});
server.listen(3000, '127.0.0.1', () => console.log('Portfolio: http://127.0.0.1:3000 (stoppen: Ctrl+C)'));