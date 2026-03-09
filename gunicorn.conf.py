import multiprocessing

# Use gthread worker to prevent worker timeouts during SSE streaming.
# The sync worker blocks the heartbeat during long-running streams,
# causing the arbiter to kill the worker.
worker_class = "gthread"
threads = 4
timeout = 300
