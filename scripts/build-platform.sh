#!/usr/bin/env bash
# ==============================================================================
# Tiledly Platform Build & Packaging Script
# 
# Usage:
#   ./scripts/build-platform.sh crazygames
#   ./scripts/build-platform.sh poki
#   ./scripts/build-platform.sh all
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"

build_target() {
    local TARGET="$1"
    local TARGET_DIR="${DIST_DIR}/tiledly-${TARGET}"
    local ZIP_FILE="${DIST_DIR}/tiledly-${TARGET}.zip"

    echo "=========================================================="
    echo "📦 Building target: ${TARGET}"
    echo "=========================================================="

    rm -rf "${TARGET_DIR}" "${ZIP_FILE}"
    mkdir -p "${TARGET_DIR}"

    # 1. Copy required core client assets
    echo "→ Copying client directories and core files..."
    cp -r "${ROOT_DIR}/css" "${TARGET_DIR}/"
    cp -r "${ROOT_DIR}/js" "${TARGET_DIR}/"
    cp -r "${ROOT_DIR}/icons" "${TARGET_DIR}/"

    # 2. Swap entry point HTML
    echo "→ Installing index.${TARGET}.html as index.html..."
    if [[ ! -f "${ROOT_DIR}/index.${TARGET}.html" ]]; then
        echo "❌ Error: Missing ${ROOT_DIR}/index.${TARGET}.html"
        exit 1
    fi
    cp "${ROOT_DIR}/index.${TARGET}.html" "${TARGET_DIR}/index.html"

    # 3. Bake target PLATFORM constant into js/platform.js
    echo "→ Setting PLATFORM = '${TARGET}' in js/platform.js..."
    sed -i.bak "s/export const PLATFORM = 'standalone';/export const PLATFORM = '${TARGET}';/" "${TARGET_DIR}/js/platform.js"
    rm -f "${TARGET_DIR}/js/platform.js.bak"

    # 4. Remove standalone-specific files if copied
    echo "→ Pruning standalone-only web assets..."
    rm -f "${TARGET_DIR}/ads.txt"
    rm -f "${TARGET_DIR}/sw.js"
    rm -f "${TARGET_DIR}/manifest.json"
    rm -f "${TARGET_DIR}/vercel.json"
    rm -f "${TARGET_DIR}/robots.txt"
    rm -f "${TARGET_DIR}/sitemap.xml"

    # 5. Platform-specific pruning
    if [[ "${TARGET}" == "poki" ]]; then
        echo "→ Poki target: pruning serverless API folder to guarantee zero outgoing calls..."
        rm -rf "${TARGET_DIR}/api"
    fi

    # 6. Verify entry point and platform flag
    if ! grep -q "export const PLATFORM = '${TARGET}';" "${TARGET_DIR}/js/platform.js"; then
        echo "❌ Error: Failed to set platform constant for ${TARGET}"
        exit 1
    fi

    # 7. Create distribution ZIP package
    echo "→ Creating ZIP package: ${ZIP_FILE}..."
    (
        cd "${TARGET_DIR}"
        zip -q -r "${ZIP_FILE}" ./*
    )

    local ZIP_SIZE
    ZIP_SIZE="$(du -h "${ZIP_FILE}" | cut -f1)"
    echo "✅ Success: Built ${ZIP_FILE} (${ZIP_SIZE})"
    echo ""
}

mkdir -p "${DIST_DIR}"

TARGET_ARG="${1:-all}"

case "${TARGET_ARG}" in
    crazygames)
        build_target "crazygames"
        ;;
    poki)
        build_target "poki"
        ;;
    all)
        build_target "crazygames"
        build_target "poki"
        ;;
    *)
        echo "Usage: $0 [crazygames|poki|all]"
        exit 1
        ;;
esac

echo "=========================================================="
echo "🎉 All requested builds generated in: ${DIST_DIR}"
echo "=========================================================="
