import multiprocessing, os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))
threads = 2
timeout = 120
accesslog = "-"
errorlog = "-"
worker_class = "gthread"
