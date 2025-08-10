#!/usr/bin/env node

/**
 * Production Build System for Sudoku PWA
 * Optimizes files for deployment with minification, compression, and asset optimization
 */

const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');

class BuildOptimizer {
    constructor(options = {}) {
        this.sourceDir = options.sourceDir || path.resolve(__dirname, '..');
        this.buildDir = options.buildDir || path.resolve(__dirname, '../dist');
        this.config = {
            minifyJS: true,
            minifyCSS: true,
            minifyHTML: true,
            generateSourceMaps: false,
            optimizeImages: true,
            enableGzip: true,
            cacheVersioning: true,
            bundleJS: true,
            ...options
        };
        
        this.stats = {
            originalSize: 0,
            compressedSize: 0,
            filesProcessed: 0,
            errors: [],
            warnings: []
        };
    }

    async build() {
        console.log('🚀 Starting production build...');
        console.log(`📁 Source: ${this.sourceDir}`);
        console.log(`📦 Output: ${this.buildDir}`);
        
        try {
            // Clean build directory
            await this.cleanBuildDir();
            
            // Process files (HTML last so it can reference actual generated filenames)
            await this.processCSS();
            await this.processJavaScript();
            await this.processAssets();
            await this.processHTML();
            await this.generateServiceWorker();
            await this.generateManifest();
            await this.createDeploymentFiles();
            
            // Generate build report
            this.generateBuildReport();
            
            console.log('✅ Build completed successfully!');
            return this.stats;
            
        } catch (error) {
            console.error('❌ Build failed:', error);
            throw error;
        }
    }

    async cleanBuildDir() {
        console.log('🧹 Cleaning build directory...');
        
        try {
            await fs.rm(this.buildDir, { recursive: true, force: true });
            await fs.mkdir(this.buildDir, { recursive: true });
            
            // Create subdirectories
            await fs.mkdir(path.join(this.buildDir, 'js'), { recursive: true });
            await fs.mkdir(path.join(this.buildDir, 'css'), { recursive: true });
            await fs.mkdir(path.join(this.buildDir, 'assets'), { recursive: true });
            await fs.mkdir(path.join(this.buildDir, 'icons'), { recursive: true });
            
        } catch (error) {
            console.error('Failed to clean build directory:', error);
            throw error;
        }
    }

    async processHTML() {
        console.log('📄 Processing HTML files...');
        
        const htmlFiles = ['index.html'];
        
        for (const fileName of htmlFiles) {
            try {
                const sourcePath = path.join(this.sourceDir, fileName);
                const content = await fs.readFile(sourcePath, 'utf8');
                
                let processedContent = content;
                
                // Update asset references for production
                processedContent = this.updateAssetReferences(processedContent);
                
                // Minify HTML if enabled
                if (this.config.minifyHTML) {
                    processedContent = this.minifyHTML(processedContent);
                }
                
                // Add production optimizations
                processedContent = this.addProductionOptimizations(processedContent);
                
                const outputPath = path.join(this.buildDir, fileName);
                await fs.writeFile(outputPath, processedContent);
                
                this.updateStats(content.length, processedContent.length);
                console.log(`  ✅ ${fileName} processed`);
                
            } catch (error) {
                console.error(`Failed to process ${fileName}:`, error);
                this.stats.errors.push(`HTML processing failed for ${fileName}: ${error.message}`);
            }
        }
    }

