#!/usr/bin/env node

/**
 * Bundle Analyzer Script
 * Analyzes bundle sizes, dependencies, and optimization opportunities
 */

const fs = require('fs').promises;
const path = require('path');

class BundleAnalyzer {
    constructor(options = {}) {
        this.buildDir = options.buildDir || path.join(__dirname, '../dist');
        this.sourceDir = options.sourceDir || path.join(__dirname, '..');
        this.outputDir = options.outputDir || path.join(this.buildDir, 'analysis');
        this.thresholds = {
            maxBundleSize: 250 * 1024, // 250KB
            maxChunkSize: 150 * 1024,  // 150KB
            minCompressionRatio: 0.3,  // 30% compression
            ...options.thresholds
        };
    }

    async analyze() {
        console.log('🔍 Starting bundle analysis...');
        
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Analyze JavaScript bundles
            const jsAnalysis = await this.analyzeJavaScript();
            
            // Analyze CSS bundles
            const cssAnalysis = await this.analyzeCSS();
            
            // Analyze assets
            const assetAnalysis = await this.analyzeAssets();
            
            // Analyze dependencies
            const dependencyAnalysis = await this.analyzeDependencies();
            
            // Generate comprehensive report
            const report = this.generateReport(jsAnalysis, cssAnalysis, assetAnalysis, dependencyAnalysis);
            
            // Save and display results
            await this.saveReport(report);
            this.displayResults(report);
            
            return report;
            
        } catch (error) {
            console.error('❌ Bundle analysis failed:', error);
            throw error;
        }
    }

    async analyzeJavaScript() {
        console.log('⚡ Analyzing JavaScript bundles...');
        
        const jsDir = path.join(this.buildDir, 'js');
        const bundles = [];
        let totalSize = 0;
        
        try {
            const files = await fs.readdir(jsDir);
            
            for (const file of files) {
                if (file.endsWith('.js')) {
                    const filePath = path.join(jsDir, file);
                    const stats = await fs.stat(filePath);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    const analysis = await this.analyzeJSFile(content, file);
                    
                    bundles.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        content: analysis,
                        compression: await this.estimateCompression(content)
                    });
                    
                    totalSize += stats.size;
                }
            }
            
        } catch (error) {
            console.warn('⚠️ Could not analyze JavaScript bundles:', error.message);
        }
        
        return {
            bundles,
            totalSize,
            averageSize: bundles.length > 0 ? totalSize / bundles.length : 0,
            largest: bundles.sort((a, b) => b.size - a.size)[0],
            issues: this.findJSIssues(bundles)
        };
    }

    async analyzeJSFile(content, fileName) {
        const lines = content.split('\n');
        const analysis = {
            lines: lines.length,
            functions: (content.match(/function\s+\w+/g) || []).length,
            classes: (content.match(/class\s+\w+/g) || []).length,
            imports: (content.match(/import\s+.*?from/g) || []).length,
            exports: (content.match(/export\s+(default\s+|{.*?}|class|function|const|let|var)/g) || []).length,
            comments: (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length,
            strings: (content.match(/"[^"]*"|'[^']*'|`[^`]*`/g) || []).length,
            console: (content.match(/console\.(log|warn|error|info|debug)/g) || []).length,
            conditionals: (content.match(/\b(if|switch|while|for)\s*\(/g) || []).length,
            complexity: this.calculateCyclomaticComplexity(content)
        };
        
        // Check for specific patterns
        analysis.patterns = {
            hasES6: content.includes('=>') || content.includes('class '),
            hasAsync: content.includes('async ') || content.includes('await '),
            hasPromises: content.includes('Promise') || content.includes('.then('),
            hasEventListeners: content.includes('addEventListener'),
            hasLocalStorage: content.includes('localStorage') || content.includes('sessionStorage'),
            hasServiceWorker: content.includes('serviceWorker') || content.includes('navigator.serviceWorker')
        };
        
        return analysis;
    }

    calculateCyclomaticComplexity(content) {
        const complexityPatterns = [
            /\bif\s*\(/g,
            /\bwhile\s*\(/g,
            /\bfor\s*\(/g,
            /\bswitch\s*\(/g,
            /\bcase\s+/g,
            /\bcatch\s*\(/g,
            /\?\s*.*?\s*:/g, // ternary operator
            /&&/g,
            /\|\|/g
        ];
        
        let complexity = 1; // Base complexity
        
        for (const pattern of complexityPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    async analyzeCSS() {
        console.log('🎨 Analyzing CSS bundles...');
        
        const cssDir = path.join(this.buildDir, 'css');
        const bundles = [];
        let totalSize = 0;
        
        try {
            const files = await fs.readdir(cssDir);
            
            for (const file of files) {
                if (file.endsWith('.css')) {
                    const filePath = path.join(cssDir, file);
                    const stats = await fs.stat(filePath);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    const analysis = await this.analyzeCSSFile(content, file);
                    
                    bundles.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        content: analysis,
                        compression: await this.estimateCompression(content)
                    });
                    
                    totalSize += stats.size;
                }
            }
            
        } catch (error) {
            console.warn('⚠️ Could not analyze CSS bundles:', error.message);
        }
        
        return {
            bundles,
            totalSize,
            averageSize: bundles.length > 0 ? totalSize / bundles.length : 0,
            issues: this.findCSSIssues(bundles)
        };
    }

    async analyzeCSSFile(content, fileName) {
        const analysis = {
            lines: content.split('\n').length,
            rules: (content.match(/[^}]*{[^}]*}/g) || []).length,
            selectors: (content.match(/[^{,]+(?=\s*{)/g) || []).length,
            properties: (content.match(/[^:;]+:\s*[^:;]+;/g) || []).length,
            mediaQueries: (content.match(/@media[^{]+{[^{}]*({[^{}]*}[^{}]*)*}/g) || []).length,
            keyframes: (content.match(/@keyframes[^{]+{[^{}]*({[^{}]*}[^{}]*)*}/g) || []).length,
            imports: (content.match(/@import\s+[^;]+;/g) || []).length,
            comments: (content.match(/\/\*[\s\S]*?\*\//g) || []).length,
            colors: (content.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/g) || []).length
        };
        
        // Check for modern CSS features
        analysis.features = {
            hasFlexbox: content.includes('display: flex') || content.includes('display:flex'),
            hasGrid: content.includes('display: grid') || content.includes('display:grid'),
            hasCustomProperties: content.includes('--') && content.includes('var('),
            hasTransitions: content.includes('transition'),
            hasAnimations: content.includes('animation') || content.includes('@keyframes'),
            hasTransforms: content.includes('transform'),
            hasMediaQueries: analysis.mediaQueries > 0
        };
        
        return analysis;
    }

    async analyzeAssets() {
        console.log('🖼️ Analyzing static assets...');
        
        const assets = {
            images: [],
            icons: [],
            fonts: [],
            other: []
        };
        
        let totalSize = 0;
        
        try {
            const assetDirs = ['icons', 'assets'];
            
            for (const dir of assetDirs) {
                const dirPath = path.join(this.buildDir, dir);
                
                try {
                    const files = await fs.readdir(dirPath);
                    
                    for (const file of files) {
                        const filePath = path.join(dirPath, file);
                        const stats = await fs.stat(filePath);
                        const ext = path.extname(file).toLowerCase();
                        
                        const assetInfo = {
                            name: file,
                            path: filePath,
                            size: stats.size,
                            extension: ext
                        };
                        
                        totalSize += stats.size;
                        
                        if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
                            assets.images.push(assetInfo);
                        } else if (file.includes('icon') || ext === '.ico') {
                            assets.icons.push(assetInfo);
                        } else if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) {
                            assets.fonts.push(assetInfo);
                        } else {
                            assets.other.push(assetInfo);
                        }
                    }
                } catch (dirError) {
                    // Directory might not exist
                }
            }
            
        } catch (error) {
            console.warn('⚠️ Could not analyze assets:', error.message);
        }
        
        return {
            ...assets,
            totalSize,
            totalFiles: Object.values(assets).reduce((sum, arr) => sum + arr.length, 0),
            issues: this.findAssetIssues(assets)
        };
    }

    async analyzeDependencies() {
        console.log('📦 Analyzing dependencies...');
        
        try {
            const packagePath = path.join(this.sourceDir, 'package.json');
            const packageContent = await fs.readFile(packagePath, 'utf8');
            const packageJson = JSON.parse(packageContent);
            
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};
            
            return {
                production: Object.keys(dependencies).length,
                development: Object.keys(devDependencies).length,
                total: Object.keys(dependencies).length + Object.keys(devDependencies).length,
                list: {
                    production: dependencies,
                    development: devDependencies
                },
                issues: this.findDependencyIssues(dependencies, devDependencies)
            };
            
        } catch (error) {
            console.warn('⚠️ Could not analyze dependencies:', error.message);
            return {
                production: 0,
                development: 0,
                total: 0,
                list: { production: {}, development: {} },
                issues: []
            };
        }
    }

    findJSIssues(bundles) {
        const issues = [];
        
        for (const bundle of bundles) {
            // Check bundle size
            if (bundle.size > this.thresholds.maxBundleSize) {
                issues.push({
                    type: 'size',
                    severity: 'warning',
                    bundle: bundle.name,
                    message: `Bundle size ${this.formatBytes(bundle.size)} exceeds threshold ${this.formatBytes(this.thresholds.maxBundleSize)}`
                });
            }
            
            // Check compression ratio
            if (bundle.compression.ratio < this.thresholds.minCompressionRatio) {
                issues.push({
                    type: 'compression',
                    severity: 'info',
                    bundle: bundle.name,
                    message: `Low compression ratio: ${Math.round(bundle.compression.ratio * 100)}%`
                });
            }
            
            // Check for console statements in production
            if (bundle.content.console > 0) {
                issues.push({
                    type: 'debug',
                    severity: 'info',
                    bundle: bundle.name,
                    message: `${bundle.content.console} console statements found`
                });
            }
            
            // Check complexity
            if (bundle.content.complexity > 50) {
                issues.push({
                    type: 'complexity',
                    severity: 'warning',
                    bundle: bundle.name,
                    message: `High cyclomatic complexity: ${bundle.content.complexity}`
                });
            }
        }
        
        return issues;
    }

    findCSSIssues(bundles) {
        const issues = [];
        
        for (const bundle of bundles) {
            // Check for unused selectors (simplified)
            if (bundle.content.selectors > bundle.content.rules * 2) {
                issues.push({
                    type: 'unused',
                    severity: 'info',
                    bundle: bundle.name,
                    message: `Potentially unused selectors detected`
                });
            }
            
            // Check for missing modern features
            if (!bundle.content.features.hasFlexbox && !bundle.content.features.hasGrid) {
                issues.push({
                    type: 'modernization',
                    severity: 'info',
                    bundle: bundle.name,
                    message: `No modern layout methods detected`
                });
            }
        }
        
        return issues;
    }

    findAssetIssues(assets) {
        const issues = [];
        
        // Check for large images
        const largeImages = assets.images.filter(img => img.size > 100 * 1024); // 100KB
        if (largeImages.length > 0) {
            issues.push({
                type: 'optimization',
                severity: 'warning',
                message: `${largeImages.length} large images detected (>100KB)`
            });
        }
        
        // Check for missing WebP alternatives
        const hasWebP = assets.images.some(img => img.extension === '.webp');
        const hasLargeJPG = assets.images.some(img => 
            ['.jpg', '.jpeg'].includes(img.extension) && img.size > 50 * 1024
        );
        
        if (hasLargeJPG && !hasWebP) {
            issues.push({
                type: 'optimization',
                severity: 'info',
                message: 'Consider using WebP format for better compression'
            });
        }
        
        return issues;
    }

    findDependencyIssues(prod, dev) {
        const issues = [];
        
        // Check for development dependencies in production
        const suspiciousProd = Object.keys(prod).filter(dep => 
            dep.includes('test') || dep.includes('dev') || dep.includes('mock')
        );
        
        if (suspiciousProd.length > 0) {
            issues.push({
                type: 'dependency',
                severity: 'warning',
                message: `Potential dev dependencies in production: ${suspiciousProd.join(', ')}`
            });
        }
        
        return issues;
    }

    async estimateCompression(content) {
        // Simulate gzip compression estimation
        const originalSize = Buffer.byteLength(content, 'utf8');
        
        // Simple estimation: remove whitespace and estimate compression
        const minified = content.replace(/\s+/g, ' ').trim();
        const minifiedSize = Buffer.byteLength(minified, 'utf8');
        
        // Estimate gzip compression (typically 60-80% for text)
        const estimatedGzipSize = Math.round(minifiedSize * 0.3);
        
        return {
            original: originalSize,
            minified: minifiedSize,
            gzipped: estimatedGzipSize,
            ratio: (originalSize - estimatedGzipSize) / originalSize
        };
    }

    generateReport(js, css, assets, deps) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: js.bundles.length + css.bundles.length + assets.totalFiles,
                totalSize: js.totalSize + css.totalSize + assets.totalSize,
                issues: [
                    ...js.issues,
                    ...css.issues,
                    ...assets.issues,
                    ...deps.issues
                ],
                recommendations: []
            },
            javascript: js,
            css: css,
            assets: assets,
            dependencies: deps
        };
        
        // Generate recommendations
        if (js.largest && js.largest.size > this.thresholds.maxBundleSize) {
            report.summary.recommendations.push(`Consider code splitting for ${js.largest.name}`);
        }
        
        if (report.summary.issues.filter(i => i.type === 'optimization').length > 0) {
            report.summary.recommendations.push('Optimize images and assets for better performance');
        }
        
        if (js.bundles.some(b => b.content.console > 0)) {
            report.summary.recommendations.push('Remove console statements from production bundles');
        }
        
        return report;
    }

    async saveReport(report) {
        const reportPath = path.join(this.outputDir, 'bundle-analysis.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        // Generate visualization data
        const vizData = this.generateVisualizationData(report);
        const vizPath = path.join(this.outputDir, 'bundle-visualization.json');
        await fs.writeFile(vizPath, JSON.stringify(vizData, null, 2));
        
        // Generate HTML report
        const htmlReport = this.generateHTMLReport(report);
        const htmlPath = path.join(this.outputDir, 'bundle-analysis.html');
        await fs.writeFile(htmlPath, htmlReport);
        
        console.log(`📄 Bundle analysis reports saved to:`);
        console.log(`  JSON: ${reportPath}`);
        console.log(`  Visualization: ${vizPath}`);
        console.log(`  HTML: ${htmlPath}`);
    }

    generateVisualizationData(report) {
        return {
            bundles: [
                ...report.javascript.bundles.map(b => ({
                    name: b.name,
                    type: 'javascript',
                    size: b.size,
                    compressed: b.compression.gzipped
                })),
                ...report.css.bundles.map(b => ({
                    name: b.name,
                    type: 'css',
                    size: b.size,
                    compressed: b.compression.gzipped
                }))
            ],
            assets: [
                ...report.assets.images.map(a => ({ ...a, type: 'image' })),
                ...report.assets.icons.map(a => ({ ...a, type: 'icon' })),
                ...report.assets.fonts.map(a => ({ ...a, type: 'font' }))
            ],
            treemap: this.generateTreemapData(report)
        };
    }

    generateTreemapData(report) {
        const data = {
            name: 'Sudoku PWA',
            children: [
                {
                    name: 'JavaScript',
                    children: report.javascript.bundles.map(b => ({
                        name: b.name,
                        value: b.size
                    }))
                },
                {
                    name: 'CSS',
                    children: report.css.bundles.map(b => ({
                        name: b.name,
                        value: b.size
                    }))
                },
                {
                    name: 'Assets',
                    children: [
                        {
                            name: 'Images',
                            children: report.assets.images.map(a => ({
                                name: a.name,
                                value: a.size
                            }))
                        },
                        {
                            name: 'Icons',
                            children: report.assets.icons.map(a => ({
                                name: a.name,
                                value: a.size
                            }))
                        }
                    ]
                }
            ]
        };
        
        return data;
    }

    displayResults(report) {
        console.log('\n📊 Bundle Analysis Results');
        console.log('==========================');
        
        console.log(`\n📦 Summary:`);
        console.log(`  Total files: ${report.summary.totalFiles}`);
        console.log(`  Total size: ${this.formatBytes(report.summary.totalSize)}`);
        console.log(`  Issues found: ${report.summary.issues.length}`);
        
        if (report.javascript.bundles.length > 0) {
            console.log(`\n⚡ JavaScript Bundles:`);
            report.javascript.bundles.forEach(bundle => {
                const compressed = this.formatBytes(bundle.compression.gzipped);
                const original = this.formatBytes(bundle.size);
                const ratio = Math.round(bundle.compression.ratio * 100);
                console.log(`  ${bundle.name}: ${original} → ${compressed} (${ratio}% compression)`);
            });
        }
        
        if (report.css.bundles.length > 0) {
            console.log(`\n🎨 CSS Bundles:`);
            report.css.bundles.forEach(bundle => {
                const compressed = this.formatBytes(bundle.compression.gzipped);
                const original = this.formatBytes(bundle.size);
                console.log(`  ${bundle.name}: ${original} → ${compressed}`);
            });
        }
        
        if (report.assets.totalFiles > 0) {
            console.log(`\n🖼️ Assets:`);
            console.log(`  Images: ${report.assets.images.length} files (${this.formatBytes(report.assets.images.reduce((sum, img) => sum + img.size, 0))})`);
            console.log(`  Icons: ${report.assets.icons.length} files (${this.formatBytes(report.assets.icons.reduce((sum, icon) => sum + icon.size, 0))})`);
        }
        
        if (report.summary.issues.length > 0) {
            console.log(`\n❗ Issues Found:`);
            const grouped = report.summary.issues.reduce((acc, issue) => {
                acc[issue.severity] = acc[issue.severity] || [];
                acc[issue.severity].push(issue);
                return acc;
            }, {});
            
            Object.entries(grouped).forEach(([severity, issues]) => {
                console.log(`  ${severity.toUpperCase()}:`);
                issues.forEach(issue => {
                    console.log(`    • ${issue.message}`);
                });
            });
        }
        
        if (report.summary.recommendations.length > 0) {
            console.log(`\n💡 Recommendations:`);
            report.summary.recommendations.forEach(rec => {
                console.log(`  • ${rec}`);
            });
        }
    }

    generateHTMLReport(report) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bundle Analysis Report - Sudoku PWA</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .bundle-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            margin-bottom: 8px;
        }
        .bundle-size {
            font-weight: bold;
            color: #2196F3;
        }
        .issue-item {
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 8px;
            border-left: 4px solid;
        }
        .issue-warning {
            background: #fff3e0;
            border-color: #ff9800;
        }
        .issue-info {
            background: #e3f2fd;
            border-color: #2196f3;
        }
        .issue-error {
            background: #ffebee;
            border-color: #f44336;
        }
        .chart-container {
            height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            border-radius: 8px;
            margin: 20px 0;
        }
        .recommendations {
            background: #e8f5e8;
            border-left: 4px solid #4caf50;
            padding: 15px;
            margin-top: 20px;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
            text-align: center;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📦 Bundle Analysis Report</h1>
        <p>Sudoku PWA - ${new Date(report.timestamp).toLocaleString()}</p>
    </div>

    <div class="card">
        <h2>📊 Summary</h2>
        <div class="grid">
            <div>
                <h3>Overview</h3>
                <p><strong>Total Files:</strong> ${report.summary.totalFiles}</p>
                <p><strong>Total Size:</strong> ${this.formatBytes(report.summary.totalSize)}</p>
                <p><strong>Issues:</strong> ${report.summary.issues.length}</p>
            </div>
            <div>
                <h3>Breakdown</h3>
                <p><strong>JavaScript:</strong> ${report.javascript.bundles.length} bundles</p>
                <p><strong>CSS:</strong> ${report.css.bundles.length} bundles</p>
                <p><strong>Assets:</strong> ${report.assets.totalFiles} files</p>
            </div>
        </div>
    </div>

    <div class="grid">
        <div class="card">
            <h2>⚡ JavaScript Bundles</h2>
            ${report.javascript.bundles.map(bundle => `
                <div class="bundle-item">
                    <span>${bundle.name}</span>
                    <div>
                        <span class="bundle-size">${this.formatBytes(bundle.size)}</span>
                        <small>→ ${this.formatBytes(bundle.compression.gzipped)} gzipped</small>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="card">
            <h2>🎨 CSS Bundles</h2>
            ${report.css.bundles.map(bundle => `
                <div class="bundle-item">
                    <span>${bundle.name}</span>
                    <div>
                        <span class="bundle-size">${this.formatBytes(bundle.size)}</span>
                        <small>→ ${this.formatBytes(bundle.compression.gzipped)} gzipped</small>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    ${report.summary.issues.length > 0 ? `
    <div class="card">
        <h2>❗ Issues Found</h2>
        ${report.summary.issues.map(issue => `
            <div class="issue-item issue-${issue.severity}">
                <strong>${issue.type.toUpperCase()}:</strong> ${issue.message}
                ${issue.bundle ? `<br><small>Bundle: ${issue.bundle}</small>` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${report.summary.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>💡 Recommendations</h3>
        <ul>
            ${report.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="timestamp">
        Generated on ${new Date(report.timestamp).toLocaleString()}
    </div>
</body>
</html>
        `;
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
    const analyzer = new BundleAnalyzer();
    
    analyzer.analyze()
        .then(report => {
            console.log('\n✅ Bundle analysis completed successfully!');
            const hasIssues = report.summary.issues.some(i => i.severity === 'warning' || i.severity === 'error');
            process.exit(hasIssues ? 1 : 0);
        })
        .catch(error => {
            console.error('\n❌ Bundle analysis failed:', error);
            process.exit(1);
        });
}

module.exports = BundleAnalyzer;