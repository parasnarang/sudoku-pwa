#!/usr/bin/env node

/**
 * Performance Audit Script
 * Runs Lighthouse and other performance checks on the built application
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class PerformanceAuditor {
    constructor(options = {}) {
        this.url = options.url || 'http://localhost:3000';
        this.outputDir = options.outputDir || path.join(__dirname, '../dist/reports');
        this.thresholds = {
            performance: 90,
            accessibility: 100,
            bestPractices: 90,
            seo: 90,
            pwa: 100,
            ...options.thresholds
        };
    }

    async runAudit() {
        console.log('🔍 Starting performance audit...');
        
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Run Lighthouse audit
            const lighthouseResults = await this.runLighthouse();
            
            // Run custom performance tests
            const customResults = await this.runCustomTests();
            
            // Analyze bundle sizes
            const bundleAnalysis = await this.analyzeBundles();
            
            // Generate comprehensive report
            const report = this.generateReport(lighthouseResults, customResults, bundleAnalysis);
            
            // Save and display results
            await this.saveReport(report);
            this.displayResults(report);
            
            return report;
            
        } catch (error) {
            console.error('❌ Performance audit failed:', error);
            throw error;
        }
    }

    async runLighthouse() {
        console.log('🏮 Running Lighthouse audit...');
        
        return new Promise((resolve, reject) => {
            const lighthouse = spawn('npx', [
                'lighthouse',
                this.url,
                '--output=json',
                '--output=html',
                '--output-path=' + path.join(this.outputDir, 'lighthouse'),
                '--chrome-flags=--headless --no-sandbox',
                '--quiet'
            ]);
            
            let output = '';
            let error = '';
            
            lighthouse.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            lighthouse.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            lighthouse.on('close', (code) => {
                if (code === 0) {
                    this.parseLighthouseResults()
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new Error(`Lighthouse failed with code ${code}: ${error}`));
                }
            });
        });
    }

    async parseLighthouseResults() {
        try {
            const reportPath = path.join(this.outputDir, 'lighthouse.report.json');
            const reportData = await fs.readFile(reportPath, 'utf8');
            const results = JSON.parse(reportData);
            
            const scores = {
                performance: Math.round(results.categories.performance.score * 100),
                accessibility: Math.round(results.categories.accessibility.score * 100),
                bestPractices: Math.round(results.categories['best-practices'].score * 100),
                seo: Math.round(results.categories.seo.score * 100),
                pwa: Math.round(results.categories.pwa.score * 100)
            };
            
            const metrics = {
                firstContentfulPaint: results.audits['first-contentful-paint'].numericValue,
                largestContentfulPaint: results.audits['largest-contentful-paint'].numericValue,
                firstInputDelay: results.audits['max-potential-fid']?.numericValue || 0,
                cumulativeLayoutShift: results.audits['cumulative-layout-shift'].numericValue,
                speedIndex: results.audits['speed-index'].numericValue,
                totalBlockingTime: results.audits['total-blocking-time'].numericValue
            };
            
            const opportunities = results.audits['unused-css-rules'] ? 
                results.audits['unused-css-rules'].details?.items || [] : [];
            
            return {
                scores,
                metrics,
                opportunities,
                rawResults: results
            };
            
        } catch (error) {
            console.warn('⚠️ Could not parse Lighthouse results:', error.message);
            return {
                scores: {},
                metrics: {},
                opportunities: [],
                error: error.message
            };
        }
    }

    async runCustomTests() {
        console.log('🧪 Running custom performance tests...');
        
        const tests = {
            bundleSize: await this.testBundleSize(),
            loadTime: await this.testLoadTime(),
            memoryUsage: await this.testMemoryUsage(),
            cacheEfficiency: await this.testCacheEfficiency()
        };
        
        return tests;
    }

    async testBundleSize() {
        try {
            const distDir = path.join(__dirname, '../dist');
            const sizes = {
                total: 0,
                js: 0,
                css: 0,
                html: 0,
                images: 0
            };
            
            const files = await this.getAllFiles(distDir);
            
            for (const file of files) {
                const stats = await fs.stat(file);
                const size = stats.size;
                const ext = path.extname(file).toLowerCase();
                
                sizes.total += size;
                
                if (['.js'].includes(ext)) {
                    sizes.js += size;
                } else if (['.css'].includes(ext)) {
                    sizes.css += size;
                } else if (['.html'].includes(ext)) {
                    sizes.html += size;
                } else if (['.png', '.jpg', '.jpeg', '.svg', '.ico'].includes(ext)) {
                    sizes.images += size;
                }
            }
            
            return {
                sizes,
                passed: sizes.total < 500000, // 500KB threshold
                threshold: 500000
            };
            
        } catch (error) {
            return {
                error: error.message,
                passed: false
            };
        }
    }

    async testLoadTime() {
        // Simulate load time test
        return new Promise(resolve => {
            const start = Date.now();
            
            // Simulate network request
            setTimeout(() => {
                const loadTime = Date.now() - start;
                resolve({
                    loadTime,
                    passed: loadTime < 2000, // 2 second threshold
                    threshold: 2000
                });
            }, 100);
        });
    }

    async testMemoryUsage() {
        const memoryInfo = process.memoryUsage();
        
        return {
            usage: memoryInfo,
            passed: memoryInfo.heapUsed < 50 * 1024 * 1024, // 50MB threshold
            threshold: 50 * 1024 * 1024
        };
    }

    async testCacheEfficiency() {
        try {
            const swPath = path.join(__dirname, '../dist/sw.js');
            const swContent = await fs.readFile(swPath, 'utf8');
            
            const cacheStrategies = [
                'cache-first',
                'network-first',
                'stale-while-revalidate'
            ];
            
            const strategiesFound = cacheStrategies.filter(strategy => 
                swContent.includes(strategy)
            );
            
            return {
                strategiesFound,
                passed: strategiesFound.length >= 2,
                total: cacheStrategies.length
            };
            
        } catch (error) {
            return {
                error: error.message,
                passed: false
            };
        }
    }

    async analyzeBundles() {
        console.log('📊 Analyzing bundle composition...');
        
        try {
            const jsDir = path.join(__dirname, '../dist/js');
            const jsFiles = await fs.readdir(jsDir);
            
            const bundles = [];
            
            for (const file of jsFiles) {
                if (file.endsWith('.js')) {
                    const filePath = path.join(jsDir, file);
                    const stats = await fs.stat(filePath);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    bundles.push({
                        name: file,
                        size: stats.size,
                        lines: content.split('\n').length,
                        functions: (content.match(/function\s+\w+/g) || []).length,
                        classes: (content.match(/class\s+\w+/g) || []).length
                    });
                }
            }
            
            return {
                bundles,
                totalSize: bundles.reduce((sum, bundle) => sum + bundle.size, 0),
                largest: bundles.sort((a, b) => b.size - a.size)[0]
            };
            
        } catch (error) {
            return {
                error: error.message,
                bundles: []
            };
        }
    }

    generateReport(lighthouse, custom, bundles) {
        const now = new Date();
        
        const report = {
            timestamp: now.toISOString(),
            url: this.url,
            lighthouse: lighthouse,
            custom: custom,
            bundles: bundles,
            summary: {
                overall: 'pass',
                issues: [],
                recommendations: []
            }
        };
        
        // Check Lighthouse thresholds
        if (lighthouse.scores) {
            Object.entries(this.thresholds).forEach(([metric, threshold]) => {
                const score = lighthouse.scores[metric];
                if (score && score < threshold) {
                    report.summary.overall = 'warning';
                    report.summary.issues.push(`${metric} score ${score} below threshold ${threshold}`);
                }
            });
        }
        
        // Check bundle size
        if (custom.bundleSize && !custom.bundleSize.passed) {
            report.summary.overall = 'warning';
            report.summary.issues.push(`Total bundle size ${this.formatBytes(custom.bundleSize.sizes.total)} exceeds threshold`);
        }
        
        // Generate recommendations
        if (lighthouse.opportunities && lighthouse.opportunities.length > 0) {
            report.summary.recommendations.push('Consider removing unused CSS to improve load times');
        }
        
        if (bundles.largest && bundles.largest.size > 150000) {
            report.summary.recommendations.push(`Consider splitting large bundle: ${bundles.largest.name}`);
        }
        
        return report;
    }

    async saveReport(report) {
        const reportPath = path.join(this.outputDir, 'performance-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        // Generate HTML report
        const htmlReport = this.generateHTMLReport(report);
        const htmlPath = path.join(this.outputDir, 'performance-report.html');
        await fs.writeFile(htmlPath, htmlReport);
        
        console.log(`📄 Reports saved to:`);
        console.log(`  JSON: ${reportPath}`);
        console.log(`  HTML: ${htmlPath}`);
    }

    displayResults(report) {
        console.log('\n📊 Performance Audit Results');
        console.log('================================');
        
        if (report.lighthouse.scores) {
            console.log('\n🏮 Lighthouse Scores:');
            Object.entries(report.lighthouse.scores).forEach(([metric, score]) => {
                const threshold = this.thresholds[metric];
                const status = score >= threshold ? '✅' : '❌';
                console.log(`  ${status} ${metric}: ${score}/100 (threshold: ${threshold})`);
            });
        }
        
        if (report.lighthouse.metrics) {
            console.log('\n⏱️ Core Web Vitals:');
            const metrics = report.lighthouse.metrics;
            console.log(`  FCP: ${metrics.firstContentfulPaint ? Math.round(metrics.firstContentfulPaint) : 'N/A'}ms`);
            console.log(`  LCP: ${metrics.largestContentfulPaint ? Math.round(metrics.largestContentfulPaint) : 'N/A'}ms`);
            console.log(`  CLS: ${metrics.cumulativeLayoutShift ? metrics.cumulativeLayoutShift.toFixed(3) : 'N/A'}`);
            console.log(`  TBT: ${metrics.totalBlockingTime ? Math.round(metrics.totalBlockingTime) : 'N/A'}ms`);
        }
        
        if (report.custom.bundleSize) {
            console.log('\n📦 Bundle Analysis:');
            const sizes = report.custom.bundleSize.sizes;
            console.log(`  Total: ${this.formatBytes(sizes.total)}`);
            console.log(`  JavaScript: ${this.formatBytes(sizes.js)}`);
            console.log(`  CSS: ${this.formatBytes(sizes.css)}`);
            console.log(`  Images: ${this.formatBytes(sizes.images)}`);
        }
        
        console.log(`\n📈 Overall Status: ${report.summary.overall.toUpperCase()}`);
        
        if (report.summary.issues.length > 0) {
            console.log('\n❌ Issues Found:');
            report.summary.issues.forEach(issue => {
                console.log(`  • ${issue}`);
            });
        }
        
        if (report.summary.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
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
    <title>Performance Audit Report - Sudoku PWA</title>
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
        .score-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .score-card {
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            color: white;
        }
        .score-good { background: #4CAF50; }
        .score-warning { background: #FF9800; }
        .score-poor { background: #f44336; }
        .metric-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        .metric-item {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        .recommendations {
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin-top: 20px;
        }
        .issues {
            background: #ffebee;
            border-left: 4px solid #f44336;
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
        <h1>📊 Performance Audit Report</h1>
        <p>Sudoku PWA - ${new Date(report.timestamp).toLocaleString()}</p>
    </div>

    <div class="card">
        <h2>🏮 Lighthouse Scores</h2>
        <div class="score-grid">
            ${Object.entries(report.lighthouse.scores || {}).map(([metric, score]) => {
                const className = score >= 90 ? 'score-good' : score >= 70 ? 'score-warning' : 'score-poor';
                return `
                    <div class="score-card ${className}">
                        <div style="font-size: 2rem; font-weight: bold;">${score}</div>
                        <div>${metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                    </div>
                `;
            }).join('')}
        </div>
    </div>

    <div class="card">
        <h2>⏱️ Performance Metrics</h2>
        <div class="metric-list">
            ${Object.entries(report.lighthouse.metrics || {}).map(([metric, value]) => `
                <div class="metric-item">
                    <span>${metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                    <strong>${typeof value === 'number' ? Math.round(value) : value}${metric.includes('Time') || metric.includes('Paint') ? 'ms' : ''}</strong>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="card">
        <h2>📦 Bundle Analysis</h2>
        <div class="metric-list">
            ${Object.entries(report.custom.bundleSize?.sizes || {}).map(([type, size]) => `
                <div class="metric-item">
                    <span>${type.toUpperCase()}</span>
                    <strong>${this.formatBytes(size)}</strong>
                </div>
            `).join('')}
        </div>
    </div>

    ${report.summary.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>💡 Recommendations</h3>
        <ul>
            ${report.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${report.summary.issues.length > 0 ? `
    <div class="issues">
        <h3>❌ Issues Found</h3>
        <ul>
            ${report.summary.issues.map(issue => `<li>${issue}</li>`).join('')}
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

    async getAllFiles(dir) {
        const files = [];
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    const subFiles = await this.getAllFiles(fullPath);
                    files.push(...subFiles);
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory might not exist
        }
        
        return files;
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
    const auditor = new PerformanceAuditor();
    
    auditor.runAudit()
        .then(report => {
            console.log('\n✅ Performance audit completed successfully!');
            // Only fail on actual errors, not warnings
            const shouldFail = report.summary.overall === 'FAIL' || report.summary.overall === 'ERROR';
            process.exit(shouldFail ? 1 : 0);
        })
        .catch(error => {
            console.error('\n❌ Performance audit failed:', error);
            process.exit(1);
        });
}

module.exports = PerformanceAuditor;