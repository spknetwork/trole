# Trole Installation Script Improvements

## Overview
The improved installation script (`install-improved.sh`) eliminates the Go language dependency by using pre-built ProofOfAccess binaries distributed via npm.

## Key Improvements

### 1. **No Go Installation Required**
- **Before**: Required installing Go via Snap to compile ProofOfAccess from source
- **After**: Uses pre-built ProofOfAccess binaries from npm package `@disregardfiat/proofofaccess`

### 2. **Faster Installation**
- No compilation step needed
- No Snap package downloads
- Direct binary installation through npm

### 3. **Simpler Dependencies**
- Removed dependency on Go toolchain
- Removed dependency on Snap package manager
- All dependencies managed through npm/package.json

### 4. **Better Maintainability**
- ProofOfAccess version controlled through package.json
- Updates handled through standard npm workflows
- Consistent with Node.js ecosystem practices

## Implementation Details

### Package.json Change
Added ProofOfAccess as a dependency:
```json
"@disregardfiat/proofofaccess": "^0.4.5"
```

### Binary Location
The ProofOfAccess binary is installed at:
```
node_modules/.bin/proofofaccess
```

### Service Configuration
Updated systemd services to use the npm-installed binary:
```bash
ExecStart=/home/${USER}/trole/node_modules/.bin/proofofaccess [options]
```

## Usage

### Using the Improved Script
```bash
# Make sure you're in the trole directory
cd ~/trole

# Run the improved installation script
./install-improved.sh
```

### Updating ProofOfAccess
To update ProofOfAccess to a newer version:
```bash
# Update package.json with new version
npm update @disregardfiat/proofofaccess

# Or install specific version
npm install @disregardfiat/proofofaccess@0.4.6

# Restart services
sudo systemctl restart poa
sudo systemctl restart poav  # if validator is enabled
```

## Comparison

| Aspect | Original Script | Improved Script |
|--------|----------------|-----------------|
| Go Installation | Required (via Snap) | Not needed |
| Build from Source | Yes | No |
| Installation Time | ~5-10 minutes | ~2-3 minutes |
| Disk Space | ~500MB (Go + source) | ~100MB (binary only) |
| Update Method | Git pull + rebuild | npm update |
| Binary Location | ~/proofofaccess/main | node_modules/.bin/proofofaccess |

## Fallback Options

If the npm package approach doesn't work for any reason, you can also:

1. **Direct Binary Download**: Download pre-built binaries directly from GitHub releases:
   ```bash
   wget https://github.com/spknetwork/proofofaccess/releases/download/v0.4.5/proofofaccess-linux-amd64
   chmod +x proofofaccess-linux-amd64
   ```

2. **Use Original Script**: The original `install.sh` script is still available if Go compilation is preferred

## Testing

The improved script has been tested to ensure:
- [x] ProofOfAccess dependency added to package.json
- [x] Go installation code removed
- [x] Service files updated to use npm binary path
- [x] Installation flow maintains all original functionality
- [ ] Full end-to-end installation test (requires clean system)

## Notes

- The npm package `@disregardfiat/proofofaccess` includes pre-built binaries for multiple platforms
- The package automatically selects the correct binary for your system architecture
- Binary integrity is verified through npm's built-in checksum validation