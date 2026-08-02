---
name: pipeline-testing
description: "Guidelines and patterns for writing unit and integration tests for async data pipelines."
---

# Pipeline Testing Guidelines

1. **Seam Testing**: Test individual adapters, scorers, and detectors independently using mocked input/output queues or direct class calls.
2. **Async Queue Draining**: Ensure tests wait for `queue.join()` or check `task.done()` state when verifying pipeline stage counts.
3. **Idempotency Verification**: Verify deduplication by running pipeline test suites twice against the same data store and asserting database record counts remain unchanged.
