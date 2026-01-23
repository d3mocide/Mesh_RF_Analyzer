#!/bin/sh

# Default values
: "${DEFAULT_MAP_STYLE:=dark_green}"
: "${DEFAULT_UNITS:=imperial}"

# Recreate config file
rm -rf /usr/share/nginx/html/env-config.js
touch /usr/share/nginx/html/env-config.js

# Add assignment
echo "window._env_ = {" >> /usr/share/nginx/html/env-config.js
echo "  DEFAULT_MAP_STYLE: \"${DEFAULT_MAP_STYLE}\"," >> /usr/share/nginx/html/env-config.js
echo "  DEFAULT_UNITS: \"${DEFAULT_UNITS}\"," >> /usr/share/nginx/html/env-config.js
echo "};" >> /usr/share/nginx/html/env-config.js

# Execute the passed command (nginx)
exec "$@"
