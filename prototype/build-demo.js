// Bundle the same working prototype into one offline HTML file for sharing.
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
const script = name => read(name).replace(/<\/script/gi, '<\\/script');
const html = read('index.html')
  .replace('  <link rel="stylesheet" href="app.css">', '<style>\n' + read('app.css') + '\n</style>')
  .replace('  <script defer src="core.js"></script>\n', '')
  .replace('  <script defer src="app.js"></script>\n', '')
  .replace('</body>', '<script>\n' + script('core.js') + '\n</script>\n<script>\n' + script('app.js') + '\n</script>\n</body>');
fs.writeFileSync(path.join(__dirname, 'ChatNote-demo.html'), html);
process.stdout.write('Built ChatNote-demo.html: offline, no external dependencies.\n');
