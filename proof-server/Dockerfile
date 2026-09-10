FROM midnightnetwork/proof-server:latest

# The official Midnight proof server listens on port 6300 by default.
# Render requires the PORT env var to route traffic correctly.
# We expose 6300 and tell Render to map to it.
EXPOSE 6300

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:6300/health || exit 1
