const fs = require('fs');

const appPath = './app.js';
let content = fs.readFileSync(appPath, 'utf8');

// Find the line "const app = express();" and add CORS fix after it
const corsFixCode = `

// ============================================
// CORS FIX FOR GITHUB CODESPACES
// ============================================
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow GitHub Codespaces and localhost
  if (origin && (origin.includes('.app.github.dev') || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

`;

// Replace after "const app = express();"
content = content.replace(
  'const app = express();',
  'const app = express();' + corsFixCode
);

// Comment out the old CORS middleware to avoid conflicts
content = content.replace(
  "app.use(cors(corsOptions));",
  "// app.use(cors(corsOptions)); // Disabled - using custom CORS handler above"
);

content = content.replace(
  "app.options('*', cors(corsOptions));",
  "// app.options('*', cors(corsOptions)); // Disabled - using custom CORS handler above"
);

fs.writeFileSync(appPath, content);
console.log('✅ CORS fix applied successfully!');
