const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE));
  } catch (err) {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

let users = loadUsers();

function renderLogin() {
  return `<!DOCTYPE html>
<html>
<head><title>Login</title></head>
<body>
  <h1>Login</h1>
  <form method="POST" action="/login">
    <label>Username: <input name="username"></label><br>
    <label>Password: <input type="password" name="password"></label><br>
    <input type="submit" value="Login">
  </form>
</body>
</html>`;
}

function renderUpload() {
  return `<!DOCTYPE html>
<html>
<head><title>Upload</title></head>
<body>
  <h1>Upload Content</h1>
  <form method="POST" enctype="multipart/form-data" action="/upload">
    <input type="file" name="file"><br>
    <input type="submit" value="Upload">
  </form>
</body>
</html>`;
}

function renderHome(username) {
  return `<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <h1>Welcome ${username}</h1>
  <ul>
    <li><a href="/upload">Upload Content (coach only)</a></li>
    <li><a href="/content">View Content</a></li>
  </ul>
</body>
</html>`;
}

function parseBody(req, cb) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => cb(querystring.parse(body)));
}

function auth(req) {
  const cookie = req.headers['cookie'];
  if (cookie) {
    const session = cookie.split('=')[1];
    if (session && users[session]) {
      return users[session];
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.url === '/login' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(renderLogin());
  } else if (req.url === '/login' && req.method === 'POST') {
    parseBody(req, body => {
      const { username, password } = body;
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      let user = Object.values(users).find(u => u.username === username && u.password === hash);
      if (user) {
        res.writeHead(302, {
          'Set-Cookie': `session=${user.session}`,
          'Location': '/'
        });
        res.end();
      } else {
        res.writeHead(401);
        res.end('Invalid credentials');
      }
    });
  } else if (req.url === '/upload' && req.method === 'GET') {
    const user = auth(req);
    if (user && user.role === 'coach') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(renderUpload());
    } else {
      res.writeHead(403);
      res.end('Forbidden');
    }
  } else if (req.url === '/upload' && req.method === 'POST') {
    const user = auth(req);
    if (user && user.role === 'coach') {
      const filename = req.headers["x-filename"];
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => {
        if (!filename) { res.writeHead(400); res.end("Missing X-Filename"); return; }
        fs.writeFileSync(path.join(UPLOAD_DIR, path.basename(filename)), Buffer.concat(chunks));
        res.writeHead(200);
        res.end("Uploaded");
      });
    } else {
      res.writeHead(403);
      res.end('Forbidden');
    }
  } else if (req.url === '/content' && req.method === 'GET') {
    const user = auth(req);
    if (user && user.membership) {
      fs.readdir(UPLOAD_DIR, (err, files) => {
        const list = files.map(f => `<li><a href="/uploads/${f}">${f}</a></li>`).join('');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<ul>${list}</ul>`);
      });
    } else {
      res.writeHead(403);
      res.end('Membership required');
    }
  } else if (req.url.startsWith('/uploads/')) {
    const file = path.join(UPLOAD_DIR, path.basename(req.url));
    fs.readFile(file, (err, content) => {
      if (err) {
        res.writeHead(404); res.end('Not found');
      } else {
        res.writeHead(200);
        res.end(content);
      }
    });
  } else if (req.url === '/' && req.method === 'GET') {
    const user = auth(req);
    if (user) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(renderHome(user.username));
    } else {
      res.writeHead(302, { 'Location': '/login' });
      res.end();
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000, () => console.log('Server running on port 3000'));
