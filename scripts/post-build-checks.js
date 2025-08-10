#!/usr/bin/env node

/**
 * Post-Build Validation Script
 * Runs after build completion to validate the output
 */

const fs = require('fs');
const path = require('path');

class PostBuildChecker {
    constructor(options = {}) {
        this.buildDir = options.buildDir || path.resolve(__dirname, '../dist');
        this.checks = {
            passed: 0,
            failed: 0,
            warnings: 0,
            issues: []
        };
    }

    async run() {
        console.log('🔍 Running post-build validation checks...\n');

        try {
            // Core file checks
            await this.checkCoreFiles();
            
            // Bundle integrity checks
            await this.checkBundles();
            
            // PWA requirements
            await this.checkPWAFiles();
            
            // Asset optimization
            await this.checkAssets();
            
            // Generate report
            this.generateReport();
            
            // Exit with appropriate code
            const hasCriticalIssues = this.checks.issues.some(issue => issue.severity === 'error');
            process.exit(hasCriticalIssues ? 1 : 0);
            
        } catch (error) {
            console.error('❌ Post-build checks failed:', error);
            process.exit(1);
        }
    }

    async checkCoreFiles() {
        console.log('📄 Checking core files...');
        
        const requiredFiles = [
            'index.html',
            'manifest.json',
            'sw.js'
        ];

        for (const file of requiredFiles) {
            const filePath = path.join(this.buildDir, file);
            
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                
                if (stats.size === 0) {
                    this.addIssue('error', `${file} is empty`);
                } else {
                    this.checks.passed++;
                    console.log(`  ✅ ${file} (${this.formatBytes(stats.size)})`);
                }
            } else {
                this.addIssue('error', `Required file missing: ${file}`);
            }
        }
    }

    async checkBundles() {
        console.log('\n📦 Checking JavaScript bundles...');
        
        const jsDir = path.join(this.buildDir, 'js');
        
        if (!fs.existsSync(jsDir)) {
            this.addIssue('error', 'JavaScript bundle directory missing');
            return;
        }

        const jsFiles = fs.readdirSync(jsDir).filter(file => file.endsWith('.js'));
        
        if (jsFiles.length === 0) {
            this.addIssue('error', 'No JavaScript bundles found');
            return;
        }

        let totalJSSize = 0;
        
        for (const file of jsFiles) {
            const filePath = path.join(jsDir, file);
            const stats = fs.statSync(filePath);
            totalJSSize += stats.size;
            
            console.log(`  ✅ ${file} (${this.formatBytes(stats.size)})`);
            this.checks.passed++;
            
            // Check bundle size limits
            if (stats.size > 250 * 1024) { // 250KB
                this.addIssue('warning', `Large bundle detected: ${file} (${this.formatBytes(stats.size)})`);
            }
        }

        console.log(`  📊 Total JS size: ${this.formatBytes(totalJSSize)}`);
        
        // Check total JS size
        if (totalJSSize > 500 * 1024) { // 500KB
            this.addIssue('warning', `Total JavaScript size is large: ${this.formatBytes(totalJSSize)}`);
        }
    }

    async checkPWAFiles() {
        console.log('\n📱 Checking PWA requirements...');
        
        // Check manifest
        const manifestPath = path.join(this.buildDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                
                const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
                const missingFields = requiredFields.filter(field => !manifest[field]);
                
                if (missingFields.length === 0) {
                    console.log('  ✅ Manifest has all required fields');
                    this.checks.passed++;
                } else {
                    this.addIssue('warning', `Manifest missing fields: ${missingFields.join(', ')}`);
                }
            } catch (error) {
                this.addIssue('error', 'Manifest is not valid JSON');
            }
        }
        
        // Check service worker
        const swPath = path.join(this.buildDir, 'sw.js');
        if (fs.existsSync(swPath)) {
            const swContent = fs.readFileSync(swPath, 'utf8');
            
            const requiredFeatures = ['install', 'activate', 'fetch'];
            const missingFeatures = requiredFeatures.filter(feature => 
                !swContent.includes(`addEventListener('${feature}`)
            );
            
            if (missingFeatures.length === 0) {
                console.log('  ✅ Service Worker has required event listeners');
                this.checks.passed++;
            } else {
                this.addIssue('warning', `Service Worker missing listeners: ${missingFeatures.join(', ')}`);
            }
        }
        
        // Check icons
        const iconsDir = path.join(this.buildDir, 'icons');
        if (fs.existsSync(iconsDir)) {
            const iconFiles = fs.readdirSync(iconsDir).filter(file => file.endsWith('.png'));
            
            if (iconFiles.length >= 8) { // Should have multiple sizes
                console.log(`  ✅ ${iconFiles.length} PWA icons generated`);
                this.checks.passed++;
            } else {
                this.addIssue('warning', `Only ${iconFiles.length} PWA icons found, expected 8+`);
            }
        } else {
            this.addIssue('warning', 'PWA icons directory missing');
        }
    }

    async checkAssets() {
        console.log('\n🖼️ Checking assets...');
        
        // Check CSS files
        const cssDir = path.join(this.buildDir, 'css');
        if (fs.existsSync(cssDir)) {
            const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
            
            if (cssFiles.length > 0) {
                let totalCSSSize = 0;
                
                for (const file of cssFiles) {
                    const stats = fs.statSync(path.join(cssDir, file));
                    totalCSSSize += stats.size;
                }
                
                console.log(`  ✅ ${cssFiles.length} CSS files (${this.formatBytes(totalCSSSize)})`);
                this.checks.passed++;
                
                if (totalCSSSize > 100 * 1024) { // 100KB
                    this.addIssue('info', `CSS bundle is large: ${this.formatBytes(totalCSSSize)}`);
                }
            } else {
                this.addIssue('warning', 'No CSS files found');
            }
        }
        
        // Check deployment files
        const deploymentFiles = ['.htaccess', 'nginx.conf', 'Dockerfile'];
        let deploymentFilesFound = 0;
        
        for (const file of deploymentFiles) {
            if (fs.existsSync(path.join(this.buildDir, file))) {
                deploymentFilesFound++;
            }
        }
        
        if (deploymentFilesFound > 0) {
            console.log(`  ✅ ${deploymentFilesFound} deployment configurations created`);
            this.checks.passed++;
        }
    }

    addIssue(severity, message) {
        this.checks.issues.push({ severity, message });
        
        if (severity === 'error') {
            this.checks.failed++;
        } else if (severity === 'warning') {
            this.checks.warnings++;
        }
    }

    generateReport() {
        console.log('\n📊 Post-Build Validation Report');
        console.log('=================================');
        console.log(`✅ Checks passed: ${this.checks.passed}`);
        console.log(`⚠️ Warnings: ${this.checks.warnings}`);
        console.log(`❌ Errors: ${this.checks.failed}`);
        
        if (this.checks.issues.length > 0) {
            console.log('\n🔍 Issues Found:');
            
            // Group by severity
            const grouped = this.checks.issues.reduce((acc, issue) => {
                acc[issue.severity] = acc[issue.severity] || [];
                acc[issue.severity].push(issue);
                return acc;
            }, {});
            
            // Display errors first, then warnings, then info
            const severityOrder = ['error', 'warning', 'info'];
            
            for (const severity of severityOrder) {
                const issues = grouped[severity];
                if (issues && issues.length > 0) {
                    console.log(`\n${severity.toUpperCase()}S:`);
                    issues.forEach(issue => {
                        const icon = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';
                        console.log(`  ${icon} ${issue.message}`);
                    });
                }
            }
        }
        
        // Overall status
        const hasErrors = this.checks.failed > 0;
        const hasWarnings = this.checks.warnings > 0;
        
        console.log('\n' + '='.repeat(33));
        
        if (hasErrors) {
            console.log('❌ Build validation FAILED - Critical issues found!');
        } else if (hasWarnings) {
            console.log('⚠️ Build validation PASSED with warnings');
        } else {
            console.log('✅ Build validation PASSED - All checks successful!');
        }
        
        // Save report
        this.saveReport();
    }

    saveReport() {
        try {
            const reportData = {
                timestamp: new Date().toISOString(),
                summary: {
                    passed: this.checks.passed,
                    warnings: this.checks.warnings,
                    failed: this.checks.failed,
                    total: this.checks.passed + this.checks.warnings + this.checks.failed
                },
                issues: this.checks.issues,
                buildDir: this.buildDir
            };
            
            const reportPath = path.join(this.buildDir, 'build-validation.json');
            fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
            
            console.log(`\n📄 Validation report saved: ${reportPath}`);
            
        } catch (error) {
            console.warn('⚠️ Could not save validation report:', error.message);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Run if called directly
if (require.main === module) {
    const checker = new PostBuildChecker();
    checker.run();
}

module.exports = PostBuildChecker;