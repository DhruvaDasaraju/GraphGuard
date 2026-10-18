#!/usr/bin/env python3
"""
scripts/seed_graph.py

Seeds the FalkorDB graph with synthetic security data.
Safe to run multiple times — uses MERGE for idempotent writes.

Usage (from project root):
    .venv/bin/python scripts/seed_graph.py
"""

import logging
import sys
import os

# Ensure the project root is on the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

from app.seed_data import seed_all
from app.graph_db import db_health_check

if __name__ == "__main__":
    logger.info("Checking FalkorDB connection...")
    health = db_health_check()
    if not health["healthy"]:
        logger.error("FalkorDB not reachable: %s", health["detail"])
        logger.error("Start FalkorDB first: docker compose up -d")
        sys.exit(1)

    logger.info("FalkorDB connected. Seeding graph data...")
    seed_all()
    logger.info("Graph seeded successfully.")
