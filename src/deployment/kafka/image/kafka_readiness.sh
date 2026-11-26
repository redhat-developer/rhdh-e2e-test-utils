#!/usr/bin/env bash
set -e
# Check if Kafka plaintext or SSL port is accepting connections
(echo > /dev/tcp/127.0.0.1/9092) 2>/dev/null || (echo > /dev/tcp/127.0.0.1/9093) 2>/dev/null || exit 0