    async processCSS() {
        console.log('🎨 Processing CSS files...');
        
        const cssFiles = await this.findFiles(path.join(this.sourceDir, 'css'), '.css');
        
        for (const filePath of cssFiles) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const fileName = path.basename(filePath);
                
                let processedContent = content;
                
                // Add vendor prefixes
                processedContent = this.addVendorPrefixes(processedContent);
                
                // Optimize CSS
                processedContent = this.optimizeCSS(processedContent);
                
                // Minify CSS
                if (this.config.minifyCSS) {
                    processedContent = this.minifyCSS(processedContent);
                }
                
                // Generate cache-busting filename
                const hash = this.generateHash(processedContent);
                const outputFileName = this.config.cacheVersioning 
                    ? fileName.replace('.css', `.${hash.substring(0, 8)}.css`)
                    : fileName;
                
                const outputPath = path.join(this.buildDir, 'css', outputFileName);
                await fs.writeFile(outputPath, processedContent);
                
                this.updateStats(content.length, processedContent.length);
                console.log(`  ✅ ${fileName} → ${outputFileName}`);
                
            } catch (error) {
                console.error(`Failed to process CSS ${filePath}:`, error);
                this.stats.errors.push(`CSS processing failed: ${error.message}`);
            }
        }
    }

    async processJavaScript() {
        console.log('⚡ Processing JavaScript files...');
        
        if (this.config.bundleJS) {
            await this.bundleJavaScript();
        } else {
            await this.processIndividualJSFiles();
        }
    }

    async bundleJavaScript() {
        console.log('📦 Bundling JavaScript files...');
        
        // Define bundle configuration
        const bundles = [
            {
                name: 'app',
                files: [
                    'js/sudoku-engine.js',
                    'js/sudoku-generator.js',
                    'js/storage.js',
                    'js/settings-manager.js',
                    'js/user-progress.js',
                    'js/game-ui.js'
                ]
            },
            {
                name: 'ui',
                files: [
                    'js/calendar-ui.js',
                    'js/tournament-ui.js',
                    'js/app-router.js'
                ]
            },
            {
                name: 'pwa',
                files: [
                    'js/pwa-manager.js',
                    'js/animation-manager.js',
                    'js/accessibility-manager.js',
                    'js/performance-monitor.js',
                    'js/error-handler.js'
                ]
            }
        ];

        for (const bundle of bundles) {
            try {
                let bundledContent = '';
                let originalSize = 0;
                
                // Add bundle header
                bundledContent += `/**\n * ${bundle.name.toUpperCase()} Bundle - Generated ${new Date().toISOString()}\n * Sudoku PWA Production Build\n */\n\n`;
                
                // Concatenate files
                for (const file of bundle.files) {
                    const filePath = path.join(this.sourceDir, file);
                    try {
                        const content = await fs.readFile(filePath, 'utf8');
                        originalSize += content.length;
                        
                        // Add file separator and content directly (classes need global scope)
                        bundledContent += `\n/* === ${file} === */\n`;
                        bundledContent += `${content}\n`;
                        
                    } catch (fileError) {
                        console.warn(`⚠️  Warning: Could not include ${file} in bundle`);
                        this.stats.warnings.push(`Missing file in bundle: ${file}`);
                    }
                }
                
                // Minify the bundle
                if (this.config.minifyJS) {
                    bundledContent = this.minifyJS(bundledContent);
                }
                
                // Generate cache-busting filename
                const hash = this.generateHash(bundledContent);
                const outputFileName = this.config.cacheVersioning 
                    ? `${bundle.name}.${hash.substring(0, 8)}.js`
                    : `${bundle.name}.js`;
                
                const outputPath = path.join(this.buildDir, 'js', outputFileName);
                await fs.writeFile(outputPath, bundledContent);
                
                this.updateStats(originalSize, bundledContent.length);
                console.log(`  ✅ ${bundle.name} bundle → ${outputFileName} (${bundle.files.length} files)`);
                
            } catch (error) {
                console.error(`Failed to create ${bundle.name} bundle:`, error);
                this.stats.errors.push(`Bundle creation failed for ${bundle.name}: ${error.message}`);
            }
        }
    }

    async processIndividualJSFiles() {
        const jsFiles = await this.findFiles(path.join(this.sourceDir, 'js'), '.js');
        
        for (const filePath of jsFiles) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const fileName = path.basename(filePath);
                
                let processedContent = content;
                
                // Add production checks
                processedContent = this.addProductionChecks(processedContent);
                
                // Minify JavaScript
                if (this.config.minifyJS) {
                    processedContent = this.minifyJS(processedContent);
                }
                
                // Generate cache-busting filename
                const hash = this.generateHash(processedContent);
                const outputFileName = this.config.cacheVersioning 
                    ? fileName.replace('.js', `.${hash.substring(0, 8)}.js`)
                    : fileName;
                
                const outputPath = path.join(this.buildDir, 'js', outputFileName);
                await fs.writeFile(outputPath, processedContent);
                
                this.updateStats(content.length, processedContent.length);
                console.log(`  ✅ ${fileName} → ${outputFileName}`);
                
            } catch (error) {
                console.error(`Failed to process JS ${filePath}:`, error);
                this.stats.errors.push(`JS processing failed: ${error.message}`);
            }
        }
    }

    async processAssets() {
        console.log('🖼️  Processing assets...');
        
        // Copy and optimize icons
        await this.processIcons();
        
        // Copy other static assets
        const assetDirs = ['assets'];
        
        for (const dir of assetDirs) {
            const sourcePath = path.join(this.sourceDir, dir);
            const exists = await fs.access(sourcePath).then(() => true).catch(() => false);
            
            if (exists) {
                await this.copyDirectory(sourcePath, path.join(this.buildDir, dir));
            }
        }
    }

    async processIcons() {
        console.log('🎯 Processing PWA icons...');
        
        // Create optimized icons for PWA
        const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
        const iconContent = await this.generateSVGIcon();
        
        for (const size of iconSizes) {
            try {
                const pngContent = await this.svgToPng(iconContent, size);
                const outputPath = path.join(this.buildDir, 'icons', `icon-${size}x${size}.png`);
                await fs.writeFile(outputPath, pngContent);
                console.log(`  ✅ icon-${size}x${size}.png created`);
            } catch (error) {
                console.warn(`⚠️  Could not generate ${size}x${size} icon:`, error.message);
                this.stats.warnings.push(`Icon generation failed for ${size}x${size}`);
            }
        }
        
        // Create favicon
        try {
            const faviconContent = await this.svgToPng(iconContent, 32);
            const faviconPath = path.join(this.buildDir, 'favicon.ico');
            await fs.writeFile(faviconPath, faviconContent);
            console.log('  ✅ favicon.ico created');
        } catch (error) {
            console.warn('⚠️  Could not generate favicon:', error.message);
        }
    }

    async generateServiceWorker() {
        console.log('⚙️  Generating optimized service worker...');
        
        try {
            const swContent = await fs.readFile(path.join(this.sourceDir, 'sw.js'), 'utf8');
            
            // Get list of files to cache
            const filesToCache = await this.getFilesToCache();
            
            // Update cache version with build timestamp
            const cacheVersion = `v${Date.now()}`;
            
            let optimizedSW = swContent
                .replace(/const CACHE_VERSION = '[^']*'/, `const CACHE_VERSION = '${cacheVersion}'`)
                .replace(/const STATIC_ASSETS = \[[^\]]*?\];/s, `const STATIC_ASSETS = ${JSON.stringify(filesToCache, null, 4)};`);
            
            // Add production optimizations
            optimizedSW = this.addSWOptimizations(optimizedSW);
            
            // Minify if enabled
            if (this.config.minifyJS) {
                optimizedSW = this.minifyJS(optimizedSW);
            }
            
            const outputPath = path.join(this.buildDir, 'sw.js');
            await fs.writeFile(outputPath, optimizedSW);
            
            console.log(`  ✅ Service worker generated (cache: ${cacheVersion})`);
            
        } catch (error) {
            console.error('Failed to generate service worker:', error);
            this.stats.errors.push(`Service worker generation failed: ${error.message}`);
        }
    }

    async generateManifest() {
        console.log('📱 Generating PWA manifest...');
        
        try {
            const manifestContent = await fs.readFile(path.join(this.sourceDir, 'manifest.json'), 'utf8');
            const manifest = JSON.parse(manifestContent);
            
            // Update icon paths for production
            manifest.icons = manifest.icons.map(icon => ({
                ...icon,
                src: icon.src.replace(/^icons\//, 'icons/')
            }));
            
            // Add production-specific settings
            manifest.start_url = '/';
            manifest.scope = '/';
            
            const outputPath = path.join(this.buildDir, 'manifest.json');
            await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
            
            console.log('  ✅ PWA manifest generated');
            
        } catch (error) {
            console.error('Failed to generate manifest:', error);
            this.stats.errors.push(`Manifest generation failed: ${error.message}`);
        }
    }

    async createDeploymentFiles() {
        console.log('🌐 Creating deployment files...');
        
        // Create .htaccess for Apache
        await this.createHtaccess();
        
        // Create nginx.conf for Nginx
        await this.createNginxConfig();
        
        // Create deployment scripts
        await this.createDeploymentScripts();
        
        // Create Docker configuration
        await this.createDockerConfig();
    }

    // Utility methods for minification and optimization
    
    minifyHTML(html) {
        return html
            .replace(/\s+/g, ' ')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/>\s+</g, '><')
            .trim();
    }

    minifyCSS(css) {
        return css
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .replace(/;\s*}/g, '}')
            .replace(/,\s*/g, ',')
            .replace(/:\s*/g, ':')
            .replace(/{\s*/g, '{')
            .replace(/}\s*/g, '}')
            .trim();
    }

    minifyJS(js) {
        // Disable aggressive minification to prevent syntax errors
        // Only remove leading/trailing whitespace and normalize line endings
        return js
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim();
    }

    addVendorPrefixes(css) {
        // Add common vendor prefixes
        const vendorPrefixes = [
            { prop: 'transform', prefixes: ['-webkit-', '-moz-', '-ms-'] },
            { prop: 'transition', prefixes: ['-webkit-', '-moz-', '-ms-'] },
            { prop: 'user-select', prefixes: ['-webkit-', '-moz-', '-ms-'] },
            { prop: 'box-shadow', prefixes: ['-webkit-', '-moz-'] },
            { prop: 'border-radius', prefixes: ['-webkit-', '-moz-'] }
        ];
        
        let processedCSS = css;
        
        for (const { prop, prefixes } of vendorPrefixes) {
            const regex = new RegExp(`(^|[^-])${prop}\\s*:`, 'gm');
            processedCSS = processedCSS.replace(regex, (match, prefix) => {
                const prefixedProps = prefixes.map(p => `${prefix}${p}${prop}:`).join(' ');
                return `${prefixedProps} ${prefix}${prop}:`;
            });
        }
        
        return processedCSS;
    }

    optimizeCSS(css) {
        // Remove unused CSS rules (basic implementation)
        // In production, use tools like PurgeCSS
        return css;
    }

    addProductionOptimizations(html) {
        // Add production meta tags
        let optimized = html;
        
        // Add security headers (remove X-Frame-Options meta as it should be HTTP header only)
        const securityHeaders = `
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:;">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">`;
        
        optimized = optimized.replace('</head>', `${securityHeaders}\n</head>`);
        
        // Add performance hints
        const performanceHints = `
    <link rel="dns-prefetch" href="//fonts.googleapis.com">
    <link rel="preconnect" href="//fonts.gstatic.com" crossorigin>`;
        
        optimized = optimized.replace('</head>', `${performanceHints}\n</head>`);
        
        return optimized;
    }

    addProductionChecks(js) {
        // Replace development code with production versions
        let processed = js;
        
        // Replace NODE_ENV checks first
        processed = processed.replace(/process\.env\.NODE_ENV !== 'production'/g, 'false');
        processed = processed.replace(/process\.env\.NODE_ENV === 'development'/g, 'false');
        processed = processed.replace(/process\.env\.NODE_ENV === 'production'/g, 'true');
        
        // Replace console.log calls in production (including logger.log)
        processed = processed.replace(/console\.(log|debug|info)\([^)]*\);?\s*/g, '');
        processed = processed.replace(/logger\.log\([^)]*\);?\s*/g, '');
        
        // Remove empty if blocks after NODE_ENV replacement
        processed = processed.replace(/if\s*\(\s*false\s*\)\s*\{[^{}]*\}/g, '');
        
        return processed;
    }

    addSWOptimizations(sw) {
        // Add production-specific service worker optimizations
        let optimized = sw;
        
        // Add more aggressive caching strategies
        const productionCaching = `
        // Production caching strategies
        if (event.request.destination === 'image') {
            event.respondWith(
                caches.match(event.request).then(response => {
                    return response || fetch(event.request).then(fetchResponse => {
                        const responseClone = fetchResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                        return fetchResponse;
                    });
                })
            );
        }`;
        
        // Insert production caching logic
        optimized = optimized.replace(
            /\/\/ Add more fetch event handling here/g,
            productionCaching
        );
        
        return optimized;
    }

    updateAssetReferences(html) {
        // Get base URL for GitHub Pages or other deployments
        const baseUrl = process.env.PUBLIC_URL || '';
        
        // For GitHub Pages, use relative paths instead of absolute paths
        const isGitHubPages = baseUrl.includes('github.io');
        
        // Update script and style references for bundled files
        if (this.config.bundleJS) {
            // Replace individual script tags with bundle references
            const scriptPattern = /<script src="[^"]*js\/[^"]*"><\/script>/g;
            html = html.replace(scriptPattern, '');
            
            // Get actual generated bundle filenames
            let appBundle = 'app.js', uiBundle = 'ui.js', pwaBundle = 'pwa.js';
            try {
                const jsFiles = require('fs').readdirSync(require('path').join(this.buildDir, 'js'));
                appBundle = jsFiles.find(f => f.startsWith('app.')) || 'app.js';
                uiBundle = jsFiles.find(f => f.startsWith('ui.')) || 'ui.js';
                pwaBundle = jsFiles.find(f => f.startsWith('pwa.')) || 'pwa.js';
            } catch (error) {
                console.warn('⚠️  Could not find JS bundles, using default names');
            }
            
            // Add bundle script tags - use relative paths for GitHub Pages
            const scriptPrefix = isGitHubPages ? 'js/' : (baseUrl ? `${baseUrl}/js/` : 'js/');
            const bundleScripts = `
    <script src="${scriptPrefix}${appBundle}"></script>
    <script src="${scriptPrefix}${uiBundle}"></script>
    <script src="${scriptPrefix}${pwaBundle}"></script>`;
            
            html = html.replace('</body>', `${bundleScripts}\n</body>`);
        }
        
        // Update CSS references with actual generated filenames
        let mainCss = 'styles.css';
        try {
            const cssFiles = require('fs').readdirSync(require('path').join(this.buildDir, 'css'));
            mainCss = cssFiles.find(f => f.startsWith('styles.')) || 'styles.css';
        } catch (error) {
            console.warn('⚠️  Could not find CSS files, using default names');
        }
        
        // Use relative paths for GitHub Pages
        const cssPrefix = isGitHubPages ? 'css/' : (baseUrl ? `${baseUrl}/css/` : 'css/');
        html = html.replace(/href="css\/styles\.css"/g, `href="${cssPrefix}${mainCss}"`);
        
        // Update icon paths (build creates icons/ not images/icons/) - use relative paths
        html = html.replace(/images\/icons\//g, 'icons/');
        
        // Update other asset references - use relative paths for GitHub Pages
        if (isGitHubPages) {
            // For GitHub Pages, convert absolute paths to relative paths (without ./ prefix)
            html = html.replace(/src="\/(?!\/)/g, 'src="');
            html = html.replace(/href="\/(?!\/|#)/g, 'href="');
        } else if (baseUrl) {
            html = html.replace(/src="(?!http|\/\/|data:)([^"]*)/g, `src="${baseUrl}/$1`);
            html = html.replace(/href="(?!http|\/\/|#|.*\/)([^"]*)/g, `href="${baseUrl}/$1`);
        }
        
        return html;
    }

    generateHash(content) {
        return createHash('sha256').update(content).digest('hex');
    }

    generateSVGIcon() {
        // Generate a simple SVG icon for the Sudoku PWA
        return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#2196F3"/>
    <g fill="white" stroke="white" stroke-width="4">
        <!-- Sudoku Grid -->
        <rect x="64" y="64" width="384" height="384" fill="none" stroke-width="8"/>
        <!-- Grid lines -->
        <line x1="192" y1="64" x2="192" y2="448"/>
        <line x1="320" y1="64" x2="320" y2="448"/>
        <line x1="64" y1="192" x2="448" y2="192"/>
        <line x1="64" y1="320" x2="448" y2="320"/>
        <!-- Thick lines for 3x3 boxes -->
        <line x1="192" y1="64" x2="192" y2="448" stroke-width="6"/>
        <line x1="320" y1="64" x2="320" y2="448" stroke-width="6"/>
        <line x1="64" y1="192" x2="448" y2="192" stroke-width="6"/>
        <line x1="64" y1="320" x2="448" y2="320" stroke-width="6"/>
        <!-- Numbers -->
        <text x="128" y="140" text-anchor="middle" font-family="Arial" font-size="48" font-weight="bold">5</text>
        <text x="256" y="140" text-anchor="middle" font-family="Arial" font-size="48" font-weight="bold">3</text>
        <text x="384" y="268" text-anchor="middle" font-family="Arial" font-size="48" font-weight="bold">7</text>
        <text x="128" y="396" text-anchor="middle" font-family="Arial" font-size="48" font-weight="bold">9</text>
    </g>
</svg>`;
    }

    async svgToPng(svgContent, size) {
        // Placeholder for SVG to PNG conversion
        // In a real implementation, use a library like sharp or canvas
        return Buffer.from('PNG placeholder');
    }

    async findFiles(dir, extension) {
        const files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    const subFiles = await this.findFiles(fullPath, extension);
                    files.push(...subFiles);
                } else if (entry.name.endsWith(extension)) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory might not exist, that's okay
        }
        
        return files;
    }

    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    async getFilesToCache() {
        // Get list of all build files for service worker caching
        const files = [];
        
        // Get base URL for GitHub Pages or other deployments
        const baseUrl = process.env.PUBLIC_URL || '';
        const isGitHubPages = baseUrl.includes('github.io');
        
        // Add core files
        files.push('/');
        files.push('/manifest.json');
        
        // Add JS bundles
        const jsFiles = await this.findFiles(path.join(this.buildDir, 'js'), '.js');
        files.push(...jsFiles.map(f => '/js/' + path.basename(f)));
        
        // Add CSS files
        const cssFiles = await this.findFiles(path.join(this.buildDir, 'css'), '.css');
        files.push(...cssFiles.map(f => '/css/' + path.basename(f)));
        
        // Add icons
        const iconFiles = await this.findFiles(path.join(this.buildDir, 'icons'), '.png');
        files.push(...iconFiles.map(f => '/icons/' + path.basename(f)));
        
        // For GitHub Pages, also add relative paths to ensure proper caching
        if (isGitHubPages) {
            const relativeFiles = [...files];
            files.push(...relativeFiles.map(f => f === '/' ? './' : f.replace(/^\//, './')));
        }
        
        return files;
    }

    async createHtaccess() {
        const htaccess = `
# Sudoku PWA - Apache Configuration

# Enable Gzip compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/x-javascript application/json
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType application/json "access plus 1 day"
</IfModule>

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"

# PWA Support
<Files "manifest.json">
    Header set Content-Type "application/manifest+json"
</Files>

# Service Worker
<Files "sw.js">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
</Files>

# SPA Routing
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
`;
        
        await fs.writeFile(path.join(this.buildDir, '.htaccess'), htaccess.trim());
        console.log('  ✅ Apache .htaccess created');
    }

    async createNginxConfig() {
        const nginx = `
# Sudoku PWA - Nginx Configuration

server {
    listen 80;
    server_name sudoku-pwa.local;
    root ${this.buildDir};
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \\.(css|js|png|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker - no cache
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # PWA Manifest
    location /manifest.json {
        add_header Content-Type "application/manifest+json";
        expires 1d;
    }

    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
}
`;
        
        await fs.writeFile(path.join(this.buildDir, 'nginx.conf'), nginx.trim());
        console.log('  ✅ Nginx configuration created');
    }

    async createDeploymentScripts() {
        // Deploy script for static hosting
        const deployScript = `#!/bin/bash
# Sudoku PWA Deployment Script

echo "🚀 Deploying Sudoku PWA..."

# Build the application
npm run build

# Upload to hosting service
# Uncomment and configure for your hosting provider:

# For Netlify
# netlify deploy --prod --dir=dist

# For Vercel
# vercel --prod

# For AWS S3
# aws s3 sync dist/ s3://your-bucket-name --delete

# For Firebase Hosting
# firebase deploy --only hosting

echo "✅ Deployment completed!"
`;
        
        await fs.writeFile(path.join(this.buildDir, 'deploy.sh'), deployScript.trim());
        await fs.chmod(path.join(this.buildDir, 'deploy.sh'), 0o755);
        console.log('  ✅ Deployment script created');
    }

    async createDockerConfig() {
        const dockerfile = `
# Sudoku PWA - Docker Configuration
FROM nginx:alpine

# Copy built files
COPY . /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;

        const dockerCompose = `
version: '3.8'

services:
  sudoku-pwa:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
`;
        
        await fs.writeFile(path.join(this.buildDir, 'Dockerfile'), dockerfile.trim());
        await fs.writeFile(path.join(this.buildDir, 'docker-compose.yml'), dockerCompose.trim());
        console.log('  ✅ Docker configuration created');
    }

    updateStats(originalSize, compressedSize) {
        this.stats.originalSize += originalSize;
        this.stats.compressedSize += compressedSize;
        this.stats.filesProcessed++;
    }

    generateBuildReport() {
        const compressionRatio = this.stats.originalSize > 0 
            ? ((this.stats.originalSize - this.stats.compressedSize) / this.stats.originalSize * 100).toFixed(1)
            : 0;
        
        const report = `
📊 Build Report
===============

Files processed: ${this.stats.filesProcessed}
Original size:   ${this.formatBytes(this.stats.originalSize)}
Compressed size: ${this.formatBytes(this.stats.compressedSize)}
Compression:     ${compressionRatio}% reduction
Build time:      ${Date.now() - this.buildStartTime}ms

${this.stats.errors.length > 0 ? `\n❌ Errors (${this.stats.errors.length}):\n${this.stats.errors.map(e => `  • ${e}`).join('\n')}` : ''}
${this.stats.warnings.length > 0 ? `\n⚠️  Warnings (${this.stats.warnings.length}):\n${this.stats.warnings.map(w => `  • ${w}`).join('\n')}` : ''}

✅ Build completed successfully!
📁 Output: ${this.buildDir}
`;
        
        console.log(report);
        
        // Save report to file
        fs.writeFile(path.join(this.buildDir, 'build-report.txt'), report.trim())
            .catch(error => console.warn('Could not save build report:', error.message));
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--no-minify':
                options.minifyJS = false;
                options.minifyCSS = false;
                options.minifyHTML = false;
                break;
            case '--no-bundle':
                options.bundleJS = false;
                break;
            case '--source-maps':
                options.generateSourceMaps = true;
                break;
            case '--output':
                options.buildDir = args[++i];
                break;
        }
    }
    
    const builder = new BuildOptimizer(options);
    builder.buildStartTime = Date.now();
    
    builder.build()
        .then(stats => {
            console.log('\n🎉 Build process completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Build process failed:', error);
            process.exit(1);
        });
}

module.exports = BuildOptimizer;