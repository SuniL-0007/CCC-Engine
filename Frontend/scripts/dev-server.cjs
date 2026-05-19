const http = require('http');
const next = require('next');

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || 'localhost';
const app = next({ dev: true, dir: process.cwd(), hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http.createServer((request, response) => handle(request, response)).listen(port, hostname, () => {
      console.log(`ready http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
