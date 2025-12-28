#!/usr/bin/env python3
"""Entry point for esptool standalone executable."""
import sys
from esptool import main

if __name__ == "__main__":
    sys.exit(main())
